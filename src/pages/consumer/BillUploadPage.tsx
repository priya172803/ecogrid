import React, { useEffect, useRef, useState } from 'react';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  FileUp,
  Loader2,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { storage } from '../../firebase';
import type {
  BillAnalysisResponse,
  BillExtractionConfidence,
  ElectricityBill,
  ExtractedBillPayload,
} from '../../types/energy';
import { calculateDynamicTariff } from '../../utils/tariffEngine';

interface BillFormDraft {
  consumerName: string;
  consumerNumber: string;
  provider: string;
  state: string;
  city: string;
  consumerCategory: string;
  tariffType: string;
  billingMonth: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  billDate: string;
  dueDate: string;
  previousReading: string;
  currentReading: string;
  unitsConsumed: string;
  previousMonthConsumption: string;
  energyCharges: string;
  fixedCharges: string;
  demandCharges: string;
  fuelAdjustmentCharges: string;
  electricityDuty: string;
  taxes: string;
  otherCharges: string;
  subsidies: string;
  lateFees: string;
  totalBillAmount: string;
  paymentStatus: string;
  meterNumber: string;
  tariffDetailsText: string;
}

const EMPTY_DRAFT: BillFormDraft = {
  consumerName: '',
  consumerNumber: '',
  provider: '',
  state: '',
  city: '',
  consumerCategory: '',
  tariffType: '',
  billingMonth: '',
  billingPeriodStart: '',
  billingPeriodEnd: '',
  billDate: '',
  dueDate: '',
  previousReading: '',
  currentReading: '',
  unitsConsumed: '',
  previousMonthConsumption: '',
  energyCharges: '',
  fixedCharges: '',
  demandCharges: '',
  fuelAdjustmentCharges: '',
  electricityDuty: '',
  taxes: '',
  otherCharges: '',
  subsidies: '',
  lateFees: '',
  totalBillAmount: '',
  paymentStatus: '',
  meterNumber: '',
  tariffDetailsText: '',
};

const LOADING_STEPS = [
  'Reading your electricity bill...',
  'Extracting consumption details...',
  'Analyzing tariff and billing information...',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

function toStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function toOptNum(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function resolveMimeType(file: File): string {
  if (file.type && ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
    return file.type.toLowerCase() === 'image/jpg' ? 'image/jpeg' : file.type.toLowerCase();
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return file.type || '';
}

function computeUnitsFallback(
  extractedUnits: number | null,
  prevReading: number | null,
  currReading: number | null
): { units: number | null; autoCalculated: boolean } {
  if (extractedUnits !== null && Number.isFinite(extractedUnits) && extractedUnits >= 0) {
    return { units: extractedUnits, autoCalculated: false };
  }
  if (
    prevReading !== null &&
    currReading !== null &&
    Number.isFinite(prevReading) &&
    Number.isFinite(currReading) &&
    prevReading >= 0 &&
    currReading >= prevReading
  ) {
    return {
      units: Number((currReading - prevReading).toFixed(2)),
      autoCalculated: true,
    };
  }
  return { units: null, autoCalculated: false };
}

export function BillUploadPage() {
  const { firebaseUser, profile, bills, tariffPolicies, saveElectricityBill } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [unreadableNotice, setUnreadableNotice] = useState(false);

  const [rawExtractedSnapshot, setRawExtractedSnapshot] = useState<ExtractedBillPayload | null>(null);
  const [draft, setDraft] = useState<BillFormDraft | null>(null);
  const [unitsAutoCalculated, setUnitsAutoCalculated] = useState(false);
  const [editHighlightActive, setEditHighlightActive] = useState(false);
  const [confidence, setConfidence] = useState<BillExtractionConfidence | null>(null);
  const [extractionNotes, setExtractionNotes] = useState<string[]>([]);
  const [syncToConsumption, setSyncToConsumption] = useState(true);

  const [billAnalysis, setBillAnalysis] = useState<BillAnalysisResponse | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [lastSavedBill, setLastSavedBill] = useState<ElectricityBill | null>(null);
  const [selectedHistoryBill, setSelectedHistoryBill] = useState<ElectricityBill | null>(null);

  // Cycle loading stage messages during Gemini extraction
  useEffect(() => {
    if (!processing) {
      setLoadingStepIndex(0);
      return;
    }
    const t1 = window.setTimeout(() => setLoadingStepIndex(1), 1400);
    const t2 = window.setTimeout(() => setLoadingStepIndex(2), 3000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [processing]);

  // Cleanup object URL on unmount or replacement
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const runPostExtractionAnalysis = async (
    billPayload: Record<string, unknown>,
    tariffPolicyUsed?: Record<string, unknown>
  ) => {
    if (!profile) return;
    setAnalysisLoading(true);
    setAnalysisError('');
    try {
      const res = await fetch('/api/ai/analyze-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bill: billPayload,
          previousBills: bills.slice(0, 6).map((b) => ({
            billingMonth: b.billingMonth || b.billingPeriod,
            billDate: b.billDate || b.billIssueDate,
            unitsConsumed: b.unitsConsumed ?? b.totalConsumptionKwh,
            totalBillAmount: b.totalBillAmount,
            provider: b.provider || b.electricityProvider,
          })),
          profile: {
            category: profile.category,
            state: profile.state,
            city: profile.city,
            discom: profile.discom,
            domesticProfile: profile.domesticProfile,
            commercialProfile: profile.commercialProfile,
            industrialProfile: profile.industrialProfile,
          },
          policyUsed: tariffPolicyUsed || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Unable to generate AI bill analysis.');
      }
      setBillAnalysis(json.analysis);
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : 'Unable to reach Gemini bill analysis service.'
      );
    } finally {
      setAnalysisLoading(false);
    }
  };

  const extractBillFromFile = async (file: File, existingPreviewUrl?: string) => {
    if (!firebaseUser || !profile) return;

    const resolvedMime = resolveMimeType(file);
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!ALLOWED_MIME_TYPES.includes(resolvedMime) && !hasValidExt) {
      showToast(
        'Unsupported format',
        'Please upload a valid PDF, JPG, JPEG, or PNG electricity bill.',
        'error'
      );
      return;
    }

    if (file.size === 0) {
      showToast('Empty file', 'The selected file is 0 bytes and cannot be read.', 'error');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      showToast('File too large', 'Please upload an electricity bill smaller than 15 MB.', 'error');
      return;
    }

    setSelectedFile(file);
    setExtractError('');
    setUnreadableNotice(false);
    setBillAnalysis(null);
    setAnalysisError('');
    setLastSavedBill(null);
    setProcessing(true);
    setLoadingStepIndex(0);

    if (!existingPreviewUrl) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
    }

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          const commaIdx = result.indexOf(',');
          resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
        };
        reader.onerror = () => reject(new Error('Failed to read the selected file from disk.'));
        reader.readAsDataURL(file);
      });

      const response = await fetch('/api/ai/extract-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data,
          mimeType: resolvedMime,
          fileName: file.name,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gemini bill extraction failed.');
      }

      const ex: ExtractedBillPayload = data.extracted || {};
      setRawExtractedSnapshot(ex);
      setUnreadableNotice(Boolean(data.unreadableDocument));

      const unitResolution = computeUnitsFallback(
        ex.unitsConsumed ?? null,
        ex.previousReading ?? null,
        ex.currentReading ?? null
      );
      setUnitsAutoCalculated(unitResolution.autoCalculated);

      const nextDraft: BillFormDraft = {
        consumerName: toStr(ex.consumerName),
        consumerNumber: toStr(ex.consumerNumber),
        provider: toStr(ex.provider),
        state: toStr(ex.state),
        city: toStr(ex.city),
        consumerCategory: toStr(ex.consumerCategory),
        tariffType: toStr(ex.tariffType),
        billingMonth: toStr(ex.billingMonth),
        billingPeriodStart: toStr(ex.billingPeriodStart),
        billingPeriodEnd: toStr(ex.billingPeriodEnd),
        billDate: toStr(ex.billDate),
        dueDate: toStr(ex.dueDate),
        previousReading: toStr(ex.previousReading),
        currentReading: toStr(ex.currentReading),
        unitsConsumed: unitResolution.units !== null ? String(unitResolution.units) : '',
        previousMonthConsumption: toStr(ex.previousMonthConsumption),
        energyCharges: toStr(ex.energyCharges),
        fixedCharges: toStr(ex.fixedCharges),
        demandCharges: toStr(ex.demandCharges),
        fuelAdjustmentCharges: toStr(ex.fuelAdjustmentCharges),
        electricityDuty: toStr(ex.electricityDuty),
        taxes: toStr(ex.taxes),
        otherCharges: toStr(ex.otherCharges),
        subsidies: toStr(ex.subsidies),
        lateFees: toStr(ex.lateFees),
        totalBillAmount: toStr(ex.totalBillAmount),
        paymentStatus: toStr(ex.paymentStatus),
        meterNumber: toStr(ex.meterNumber),
        tariffDetailsText: Array.isArray(ex.tariffDetails) ? ex.tariffDetails.join('\n') : '',
      };

      setDraft(nextDraft);
      setConfidence(ex.confidence || null);
      setExtractionNotes(Array.isArray(ex.extractionNotes) ? ex.extractionNotes : []);
      setEditHighlightActive(Boolean(data.unreadableDocument));

      // Trigger post-extraction AI analysis if core numbers were extracted
      if (unitResolution.units !== null || ex.totalBillAmount !== null) {
        const tariffBench = calculateDynamicTariff(
          {
            kwh: unitResolution.units || 0,
            category: profile.category,
            state: ex.state || profile.state,
            discom: ex.provider || profile.discom,
            peakShareRatio: 0.32,
            offPeakShareRatio: 0.2,
          },
          tariffPolicies
        );
        void runPostExtractionAnalysis(
          {
            ...ex,
            unitsConsumed: unitResolution.units,
          },
          tariffBench.policyUsed as unknown as Record<string, unknown>
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Network or parsing error while extracting electricity bill.';
      setExtractError(msg);
      // Keep selectedFile intact for Retry Extraction, and open manual fallback draft
      setDraft((prev) => prev || { ...EMPTY_DRAFT });
      setEditHighlightActive(true);
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelUpload = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl('');
    setDraft(null);
    setRawExtractedSnapshot(null);
    setConfidence(null);
    setExtractionNotes([]);
    setExtractError('');
    setUnreadableNotice(false);
    setUnitsAutoCalculated(false);
    setEditHighlightActive(false);
    setBillAnalysis(null);
    setAnalysisError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRetryExtraction = () => {
    if (!selectedFile || processing) return;
    void extractBillFromFile(selectedFile, previewUrl);
  };

  const handleEditDetails = () => {
    setEditHighlightActive(true);
    firstInputRef.current?.focus();
    showToast(
      'Edit mode active',
      'Review and adjust any extracted values below before confirming.',
      'info'
    );
  };

  const updateReadingAndMaybeComputeUnits = (
    key: 'previousReading' | 'currentReading' | 'unitsConsumed',
    value: string
  ) => {
    if (!draft) return;
    const updated = { ...draft, [key]: value };
    if (key === 'unitsConsumed') {
      setUnitsAutoCalculated(false);
      setDraft(updated);
      return;
    }

    // Only auto-compute unitsConsumed if it was previously empty or auto-calculated
    if (!draft.unitsConsumed.trim() || unitsAutoCalculated) {
      const prev = toOptNum(updated.previousReading);
      const curr = toOptNum(updated.currentReading);
      if (prev !== null && curr !== null && curr >= prev) {
        updated.unitsConsumed = String(Number((curr - prev).toFixed(2)));
        setUnitsAutoCalculated(true);
      } else if (unitsAutoCalculated) {
        updated.unitsConsumed = '';
        setUnitsAutoCalculated(false);
      }
    }
    setDraft(updated);
  };

  const handleConfirmSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || !selectedFile || !firebaseUser || !profile) return;

    const resolvedUnits = toOptNum(draft.unitsConsumed);
    const resolvedTotalAmt = toOptNum(draft.totalBillAmount);

    if (resolvedUnits === null || resolvedTotalAmt === null) {
      setEditHighlightActive(true);
      showToast(
        'Required verification fields missing',
        'Please confirm or enter Units Consumed (kWh) and Total Bill Amount (₹) before saving.',
        'error'
      );
      return;
    }

    setSaving(true);
    try {
      // Upload original file to Firebase Storage ONLY upon user confirmation
      let uploadedUrl = '';
      let uploadedPath: string | null = null;
      try {
        const cleanName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        uploadedPath = `bills/${firebaseUser.uid}/${Date.now()}_${cleanName}`;
        const storageRef = ref(storage, uploadedPath);
        await uploadBytes(storageRef, selectedFile, {
          contentType: resolveMimeType(selectedFile) || selectedFile.type,
        });
        uploadedUrl = await getDownloadURL(storageRef);
      } catch (storageErr) {
        const storageMsg =
          storageErr instanceof Error ? storageErr.message : 'Firebase Storage upload failed.';
        showToast(
          'Storage upload error',
          `${storageMsg} Your extracted details are preserved so you can retry saving.`,
          'error'
        );
        setSaving(false);
        return;
      }

      const tariffDetailsArr = draft.tariffDetailsText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(0, 15);

      const confirmedSnapshot: Record<string, unknown> = {
        consumerName: draft.consumerName.trim() || null,
        consumerNumber: draft.consumerNumber.trim() || null,
        provider: draft.provider.trim() || null,
        state: draft.state.trim() || null,
        city: draft.city.trim() || null,
        consumerCategory: draft.consumerCategory.trim() || null,
        tariffType: draft.tariffType.trim() || null,
        billingMonth: draft.billingMonth.trim() || null,
        billingPeriodStart: draft.billingPeriodStart.trim() || null,
        billingPeriodEnd: draft.billingPeriodEnd.trim() || null,
        billDate: draft.billDate.trim() || null,
        dueDate: draft.dueDate.trim() || null,
        previousReading: toOptNum(draft.previousReading),
        currentReading: toOptNum(draft.currentReading),
        unitsConsumed: resolvedUnits,
        previousMonthConsumption: toOptNum(draft.previousMonthConsumption),
        energyCharges: toOptNum(draft.energyCharges),
        fixedCharges: toOptNum(draft.fixedCharges),
        demandCharges: toOptNum(draft.demandCharges),
        fuelAdjustmentCharges: toOptNum(draft.fuelAdjustmentCharges),
        electricityDuty: toOptNum(draft.electricityDuty),
        taxes: toOptNum(draft.taxes),
        otherCharges: toOptNum(draft.otherCharges),
        subsidies: toOptNum(draft.subsidies),
        lateFees: toOptNum(draft.lateFees),
        totalBillAmount: resolvedTotalAmt,
        paymentStatus: draft.paymentStatus.trim() || null,
        meterNumber: draft.meterNumber.trim() || null,
        tariffDetails: tariffDetailsArr,
        extractionNotes,
        confidence,
      };

      const extractionStatus: 'confirmed' | 'partial' | 'manual_override' = extractError
        ? 'manual_override'
        : uncertainFieldsSet.size > 0 || unreadableNotice
        ? 'partial'
        : 'confirmed';

      const saved = await saveElectricityBill(
        {
          fileName: selectedFile.name,
          fileType: resolveMimeType(selectedFile) || selectedFile.type,
          storageUrl: uploadedUrl,
          storagePath: uploadedPath,
          consumerName: draft.consumerName.trim() || null,
          consumerNumber: draft.consumerNumber.trim() || null,
          provider: draft.provider.trim() || null,
          electricityProvider: draft.provider.trim() || null,
          state: draft.state.trim() || null,
          city: draft.city.trim() || null,
          consumerCategory: draft.consumerCategory.trim() || null,
          tariffType: draft.tariffType.trim() || null,
          billingMonth: draft.billingMonth.trim() || null,
          billingPeriod:
            draft.billingPeriodStart && draft.billingPeriodEnd
              ? `${draft.billingPeriodStart.trim()} to ${draft.billingPeriodEnd.trim()}`
              : draft.billingMonth.trim() || null,
          billingPeriodStart: draft.billingPeriodStart.trim() || null,
          billingPeriodEnd: draft.billingPeriodEnd.trim() || null,
          billDate: draft.billDate.trim() || null,
          billIssueDate: draft.billDate.trim() || null,
          dueDate: draft.dueDate.trim() || null,
          previousReading: toOptNum(draft.previousReading),
          previousMeterReading: toOptNum(draft.previousReading),
          currentReading: toOptNum(draft.currentReading),
          currentMeterReading: toOptNum(draft.currentReading),
          unitsConsumed: resolvedUnits,
          totalConsumptionKwh: resolvedUnits,
          previousMonthConsumption: toOptNum(draft.previousMonthConsumption),
          previousMonthConsumptionKwh: toOptNum(draft.previousMonthConsumption),
          energyCharges: toOptNum(draft.energyCharges),
          fixedCharges: toOptNum(draft.fixedCharges),
          demandCharges: toOptNum(draft.demandCharges),
          fuelAdjustmentCharges: toOptNum(draft.fuelAdjustmentCharges),
          electricityDuty: toOptNum(draft.electricityDuty),
          taxes: toOptNum(draft.taxes),
          otherCharges: toOptNum(draft.otherCharges),
          subsidies: toOptNum(draft.subsidies),
          lateFees: toOptNum(draft.lateFees),
          totalBillAmount: resolvedTotalAmt,
          paymentStatus: draft.paymentStatus.trim() || null,
          meterNumber: draft.meterNumber.trim() || null,
          tariffDetails: tariffDetailsArr,
          extractionNotes,
          confidence: confidence || undefined,
          extractionStatus,
          extractedData: rawExtractedSnapshot
            ? (rawExtractedSnapshot as unknown as Record<string, unknown>)
            : null,
          confirmedData: confirmedSnapshot,
          verifiedByUser: true,
        },
        syncToConsumption
      );

      if (saved) {
        setLastSavedBill(saved);
        // Refresh AI bill analysis using confirmed user figures
        void runPostExtractionAnalysis(confirmedSnapshot);
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
      setSelectedFile(null);
      setDraft(null);
      setRawExtractedSnapshot(null);
      setEditHighlightActive(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setSaving(false);
    }
  };

  const uncertainFieldsSet = new Set(
    (confidence?.uncertainFields || []).map((f) => f.trim().toLowerCase())
  );

  const tariffCrossCheck =
    draft && Number(draft.unitsConsumed) > 0 && profile
      ? calculateDynamicTariff(
          {
            kwh: Number(draft.unitsConsumed),
            category: profile.category,
            state: draft.state || profile.state,
            discom: draft.provider || profile.discom,
            peakShareRatio: 0.32,
            offPeakShareRatio: 0.2,
          },
          tariffPolicies
        )
      : null;

  const isPdfSelected =
    selectedFile?.type === 'application/pdf' ||
    selectedFile?.name.toLowerCase().endsWith('.pdf');

  const fieldGroups: {
    heading: string;
    fields: {
      key: keyof Omit<BillFormDraft, 'tariffDetailsText'>;
      label: string;
      type: 'text' | 'number';
      required?: boolean;
    }[];
  }[] = [
    {
      heading: 'Consumer & Provider Details',
      fields: [
        { key: 'consumerName', label: 'Consumer Name', type: 'text' },
        { key: 'consumerNumber', label: 'Consumer / Account Number', type: 'text' },
        { key: 'provider', label: 'Electricity Provider / DISCOM', type: 'text' },
        { key: 'state', label: 'State', type: 'text' },
        { key: 'city', label: 'City', type: 'text' },
        { key: 'consumerCategory', label: 'Consumer Category', type: 'text' },
        { key: 'tariffType', label: 'Consumer Tariff Type', type: 'text' },
        { key: 'meterNumber', label: 'Meter Number', type: 'text' },
      ],
    },
    {
      heading: 'Billing Dates & Period',
      fields: [
        { key: 'billingMonth', label: 'Billing Month (YYYY-MM)', type: 'text' },
        { key: 'billingPeriodStart', label: 'Period Start Date', type: 'text' },
        { key: 'billingPeriodEnd', label: 'Period End Date', type: 'text' },
        { key: 'billDate', label: 'Bill Issue Date', type: 'text' },
        { key: 'dueDate', label: 'Due Date', type: 'text' },
        { key: 'paymentStatus', label: 'Payment Status', type: 'text' },
      ],
    },
    {
      heading: 'Meter Readings & Consumption',
      fields: [
        { key: 'previousReading', label: 'Previous Meter Reading', type: 'number' },
        { key: 'currentReading', label: 'Current Meter Reading', type: 'number' },
        { key: 'unitsConsumed', label: 'Units Consumed (kWh) *', type: 'number', required: true },
        { key: 'previousMonthConsumption', label: 'Previous Month Consumption (kWh)', type: 'number' },
      ],
    },
    {
      heading: 'Charges, Taxes & Total Payable',
      fields: [
        { key: 'energyCharges', label: 'Energy Charges (₹)', type: 'number' },
        { key: 'fixedCharges', label: 'Fixed Charges (₹)', type: 'number' },
        { key: 'demandCharges', label: 'Demand Charges (₹)', type: 'number' },
        { key: 'fuelAdjustmentCharges', label: 'Fuel Adjustment Charges (₹)', type: 'number' },
        { key: 'electricityDuty', label: 'Electricity Duty (₹)', type: 'number' },
        { key: 'taxes', label: 'Taxes (₹)', type: 'number' },
        { key: 'otherCharges', label: 'Other Charges (₹)', type: 'number' },
        { key: 'subsidies', label: 'Subsidies (₹)', type: 'number' },
        { key: 'lateFees', label: 'Late Fees (₹)', type: 'number' },
        { key: 'totalBillAmount', label: 'Total Bill Amount (₹) *', type: 'number', required: true },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Electricity Bill Upload &amp; Multimodal Verification
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Upload PDF, JPG, JPEG, or PNG utility bills. Gemini reads the exact uploaded document without inventing missing values—review and confirm before saving to Firebase Storage &amp; Firestore.
        </p>
      </div>

      {/* Upload Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void extractBillFromFile(f);
        }}
        className={`bg-white border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragging ? 'border-emerald-700 bg-emerald-50/40' : 'border-slate-300'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void extractBillFromFile(f);
          }}
        />
        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto mb-3">
          {processing ? <Loader2 className="w-6 h-6 animate-spin" /> : <FileUp className="w-6 h-6" />}
        </div>

        {processing ? (
          <div className="max-w-md mx-auto space-y-3 py-2">
            <h2 className="text-sm font-semibold text-slate-900">
              {LOADING_STEPS[loadingStepIndex]}
            </h2>
            <div className="space-y-1.5 text-left text-xs bg-slate-50 border border-slate-200 rounded-lg p-3">
              {LOADING_STEPS.map((label, idx) => {
                const done = idx < loadingStepIndex;
                const active = idx === loadingStepIndex;
                return (
                  <div
                    key={label}
                    className={`flex items-center gap-2 ${
                      done
                        ? 'text-emerald-700 font-medium'
                        : active
                        ? 'text-slate-900 font-semibold'
                        : 'text-slate-400'
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    ) : active ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700 shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                    )}
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-sm font-semibold text-slate-900">
              Drag and drop your electricity bill here
            </h2>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Supported formats: PDF, JPG, JPEG, PNG (max 15 MB) · Unconfirmed AI extractions are never saved automatically
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-emerald-800 text-white text-xs font-medium rounded-lg hover:bg-emerald-900 cursor-pointer"
            >
              Select Bill File
            </button>
          </>
        )}
      </div>

      {/* Extraction Error Banner with preserved retry capability */}
      {extractError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-900">
              <p className="font-semibold">Bill Extraction Notice</p>
              <p className="mt-0.5">
                {extractError} You can click Retry Extraction or fill in the bill details manually below.
              </p>
            </div>
          </div>
          {selectedFile && (
            <button
              type="button"
              disabled={processing}
              onClick={handleRetryExtraction}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-300 text-rose-900 text-xs font-medium rounded-lg hover:bg-rose-100 shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Extraction
            </button>
          )}
        </div>
      )}

      {unreadableNotice && !extractError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <p className="font-semibold">Low-Clarity or Incomplete Electricity Bill Detected</p>
            <p className="mt-0.5">
              Key consumption or billing fields could not be confidently read from this file. Verify the preview alongside the highlighted fields, retry with a clearer scan, or enter values manually.
            </p>
          </div>
        </div>
      )}

      {/* Side-by-Side Bill Preview + Editable Review Form */}
      {draft && selectedFile && !processing && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Uploaded Bill Preview & Extraction Confidence */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4 lg:sticky lg:top-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-900 truncate pr-2">{selectedFile.name}</span>
              <span className="font-mono shrink-0">{(selectedFile.size / 1024).toFixed(1)} KB</span>
            </div>

            {isPdfSelected ? (
              <iframe
                src={previewUrl}
                title="Uploaded PDF Bill Preview"
                className="w-full h-[500px] rounded-lg border border-slate-200 bg-slate-50"
              />
            ) : (
              <img
                src={previewUrl}
                alt="Uploaded electricity bill preview"
                className="w-full max-h-[500px] object-contain rounded-lg border border-slate-200 bg-slate-50"
              />
            )}

            {confidence && (
              <div className="pt-3 border-t border-slate-200 space-y-2 text-xs">
                <p className="font-semibold text-slate-900">AI Extraction Confidence</p>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div>
                    Overall:{' '}
                    <span className="font-mono font-medium text-slate-900 capitalize">
                      {confidence.overall || 'medium'}
                    </span>
                  </div>
                  <div>
                    Identity:{' '}
                    <span className="font-mono font-medium text-slate-900 capitalize">
                      {confidence.identity || 'medium'}
                    </span>
                  </div>
                  <div>
                    Consumption:{' '}
                    <span className="font-mono font-medium text-slate-900 capitalize">
                      {confidence.consumption || 'medium'}
                    </span>
                  </div>
                  <div>
                    Charges:{' '}
                    <span className="font-mono font-medium text-slate-900 capitalize">
                      {confidence.charges || 'medium'}
                    </span>
                  </div>
                </div>
                {confidence.uncertainFields && confidence.uncertainFields.length > 0 && (
                  <p className="text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    Uncertain / verify: {confidence.uncertainFields.join(', ')}
                  </p>
                )}
              </div>
            )}

            {extractionNotes.length > 0 && (
              <div className="pt-3 border-t border-slate-200 space-y-1.5 text-xs">
                <p className="font-semibold text-slate-900">Parser Extraction Notes</p>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  {extractionNotes.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right: Editable Extracted Fields & Action Controls */}
          <form
            onSubmit={handleConfirmSave}
            className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Extraction Review &amp; Verification
                </h2>
                <p className="text-xs text-slate-500">
                  Missing or uncertain fields are highlighted in amber. Confirm accuracy before saving.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleEditDetails}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                    editHighlightActive
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Details
                </button>
                <button
                  type="button"
                  onClick={handleRetryExtraction}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Extraction
                </button>
              </div>
            </div>

            {fieldGroups.map((group) => (
              <div key={group.heading} className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {group.heading}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  {group.fields.map((field, idx) => {
                    const val = draft[field.key];
                    const isMissing = !val.trim();
                    const isUncertain = uncertainFieldsSet.has(field.key.toLowerCase());
                    const highlightAmber = isMissing || isUncertain;
                    const isFirst = group.heading === 'Consumer & Provider Details' && idx === 0;

                    return (
                      <div key={field.key}>
                        <label className="flex items-center justify-between font-medium text-slate-700 mb-1">
                          <span>{field.label}</span>
                          {isUncertain ? (
                            <span className="text-[11px] font-mono text-amber-800">verify</span>
                          ) : isMissing ? (
                            <span className="text-[11px] font-mono text-amber-700">missing</span>
                          ) : null}
                        </label>
                        <input
                          ref={isFirst ? firstInputRef : undefined}
                          type={field.type}
                          step="any"
                          min={field.type === 'number' ? 0 : undefined}
                          required={field.required}
                          value={val}
                          onChange={(e) => {
                            if (
                              field.key === 'previousReading' ||
                              field.key === 'currentReading' ||
                              field.key === 'unitsConsumed'
                            ) {
                              updateReadingAndMaybeComputeUnits(field.key, e.target.value);
                            } else {
                              setDraft({ ...draft, [field.key]: e.target.value });
                            }
                          }}
                          placeholder={isMissing ? 'Not detected — enter manually' : ''}
                          className={`w-full px-3 py-2 text-sm border rounded-lg tabular-nums transition-colors ${
                            highlightAmber
                              ? 'border-amber-300 bg-amber-50/40 focus:border-emerald-700'
                              : 'border-slate-300 bg-white focus:border-emerald-700'
                          }`}
                        />
                        {field.key === 'unitsConsumed' && unitsAutoCalculated && (
                          <p className="text-[11px] text-emerald-800 mt-1">
                            Auto-calculated from meter readings (Current − Previous)
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Tariff / Slab Details */}
            <div className="space-y-1.5 text-xs">
              <label className="flex items-center justify-between font-medium text-slate-700">
                <span>Tariff / Slab Details (one entry per line)</span>
                {!draft.tariffDetailsText.trim() && (
                  <span className="text-[11px] font-mono text-amber-700">optional</span>
                )}
              </label>
              <textarea
                rows={3}
                value={draft.tariffDetailsText}
                onChange={(e) => setDraft({ ...draft, tariffDetailsText: e.target.value })}
                placeholder="e.g. Slab 0-100 kWh @ ₹4.20/unit&#10;Sanctioned Load: 5 kW"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
              />
            </div>

            {tariffCrossCheck && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <p className="font-semibold text-slate-900">
                  Dynamic Tariff Engine Audit Cross-Check ({tariffCrossCheck.policyUsed.discom})
                </p>
                <p className="text-slate-600 tabular-nums">
                  Benchmark payable for {tariffCrossCheck.totalKwh} kWh:{' '}
                  <span className="font-mono font-semibold text-slate-900">
                    ₹{tariffCrossCheck.totalPayableInr.toLocaleString()}
                  </span>{' '}
                  (Base ₹{tariffCrossCheck.baseEnergyCharge} + Fixed ₹{tariffCrossCheck.fixedCharge} + Tax ₹
                  {tariffCrossCheck.electricityDutyTax} + Carbon Tax ₹{tariffCrossCheck.dynamicCarbonTax} − Subsidy ₹
                  {tariffCrossCheck.subsidyCredit}) · Est. {tariffCrossCheck.carbonEmissionKg} kg CO₂e
                </p>
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={syncToConsumption}
                onChange={(e) => setSyncToConsumption(e.target.checked)}
                className="rounded border-slate-300 text-emerald-700"
              />
              Sync verified consumption ({draft.unitsConsumed || 0} kWh) directly to monthly consumption ledger
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleCancelUpload}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Cancel Upload
              </button>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleRetryExtraction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Extraction
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 text-white text-xs font-medium rounded-lg hover:bg-emerald-900 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Uploading & Saving...' : 'Confirm and Save'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Post-Extraction Gemini AI Bill Analysis Section */}
      {(analysisLoading || billAnalysis || analysisError) && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                <span>Post-Extraction Bill Intelligence</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-slate-700">
                  {lastSavedBill ? 'CONFIRMED BILL DATA' : 'DRAFT REVIEW DATA'}
                </span>
              </div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Bill Breakdown &amp; AI Cost-Saving Insights
              </h2>
            </div>
            {lastSavedBill && (
              <span className="text-xs font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                Saved: {lastSavedBill.unitsConsumed ?? lastSavedBill.totalConsumptionKwh} kWh · ₹
                {lastSavedBill.totalBillAmount.toLocaleString()}
              </span>
            )}
          </div>

          {analysisLoading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-slate-100 rounded-lg" />
              ))}
            </div>
          )}

          {analysisError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              {analysisError}
            </div>
          )}

          {!analysisLoading && billAnalysis && (
            <div className="space-y-5">
              {/* Factual Summary & Historical Delta */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                  <p className="font-semibold text-slate-900 uppercase tracking-wider text-[11px]">
                    Factual Bill Summary
                  </p>
                  <p className="text-slate-700 leading-relaxed">{billAnalysis.billSummary}</p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                  <p className="font-semibold text-slate-900 uppercase tracking-wider text-[11px]">
                    Comparison vs Previous Bills
                  </p>
                  <p className="text-slate-700 leading-relaxed">{billAnalysis.consumptionComparison}</p>
                </div>
              </div>

              {/* Main Cost Contributors */}
              {billAnalysis.mainContributors && billAnalysis.mainContributors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-900">Main Cost Contributors</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    {billAnalysis.mainContributors.map((c, idx) => (
                      <div key={idx} className="p-3.5 border border-slate-200 rounded-lg bg-white">
                        <p className="text-slate-500 font-medium">{c.label}</p>
                        <p className="font-mono text-base font-bold text-slate-900 tabular-nums mt-0.5">
                          {c.amountInr !== null && c.amountInr !== undefined
                            ? `₹${c.amountInr.toLocaleString()}`
                            : 'Included'}
                        </p>
                        <p className="text-[11px] text-slate-600 mt-1">{c.shareNote}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI-Generated Saving Opportunities */}
              {billAnalysis.savingOpportunities && billAnalysis.savingOpportunities.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-900">
                    AI-Suggested Energy-Saving Opportunities
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    {billAnalysis.savingOpportunities.map((opp, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-1.5"
                      >
                        <p className="font-semibold text-emerald-950">{opp.title}</p>
                        <p className="text-slate-700 leading-relaxed">{opp.detail}</p>
                        {opp.estimatedMonthlySavingsInr !== null &&
                          opp.estimatedMonthlySavingsInr !== undefined && (
                            <p className="font-mono font-semibold text-emerald-800 pt-1 tabular-nums">
                              Est. Save: ₹{opp.estimatedMonthlySavingsInr.toLocaleString()}/month
                            </p>
                          )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700 pt-1">
                <p>
                  <span className="font-semibold text-slate-900">Carbon Footprint: </span>
                  {billAnalysis.estimatedCarbonSummary}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Tariff Context: </span>
                  {billAnalysis.tariffInsights}
                </p>
              </div>

              <p className="text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                {billAnalysis.factualBasisNote}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Saved Verified Bills Ledger */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-display text-base font-semibold text-slate-900 mb-4">
          Verified Electricity Bills ({bills.length})
        </h2>
        {bills.length === 0 ? (
          <p className="text-xs text-slate-500">
            No verified bills archived yet. Upload a PDF or image utility bill above to extract, verify, and persist your billing history.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 pr-4 font-medium">Billing Month / File</th>
                  <th className="py-2.5 pr-4 font-medium">Provider · Location</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Units (kWh)</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Total Bill (₹)</th>
                  <th className="py-2.5 pr-4 font-medium">Status</th>
                  <th className="py-2.5 font-medium text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2 font-medium text-slate-900">
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{b.billingMonth || b.billingPeriod || b.fileName}</span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {b.billDate || b.billIssueDate || b.fileName}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-700">
                      {b.provider || b.electricityProvider || '—'} ·{' '}
                      {[b.city, b.state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums font-medium text-slate-900">
                      {(b.unitsConsumed ?? b.totalConsumptionKwh).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums font-medium text-slate-900">
                      ₹{b.totalBillAmount.toLocaleString()}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {b.paymentStatus || 'Verified'}
                      </span>
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedHistoryBill(b)}
                        className="inline-flex items-center gap-1 text-emerald-800 hover:underline font-medium cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Saved Bill Details Modal */}
      {selectedHistoryBill && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  {selectedHistoryBill.billingMonth ||
                    selectedHistoryBill.billingPeriod ||
                    selectedHistoryBill.fileName}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedHistoryBill.provider || selectedHistoryBill.electricityProvider || 'Utility'} · Consumer #{selectedHistoryBill.consumerNumber || '—'} · Meter #{selectedHistoryBill.meterNumber || '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistoryBill(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-slate-500">Units Consumed</p>
                <p className="font-mono text-base font-bold text-slate-900 tabular-nums">
                  {(selectedHistoryBill.unitsConsumed ?? selectedHistoryBill.totalConsumptionKwh).toLocaleString()} kWh
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-slate-500">Total Bill</p>
                <p className="font-mono text-base font-bold text-slate-900 tabular-nums">
                  ₹{selectedHistoryBill.totalBillAmount.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-slate-500">Energy Charges</p>
                <p className="font-mono text-base font-bold text-slate-900 tabular-nums">
                  {selectedHistoryBill.energyCharges !== null
                    ? `₹${selectedHistoryBill.energyCharges.toLocaleString()}`
                    : '—'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-slate-500">Fixed + Demand</p>
                <p className="font-mono text-base font-bold text-slate-900 tabular-nums">
                  ₹
                  {(
                    (selectedHistoryBill.fixedCharges || 0) +
                    (selectedHistoryBill.demandCharges || 0)
                  ).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs text-slate-700">
              <div>Prev Reading: <span className="font-mono">{selectedHistoryBill.previousReading ?? selectedHistoryBill.previousMeterReading ?? '—'}</span></div>
              <div>Curr Reading: <span className="font-mono">{selectedHistoryBill.currentReading ?? selectedHistoryBill.currentMeterReading ?? '—'}</span></div>
              <div>Fuel Adj: <span className="font-mono">{selectedHistoryBill.fuelAdjustmentCharges !== null && selectedHistoryBill.fuelAdjustmentCharges !== undefined ? `₹${selectedHistoryBill.fuelAdjustmentCharges}` : '—'}</span></div>
              <div>Duty / Taxes: <span className="font-mono">₹{((selectedHistoryBill.electricityDuty || 0) + (selectedHistoryBill.taxes || 0)).toLocaleString()}</span></div>
              <div>Subsidies: <span className="font-mono">{selectedHistoryBill.subsidies !== null ? `₹${selectedHistoryBill.subsidies}` : '—'}</span></div>
              <div>Due Date: <span className="font-mono">{selectedHistoryBill.dueDate || '—'}</span></div>
            </div>

            {selectedHistoryBill.tariffDetails && selectedHistoryBill.tariffDetails.length > 0 && (
              <div className="text-xs space-y-1">
                <p className="font-semibold text-slate-900">Tariff Details</p>
                <ul className="list-disc pl-4 text-slate-600 space-y-0.5">
                  {selectedHistoryBill.tariffDetails.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-xs">
              <span className="text-slate-500 font-mono">
                Status: {selectedHistoryBill.extractionStatus || 'confirmed'}
              </span>
              {selectedHistoryBill.storageUrl && (
                <a
                  href={selectedHistoryBill.storageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-emerald-800 font-medium hover:underline"
                >
                  Open Stored Bill File
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
