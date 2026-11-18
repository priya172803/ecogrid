export type UserRole = 'domestic' | 'commercial' | 'industrial' | 'government_admin';
export type ConsumerCategory = 'domestic' | 'commercial' | 'industrial';
export type GranularityType = 'hourly' | 'daily' | 'monthly';
export type PeakClassification = 'peak' | 'off_peak' | 'normal';

export interface DomesticProfile {
  householdSize: number;
  sqFt: number;
  appliances: string[];
  hvacUsageHours: number;
  wfhMembers: number;
  solarCapacityKw: number;
}

export interface CommercialProfile {
  businessType: string;
  floorAreaSqFt: number;
  openTime: string;
  closeTime: string;
  operatingDaysPerWeek: number;
  occupancyCount: number;
  commercialLoads: string[];
  sanctionedLoadKw: number;
}

export interface IndustrialProfile {
  industryType: string;
  shiftsPerDay: 1 | 2 | 3;
  processes: string[];
  contractDemandKva: number;
  powerFactor: number;
  hasBackupGenerator: boolean;
  solarCapacityKw: number;
}

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  role: UserRole;
  category: ConsumerCategory;
  state: string;
  city: string;
  pinCode: string;
  discom: string;
  consumerId: string;
  propertyType: string;
  rewardPointsBalance: number;
  totalCarbonOffsetKg: number;
  totalBillDiscountInr: number;
  domesticProfile?: DomesticProfile;
  commercialProfile?: CommercialProfile;
  industrialProfile?: IndustrialProfile;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface EnergyRecord {
  id: string;
  userId: string;
  category: ConsumerCategory;
  granularity: GranularityType;
  date: string;
  kwh: number;
  timePeriod: string;
  peakType: PeakClassification;
  estimatedCostInr: number;
  carbonKg: number;
  source: 'manual' | 'bill_sync';
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BillExtractionConfidence {
  overall?: string;
  identity?: string;
  consumption?: string;
  charges?: string;
  uncertainFields?: string[];
}

export interface ExtractedBillPayload {
  consumerName: string | null;
  consumerNumber: string | null;
  provider: string | null;
  state: string | null;
  city: string | null;
  consumerCategory: string | null;
  tariffType: string | null;
  billingMonth: string | null;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  billDate: string | null;
  dueDate: string | null;
  previousReading: number | null;
  currentReading: number | null;
  unitsConsumed: number | null;
  previousMonthConsumption: number | null;
  energyCharges: number | null;
  fixedCharges: number | null;
  demandCharges: number | null;
  fuelAdjustmentCharges: number | null;
  electricityDuty: number | null;
  taxes: number | null;
  otherCharges: number | null;
  subsidies: number | null;
  lateFees: number | null;
  totalBillAmount: number | null;
  paymentStatus: string | null;
  meterNumber: string | null;
  tariffDetails: string[];
  extractionNotes: string[];
  confidence: BillExtractionConfidence;
}

export interface ElectricityBill {
  id: string;
  userId: string;
  fileName: string;
  fileType: string;
  storageUrl: string;
  storagePath?: string | null;
  consumerName: string | null;
  consumerNumber: string | null;
  provider: string | null;
  electricityProvider?: string | null;
  state: string | null;
  city?: string | null;
  consumerCategory: string | null;
  tariffType?: string | null;
  billingMonth?: string | null;
  billingPeriod?: string | null;
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
  billDate?: string | null;
  billIssueDate?: string | null;
  dueDate: string | null;
  previousReading?: number | null;
  previousMeterReading?: number | null;
  currentReading?: number | null;
  currentMeterReading?: number | null;
  unitsConsumed: number | null;
  totalConsumptionKwh: number;
  previousMonthConsumption?: number | null;
  previousMonthConsumptionKwh?: number | null;
  energyCharges: number | null;
  fixedCharges: number | null;
  demandCharges?: number | null;
  fuelAdjustmentCharges?: number | null;
  electricityDuty?: number | null;
  taxes: number | null;
  otherCharges: number | null;
  subsidies: number | null;
  lateFees?: number | null;
  totalBillAmount: number;
  paymentStatus?: string | null;
  meterNumber?: string | null;
  tariffDetails?: string[];
  extractionNotes?: string[];
  confidence?: BillExtractionConfidence;
  extractionStatus?: 'confirmed' | 'partial' | 'manual_override';
  extractedData?: Record<string, unknown> | null;
  confirmedData?: Record<string, unknown> | null;
  verifiedByUser: boolean;
  uploadedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BillAnalysisResponse {
  billSummary: string;
  mainContributors: {
    label: string;
    amountInr: number | null;
    shareNote: string;
  }[];
  consumptionComparison: string;
  savingOpportunities: {
    title: string;
    detail: string;
    estimatedMonthlySavingsInr: number | null;
  }[];
  estimatedCarbonSummary: string;
  tariffInsights: string;
  factualBasisNote: string;
}

export interface TariffSlab {
  upToKwh: number; // Use 999999 for open-ended upper slab
  ratePerKwh: number;
}

export interface TariffPolicy {
  id: string;
  state: string;
  category: ConsumerCategory;
  discom: string;
  fixedChargePerMonth: number;
  demandChargePerKva: number;
  taxRatePercent: number;
  carbonTaxThresholdKwh: number;
  carbonTaxRatePerKwh: number;
  peakHourSurchargePercent: number;
  offPeakRebatePercent: number;
  subsidyUnitsLimit: number;
  subsidyDiscountPerKwh: number;
  gridEmissionFactorKgPerKwh: number;
  slabs: TariffSlab[];
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface TariffCalculationInput {
  kwh: number;
  category: ConsumerCategory;
  state: string;
  discom?: string;
  peakShareRatio: number; // 0..1
  offPeakShareRatio: number; // 0..1
  contractDemandKva?: number;
  powerFactor?: number;
  solarCapacityKw?: number;
  appliedDiscountInr?: number;
  customPolicy?: TariffPolicy;
}

export interface TariffSlabBreakdown {
  label: string;
  units: number;
  ratePerKwh: number;
  amount: number;
}

export interface TariffCalculationResult {
  policyUsed: TariffPolicy;
  totalKwh: number;
  slabBreakdown: TariffSlabBreakdown[];
  baseEnergyCharge: number;
  peakSurcharge: number;
  offPeakRebate: number;
  fixedCharge: number;
  demandCharge: number;
  powerFactorAdjustment: number; // positive = penalty, negative = incentive
  electricityDutyTax: number;
  dynamicCarbonTax: number;
  subsidyCredit: number;
  solarOffsetCredit: number;
  voucherDiscount: number;
  totalPayableInr: number;
  effectiveRatePerKwh: number;
  carbonEmissionKg: number;
}

export interface ForecastPoint {
  label: string;
  actualKwh: number | null;
  predictedKwh: number;
  lowerBoundKwh: number;
  upperBoundKwh: number;
  predictedCostInr: number;
  isPeakRisk: boolean;
}

export interface ForecastResult {
  hasSufficientData: boolean;
  dataPointsUsed: number;
  dataQualityMessage: string;
  algorithmSummary: string;
  nextMonthKwh: number;
  nextMonthLowerKwh: number;
  nextMonthUpperKwh: number;
  nextMonthBillEstimateInr: number;
  sevenDayTotalKwh: number;
  likelyPeakWindows: string[];
  daily7Day: ForecastPoint[];
  daily30Day: ForecastPoint[];
  monthly3Month: ForecastPoint[];
}

export interface OffsetRewardItem {
  id: string;
  title: string;
  description: string;
  rewardType: 'carbon_offset' | 'bill_discount';
  pointsCost: number;
  carbonOffsetKg: number;
  discountInr: number;
  partnerProgram: string;
}

export interface OffsetRedemption {
  id: string;
  userId: string;
  rewardId: string;
  rewardTitle: string;
  rewardType: 'carbon_offset' | 'bill_discount';
  pointsSpent: number;
  carbonOffsetKg: number;
  discountInr: number;
  certificateCode: string;
  status: 'completed' | 'applied';
  createdAt?: unknown;
}

export interface PolicyAdvisory {
  id: string;
  title: string;
  message: string;
  targetCategory: 'all' | ConsumerCategory;
  targetState: string;
  severity: 'info' | 'advisory' | 'peak_alert';
  createdBy: string;
  createdAt?: unknown;
}

export interface AIInsightsResponse {
  headline: string;
  insights: {
    title: string;
    detail: string;
    estimatedMonthlySavingsInr: number;
    estimatedCarbonReductionKg: number;
    priority: string;
  }[];
  profileSpecificAction: string;
  tariffOptimizationTip: string;
}
