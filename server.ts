import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const ALLOWED_BILL_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function validateBillPayload(base64Data: string, mimeType: string): { valid: boolean; normalizedMime: string; error?: string } {
  const lowerMime = mimeType.toLowerCase().trim();
  if (!ALLOWED_BILL_MIME_TYPES.has(lowerMime)) {
    return {
      valid: false,
      normalizedMime: lowerMime,
      error: `Unsupported file type (${mimeType}). Only PDF, JPG, JPEG, and PNG electricity bills are accepted.`,
    };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Data, 'base64');
  } catch {
    return { valid: false, normalizedMime: lowerMime, error: 'Invalid base64 file encoding.' };
  }

  if (!buffer || buffer.length < 64) {
    return {
      valid: false,
      normalizedMime: lowerMime,
      error: 'The uploaded file appears to be empty or corrupted.',
    };
  }

  if (buffer.length > 15 * 1024 * 1024) {
    return {
      valid: false,
      normalizedMime: lowerMime,
      error: 'File exceeds the 15 MB upload limit. Please upload a compressed PDF or image.',
    };
  }

  if (lowerMime === 'application/pdf') {
    const headerSlice = buffer.subarray(0, Math.min(1024, buffer.length)).toString('ascii');
    if (!headerSlice.includes('%PDF-')) {
      return {
        valid: false,
        normalizedMime: lowerMime,
        error: 'The uploaded PDF file appears corrupted or is not a valid PDF document.',
      };
    }
  } else if (lowerMime === 'image/png') {
    const isPng =
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47;
    if (!isPng) {
      return {
        valid: false,
        normalizedMime: lowerMime,
        error: 'The uploaded PNG image appears corrupted or has an invalid file signature.',
      };
    }
  } else if (lowerMime === 'image/jpeg' || lowerMime === 'image/jpg') {
    const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8;
    if (!isJpeg) {
      return {
        valid: false,
        normalizedMime: 'image/jpeg',
        error: 'The uploaded JPEG image appears corrupted or has an invalid file signature.',
      };
    }
  }

  return {
    valid: true,
    normalizedMime: lowerMime === 'image/jpg' ? 'image/jpeg' : lowerMime,
  };
}

function cleanStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function cleanOptNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function cleanStrArray(val: unknown, maxLen: number): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .map((item) => String(item ?? '').trim())
    .filter((s) => s.length > 0)
    .slice(0, maxLen);
}

function isTransientGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
}

function formatGeminiError(err: unknown, fallbackMsg: string): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err || fallbackMsg);
  if (raw.includes('503') || raw.includes('UNAVAILABLE')) {
    return {
      status: 503,
      message: 'The AI document service is temporarily experiencing high demand. Please click Retry Extraction in a few seconds.',
    };
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'AI extraction rate limit reached momentarily. Please wait a few seconds and retry.',
    };
  }
  return { status: 500, message: raw || fallbackMsg };
}

async function generateContentResilient(
  ai: GoogleGenAI,
  params: Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'>
) {
  const models = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
  let lastError: unknown;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      return await ai.models.generateContent({ model, ...params });
    } catch (err) {
      lastError = err;
      if (!isTransientGeminiError(err) || i === models.length - 1) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 900));
    }
  }
  throw lastError;
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'ecogrid-api' });
  });

  app.post('/api/ai/extract-bill', async (req, res) => {
    try {
      const { base64Data, mimeType, fileName } = req.body as {
        base64Data?: string;
        mimeType?: string;
        fileName?: string;
      };

      if (!base64Data || !mimeType) {
        res.status(400).json({ error: 'Missing bill file payload (base64Data or mimeType).' });
        return;
      }

      const validation = validateBillPayload(base64Data, mimeType);
      if (!validation.valid) {
        res.status(400).json({ error: validation.error || 'Invalid bill file.' });
        return;
      }

      const ai = getGeminiClient();

      const prompt = [
        'You are a high-precision utility bill parser using multimodal document understanding.',
        `Read every page/area of the uploaded electricity bill (${fileName || 'electricity_bill'}) and extract ONLY fields explicitly visible in the document.`,
        'STRICT ACCURACY RULES:',
        '1. NEVER guess, fabricate, extrapolate, or infer numbers that are not printed in the document.',
        '2. If a text field is not visible or cannot be read confidently, return "" (empty string).',
        '3. If a numeric field is not visible or cannot be read confidently, return null.',
        '4. Format dates as YYYY-MM-DD when possible (or exact printed date string if day is missing), and billingMonth as YYYY-MM (or Month Year like "May 2025") if printed.',
        '5. Classify consumerCategory as "domestic", "commercial", or "industrial" only if clearly stated or evident from tariff category (e.g., LT-1 Domestic -> domestic, LT-2/HT Commercial -> commercial, HT Industrial -> industrial), otherwise "".',
        '6. Return pure numeric values without currency symbols (₹, Rs, $) or commas.',
        '7. In tariffDetails, list visible slab rates, sanctioned load, tariff code, or TOD rate notes as short strings.',
        '8. In extractionNotes, note any blurry sections, partial pages, missing totals, or if the file does not appear to be an electricity bill.',
        '9. In confidence, set overall, identity, consumption, charges to "high", "medium", or "low", and list any uncertain or unreadable field names in uncertainFields.',
      ].join('\n');

      const response = await generateContentResilient(ai, {
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: validation.normalizedMime,
                data: base64Data,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              consumerName: { type: Type.STRING, nullable: true },
              consumerNumber: { type: Type.STRING, nullable: true },
              provider: { type: Type.STRING, nullable: true },
              state: { type: Type.STRING, nullable: true },
              city: { type: Type.STRING, nullable: true },
              consumerCategory: { type: Type.STRING, nullable: true },
              tariffType: { type: Type.STRING, nullable: true },
              billingMonth: { type: Type.STRING, nullable: true },
              billingPeriodStart: { type: Type.STRING, nullable: true },
              billingPeriodEnd: { type: Type.STRING, nullable: true },
              billDate: { type: Type.STRING, nullable: true },
              dueDate: { type: Type.STRING, nullable: true },
              previousReading: { type: Type.NUMBER, nullable: true },
              currentReading: { type: Type.NUMBER, nullable: true },
              unitsConsumed: { type: Type.NUMBER, nullable: true },
              previousMonthConsumption: { type: Type.NUMBER, nullable: true },
              energyCharges: { type: Type.NUMBER, nullable: true },
              fixedCharges: { type: Type.NUMBER, nullable: true },
              demandCharges: { type: Type.NUMBER, nullable: true },
              fuelAdjustmentCharges: { type: Type.NUMBER, nullable: true },
              electricityDuty: { type: Type.NUMBER, nullable: true },
              taxes: { type: Type.NUMBER, nullable: true },
              otherCharges: { type: Type.NUMBER, nullable: true },
              subsidies: { type: Type.NUMBER, nullable: true },
              lateFees: { type: Type.NUMBER, nullable: true },
              totalBillAmount: { type: Type.NUMBER, nullable: true },
              paymentStatus: { type: Type.STRING, nullable: true },
              meterNumber: { type: Type.STRING, nullable: true },
              tariffDetails: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              extractionNotes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              confidence: {
                type: Type.OBJECT,
                properties: {
                  overall: { type: Type.STRING },
                  identity: { type: Type.STRING },
                  consumption: { type: Type.STRING },
                  charges: { type: Type.STRING },
                  uncertainFields: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const rawText = (response.text || '{}').trim();
      let rawParsed: Record<string, unknown>;
      try {
        rawParsed = JSON.parse(rawText);
      } catch {
        res.status(502).json({
          error: 'Gemini returned malformed extraction JSON. Please retry extraction or enter details manually.',
        });
        return;
      }

      const confRaw = (rawParsed.confidence as Record<string, unknown> | undefined) || {};
      const extracted = {
        consumerName: cleanStr(rawParsed.consumerName),
        consumerNumber: cleanStr(rawParsed.consumerNumber),
        provider: cleanStr(rawParsed.provider),
        state: cleanStr(rawParsed.state),
        city: cleanStr(rawParsed.city),
        consumerCategory: cleanStr(rawParsed.consumerCategory).toLowerCase(),
        tariffType: cleanStr(rawParsed.tariffType),
        billingMonth: cleanStr(rawParsed.billingMonth),
        billingPeriodStart: cleanStr(rawParsed.billingPeriodStart),
        billingPeriodEnd: cleanStr(rawParsed.billingPeriodEnd),
        billDate: cleanStr(rawParsed.billDate),
        dueDate: cleanStr(rawParsed.dueDate),
        previousReading: cleanOptNum(rawParsed.previousReading),
        currentReading: cleanOptNum(rawParsed.currentReading),
        unitsConsumed: cleanOptNum(rawParsed.unitsConsumed),
        previousMonthConsumption: cleanOptNum(rawParsed.previousMonthConsumption),
        energyCharges: cleanOptNum(rawParsed.energyCharges),
        fixedCharges: cleanOptNum(rawParsed.fixedCharges),
        demandCharges: cleanOptNum(rawParsed.demandCharges),
        fuelAdjustmentCharges: cleanOptNum(rawParsed.fuelAdjustmentCharges),
        electricityDuty: cleanOptNum(rawParsed.electricityDuty),
        taxes: cleanOptNum(rawParsed.taxes),
        otherCharges: cleanOptNum(rawParsed.otherCharges),
        subsidies: cleanOptNum(rawParsed.subsidies),
        lateFees: cleanOptNum(rawParsed.lateFees),
        totalBillAmount: cleanOptNum(rawParsed.totalBillAmount),
        paymentStatus: cleanStr(rawParsed.paymentStatus),
        meterNumber: cleanStr(rawParsed.meterNumber),
        tariffDetails: cleanStrArray(rawParsed.tariffDetails, 15),
        extractionNotes: cleanStrArray(rawParsed.extractionNotes, 15),
        confidence: {
          overall: cleanStr(confRaw.overall) || 'medium',
          identity: cleanStr(confRaw.identity) || 'medium',
          consumption: cleanStr(confRaw.consumption) || 'medium',
          charges: cleanStr(confRaw.charges) || 'medium',
          uncertainFields: cleanStrArray(confRaw.uncertainFields, 35),
        },
      };

      const hasAnyCoreBillField =
        Boolean(extracted.provider) ||
        Boolean(extracted.consumerNumber) ||
        extracted.unitsConsumed !== null ||
        extracted.totalBillAmount !== null ||
        (extracted.currentReading !== null && extracted.previousReading !== null);

      res.json({
        extracted,
        unreadableDocument: !hasAnyCoreBillField,
      });
    } catch (error) {
      const formatted = formatGeminiError(error, 'Failed to analyze electricity bill.');
      console.error('Bill extraction error:', formatted.message);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/ai/analyze-bill', async (req, res) => {
    try {
      const { bill, previousBills, profile, policyUsed } = req.body as {
        bill?: Record<string, unknown>;
        previousBills?: Record<string, unknown>[];
        profile?: Record<string, unknown>;
        policyUsed?: Record<string, unknown>;
      };

      if (!bill) {
        res.status(400).json({ error: 'Missing bill payload for post-extraction analysis.' });
        return;
      }

      const ai = getGeminiClient();

      const prompt = [
        'You are an electricity tariff and sustainability analyst.',
        'Generate a concise, structured post-extraction analysis of the user’s electricity bill.',
        'CRITICAL GROUNDING RULES:',
        '- Strictly distinguish factual extracted/confirmed numbers from AI-generated recommendations.',
        '- Never invent bill amounts or historical bills that are not provided below.',
        '- If previousBills is empty and previousMonthConsumption is null, state clearly that this is the first recorded cycle so historical MoM comparison is not yet available.',
        '- Use Indian Rupees (₹) and kWh matching the provided figures.',
        `Current Bill Data: ${JSON.stringify(bill)}`,
        `Previous Confirmed Bills: ${JSON.stringify((previousBills || []).slice(0, 6))}`,
        `Consumer Profile: ${JSON.stringify(profile || {})}`,
        `Active Regional Tariff Policy Reference: ${JSON.stringify(policyUsed || {})}`,
      ].join('\n\n');

      const response = await generateContentResilient(ai, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              billSummary: { type: Type.STRING },
              mainContributors: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    amountInr: { type: Type.NUMBER, nullable: true },
                    shareNote: { type: Type.STRING },
                  },
                },
              },
              consumptionComparison: { type: Type.STRING },
              savingOpportunities: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    detail: { type: Type.STRING },
                    estimatedMonthlySavingsInr: { type: Type.NUMBER, nullable: true },
                  },
                },
              },
              estimatedCarbonSummary: { type: Type.STRING },
              tariffInsights: { type: Type.STRING },
              factualBasisNote: { type: Type.STRING },
            },
          },
        },
      });

      const rawText = (response.text || '{}').trim();
      const parsed = JSON.parse(rawText);
      res.json({ analysis: parsed });
    } catch (error) {
      const formatted = formatGeminiError(error, 'Failed to generate bill analysis.');
      console.error('Bill analysis error:', formatted.message);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/ai/insights', async (req, res) => {
    try {
      const { profile, metrics, tariffBreakdown, forecast, dataSourceLabel } = req.body as {
        profile: Record<string, unknown>;
        metrics: Record<string, unknown>;
        tariffBreakdown: Record<string, unknown>;
        forecast: Record<string, unknown>;
        dataSourceLabel: string;
      };

      if (!profile || !metrics) {
        res.status(400).json({ error: 'Missing profile or consumption metrics for AI insights.' });
        return;
      }

      const ai = getGeminiClient();

      const prompt = [
        'You are an energy policy, dynamic tariff, and sustainability analyst.',
        `Data Basis: ${dataSourceLabel}.`,
        'Generate personalized, quantitative electricity insights strictly grounded in the provided consumer profile, consumption metrics, dynamic tariff breakdown, and forecast.',
        'Tailor every recommendation specifically to the consumer category and detailed profiling attributes (appliances/HVAC/solar for Domestic, operating hours/commercial loads/sanctioned load for Commercial, or shifts/processes/power factor/contract demand for Industrial).',
        'Do NOT invent statistics or claim an ML model was trained. Reference the rupee (₹) savings and kg CO2e impact realistically from the provided numbers.',
        `Consumer Profile: ${JSON.stringify(profile)}`,
        `Consumption Metrics: ${JSON.stringify(metrics)}`,
        `Dynamic Tariff Breakdown: ${JSON.stringify(tariffBreakdown)}`,
        `Forecast Summary: ${JSON.stringify(forecast)}`,
      ].join('\n\n');

      const response = await generateContentResilient(ai, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              insights: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    detail: { type: Type.STRING },
                    estimatedMonthlySavingsInr: { type: Type.NUMBER },
                    estimatedCarbonReductionKg: { type: Type.NUMBER },
                    priority: { type: Type.STRING },
                  },
                },
              },
              profileSpecificAction: { type: Type.STRING },
              tariffOptimizationTip: { type: Type.STRING },
            },
          },
        },
      });

      const rawText = (response.text || '{}').trim();
      const parsed = JSON.parse(rawText);
      res.json({ analysis: parsed });
    } catch (error) {
      const formatted = formatGeminiError(error, 'Failed to generate AI energy insights.');
      console.error('Insights error:', formatted.message);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EcoGrid server running on http://0.0.0.0:${PORT}`);
  });
}

createApp().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
