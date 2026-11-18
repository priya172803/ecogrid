import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import type {
  ConsumerCategory,
  ElectricityBill,
  EnergyRecord,
  OffsetRedemption,
  OffsetRewardItem,
  PolicyAdvisory,
  TariffPolicy,
  UserProfile,
} from '../types/energy';
import { calculateDynamicTariff } from '../utils/tariffEngine';
import { useToast } from './ToastContext';

const BOOTSTRAPPED_ADMIN_EMAIL = 'vishnuachar74@gmail.com';

interface AuthContextValue {
  authReady: boolean;
  firebaseUser: User | null;
  profile: UserProfile | null;
  profileLoading: boolean;
  isAdmin: boolean;
  energyRecords: EnergyRecord[];
  bills: ElectricityBill[];
  redemptions: OffsetRedemption[];
  tariffPolicies: TariffPolicy[];
  advisories: PolicyAdvisory[];
  allConsumerSummaries: UserProfile[];
  allRecordsAdmin: EnergyRecord[];
  useDemoPreview: boolean;
  setUseDemoPreview: (val: boolean) => void;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, initialProfile: Omit<UserProfile, 'uid' | 'role' | 'rewardPointsBalance' | 'totalCarbonOffsetKg' | 'totalBillDiscountInr' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshUserVerification: () => Promise<boolean>;
  logout: () => Promise<void>;
  saveProfile: (input: Omit<UserProfile, 'uid' | 'role' | 'rewardPointsBalance' | 'totalCarbonOffsetKg' | 'totalBillDiscountInr' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  addEnergyRecord: (input: {
    category: ConsumerCategory;
    granularity: 'hourly' | 'daily' | 'monthly';
    date: string;
    kwh: number;
    timePeriod: string;
    peakType: 'peak' | 'off_peak' | 'normal';
    notes: string;
    source?: 'manual' | 'bill_sync';
  }) => Promise<void>;
  updateEnergyRecord: (
    id: string,
    patch: {
      category: ConsumerCategory;
      granularity: 'hourly' | 'daily' | 'monthly';
      date: string;
      kwh: number;
      timePeriod: string;
      peakType: 'peak' | 'off_peak' | 'normal';
      notes: string;
    }
  ) => Promise<void>;
  deleteEnergyRecord: (id: string) => Promise<void>;
  saveElectricityBill: (
    bill: Omit<ElectricityBill, 'id' | 'userId' | 'uploadedAt' | 'createdAt' | 'updatedAt'>,
    syncToConsumption: boolean
  ) => Promise<ElectricityBill | undefined>;
  redeemOffsetReward: (reward: OffsetRewardItem) => Promise<OffsetRedemption>;
  creditRewardPoints: (pointsToAdd: number) => Promise<void>;
  upsertTariffPolicy: (policy: Omit<TariffPolicy, 'updatedBy' | 'updatedAt'>) => Promise<void>;
  deleteTariffPolicy: (policyId: string) => Promise<void>;
  publishAdvisory: (advisory: Omit<PolicyAdvisory, 'id' | 'createdBy' | 'createdAt'>) => Promise<void>;
  deleteAdvisory: (advisoryId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function makeCleanId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeOptionalNumber(val: number | null | undefined): number | null {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return null;
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(100000000, n);
}

function sanitizeOptionalString(val: string | null | undefined, maxLen: number): string | null {
  if (val === null || val === undefined) return null;
  const trimmed = String(val).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function sanitizeStringList(val: string[] | undefined | null, maxItems: number, maxItemLen: number): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .map((s) => String(s ?? '').trim().slice(0, maxItemLen))
    .filter((s) => s.length > 0)
    .slice(0, maxItems);
}

function sanitizeConfidence(conf: unknown): Record<string, unknown> | null {
  if (!conf || typeof conf !== 'object') return null;
  const c = conf as Record<string, unknown>;
  return {
    overall: sanitizeOptionalString(c.overall as string, 24),
    identity: sanitizeOptionalString(c.identity as string, 24),
    consumption: sanitizeOptionalString(c.consumption as string, 24),
    charges: sanitizeOptionalString(c.charges as string, 24),
    uncertainFields: sanitizeStringList(c.uncertainFields as string[], 35, 60),
  };
}

function sanitizeBillSnapshot(raw: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    consumerName: sanitizeOptionalString(raw.consumerName as string, 120),
    consumerNumber: sanitizeOptionalString(raw.consumerNumber as string, 80),
    provider: sanitizeOptionalString((raw.provider ?? raw.electricityProvider) as string, 120),
    state: sanitizeOptionalString(raw.state as string, 80),
    city: sanitizeOptionalString(raw.city as string, 80),
    consumerCategory: sanitizeOptionalString(raw.consumerCategory as string, 60),
    tariffType: sanitizeOptionalString(raw.tariffType as string, 80),
    billingMonth: sanitizeOptionalString(raw.billingMonth as string, 40),
    billingPeriodStart: sanitizeOptionalString(raw.billingPeriodStart as string, 40),
    billingPeriodEnd: sanitizeOptionalString(raw.billingPeriodEnd as string, 40),
    billDate: sanitizeOptionalString((raw.billDate ?? raw.billIssueDate) as string, 40),
    dueDate: sanitizeOptionalString(raw.dueDate as string, 40),
    previousReading: sanitizeOptionalNumber((raw.previousReading ?? raw.previousMeterReading) as number),
    currentReading: sanitizeOptionalNumber((raw.currentReading ?? raw.currentMeterReading) as number),
    unitsConsumed: sanitizeOptionalNumber(raw.unitsConsumed as number),
    previousMonthConsumption: sanitizeOptionalNumber(
      (raw.previousMonthConsumption ?? raw.previousMonthConsumptionKwh) as number
    ),
    energyCharges: sanitizeOptionalNumber(raw.energyCharges as number),
    fixedCharges: sanitizeOptionalNumber(raw.fixedCharges as number),
    demandCharges: sanitizeOptionalNumber(raw.demandCharges as number),
    fuelAdjustmentCharges: sanitizeOptionalNumber(raw.fuelAdjustmentCharges as number),
    electricityDuty: sanitizeOptionalNumber(raw.electricityDuty as number),
    taxes: sanitizeOptionalNumber(raw.taxes as number),
    otherCharges: sanitizeOptionalNumber(raw.otherCharges as number),
    subsidies: sanitizeOptionalNumber(raw.subsidies as number),
    lateFees: sanitizeOptionalNumber(raw.lateFees as number),
    totalBillAmount: sanitizeOptionalNumber(raw.totalBillAmount as number),
    paymentStatus: sanitizeOptionalString(raw.paymentStatus as string, 60),
    meterNumber: sanitizeOptionalString(raw.meterNumber as string, 80),
    tariffDetails: sanitizeStringList(raw.tariffDetails as string[], 15, 240),
    extractionNotes: sanitizeStringList(raw.extractionNotes as string[], 15, 300),
    confidence: sanitizeConfidence(raw.confidence),
  };
}

function resolveBillRecordDate(bill: {
  billDate?: string | null;
  billIssueDate?: string | null;
  billingPeriodEnd?: string | null;
  billingMonth?: string | null;
}): string {
  const candidates = [bill.billDate, bill.billIssueDate, bill.billingPeriodEnd];
  for (const c of candidates) {
    if (c && /^\d{4}-\d{2}-\d{2}$/.test(c.trim())) return c.trim();
  }
  if (bill.billingMonth && /^\d{4}-\d{2}$/.test(bill.billingMonth.trim())) {
    return `${bill.billingMonth.trim()}-01`;
  }
  return new Date().toISOString().slice(0, 10);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isAdminDoc, setIsAdminDoc] = useState(false);

  const [energyRecords, setEnergyRecords] = useState<EnergyRecord[]>([]);
  const [bills, setBills] = useState<ElectricityBill[]>([]);
  const [redemptions, setRedemptions] = useState<OffsetRedemption[]>([]);
  const [tariffPolicies, setTariffPolicies] = useState<TariffPolicy[]>([]);
  const [advisories, setAdvisories] = useState<PolicyAdvisory[]>([]);
  const [allConsumerSummaries, setAllConsumerSummaries] = useState<UserProfile[]>([]);
  const [allRecordsAdmin, setAllRecordsAdmin] = useState<EnergyRecord[]>([]);
  const [useDemoPreview, setUseDemoPreview] = useState(false);

  const isBootstrappedAdmin =
    Boolean(firebaseUser?.emailVerified) &&
    firebaseUser?.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;

  const isAdmin = Boolean(
    firebaseUser?.emailVerified &&
      (isBootstrappedAdmin || isAdminDoc || profile?.role === 'government_admin')
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setProfile(null);
        setIsAdminDoc(false);
        setEnergyRecords([]);
        setBills([]);
        setRedemptions([]);
        setAllConsumerSummaries([]);
        setAllRecordsAdmin([]);
        setProfileLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Listen to user's own profile & admin doc
  useEffect(() => {
    if (!authReady || !firebaseUser) return;
    setProfileLoading(true);

    const userRef = doc(db, 'users', firebaseUser.uid);
    const unsubUser = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        } else {
          setProfile(null);
        }
        setProfileLoading(false);
      },
      (err) => {
        setProfileLoading(false);
        handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
      }
    );

    const adminRef = doc(db, 'admins', firebaseUser.uid);
    const unsubAdmin = onSnapshot(
      adminRef,
      (snap) => {
        setIsAdminDoc(snap.exists());
      },
      () => {
        // Non-admins may not have an admin doc; ignore permission-denied on non-existent admin probe
        setIsAdminDoc(false);
      }
    );

    return () => {
      unsubUser();
      unsubAdmin();
    };
  }, [authReady, firebaseUser]);

  // Listen to user-owned energyRecords, bills, redemptions, and system tariffPolicies & advisories
  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const recordsQ = query(
      collection(db, 'energyRecords'),
      where('userId', '==', firebaseUser.uid)
    );
    const unsubRecords = onSnapshot(
      recordsQ,
      (snap) => {
        const list: EnergyRecord[] = snap.docs.map((d) => ({
          ...(d.data() as Omit<EnergyRecord, 'id'>),
          id: d.id,
        }));
        list.sort((a, b) => b.date.localeCompare(a.date));
        setEnergyRecords(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'energyRecords')
    );

    const billsQ = query(collection(db, 'bills'), where('userId', '==', firebaseUser.uid));
    const unsubBills = onSnapshot(
      billsQ,
      (snap) => {
        const list: ElectricityBill[] = snap.docs.map((d) => ({
          ...(d.data() as Omit<ElectricityBill, 'id'>),
          id: d.id,
        }));
        list.sort((a, b) => {
          const da = a.billingMonth || a.billDate || a.billIssueDate || '';
          const dbVal = b.billingMonth || b.billDate || b.billIssueDate || '';
          return dbVal.localeCompare(da);
        });
        setBills(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'bills')
    );

    const redemptionsQ = query(
      collection(db, 'offsetRedemptions'),
      where('userId', '==', firebaseUser.uid)
    );
    const unsubRedemptions = onSnapshot(
      redemptionsQ,
      (snap) => {
        const list: OffsetRedemption[] = snap.docs.map((d) => ({
          ...(d.data() as Omit<OffsetRedemption, 'id'>),
          id: d.id,
        }));
        setRedemptions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'offsetRedemptions')
    );

    const policiesQ = query(
      collection(db, 'tariffPolicies'),
      where('category', 'in', ['domestic', 'commercial', 'industrial'])
    );
    const unsubPolicies = onSnapshot(
      policiesQ,
      (snap) => {
        const list: TariffPolicy[] = snap.docs.map((d) => ({
          ...(d.data() as Omit<TariffPolicy, 'id'>),
          id: d.id,
        }));
        setTariffPolicies(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'tariffPolicies')
    );

    const advisoriesQ = query(
      collection(db, 'policyAdvisories'),
      where('targetCategory', 'in', ['all', 'domestic', 'commercial', 'industrial'])
    );
    const unsubAdvisories = onSnapshot(
      advisoriesQ,
      (snap) => {
        const list: PolicyAdvisory[] = snap.docs.map((d) => ({
          ...(d.data() as Omit<PolicyAdvisory, 'id'>),
          id: d.id,
        }));
        setAdvisories(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'policyAdvisories')
    );

    return () => {
      unsubRecords();
      unsubBills();
      unsubRedemptions();
      unsubPolicies();
      unsubAdvisories();
    };
  }, [authReady, firebaseUser]);

  // Admin-only aggregated snapshots (only fetched if isBootstrappedAdmin / verified admin)
  useEffect(() => {
    if (!authReady || !firebaseUser || !isAdmin) return;
    let active = true;
    const loadAdminAggregates = async () => {
      try {
        if (isBootstrappedAdmin) {
          const usersSnap = await getDocs(collection(db, 'users'));
          if (active) {
            setAllConsumerSummaries(usersSnap.docs.map((d) => d.data() as UserProfile));
          }
          const recSnap = await getDocs(collection(db, 'energyRecords'));
          if (active) {
            setAllRecordsAdmin(
              recSnap.docs.map((d) => ({ ...(d.data() as Omit<EnergyRecord, 'id'>), id: d.id }))
            );
          }
        }
      } catch (err) {
        console.warn('Admin aggregate load notice:', err);
      }
    };
    loadAdminAggregates();
    return () => {
      active = false;
    };
  }, [authReady, firebaseUser, isAdmin, isBootstrappedAdmin]);

  const loginWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, []);

  const loginWithEmail = useCallback(async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  }, []);

  const saveProfileInternal = useCallback(
    async (
      uid: string,
      email: string,
      input: Omit<
        UserProfile,
        | 'uid'
        | 'role'
        | 'rewardPointsBalance'
        | 'totalCarbonOffsetKg'
        | 'totalBillDiscountInr'
        | 'createdAt'
        | 'updatedAt'
      >,
      existingProfile: UserProfile | null
    ) => {
      const userRef = doc(db, 'users', uid);
      const safeRole =
        existingProfile?.role === 'government_admin'
          ? 'government_admin'
          : input.category;

      const cleanPayload: Record<string, unknown> = {
        uid,
        fullName: input.fullName.trim().slice(0, 120),
        email: email.trim().slice(0, 160),
        role: safeRole,
        category: input.category,
        state: input.state.trim().slice(0, 80),
        city: input.city.trim().slice(0, 80),
        pinCode: input.pinCode.trim().slice(0, 12),
        discom: input.discom.trim().slice(0, 100),
        consumerId: (input.consumerId || '').trim().slice(0, 60),
        propertyType: (input.propertyType || '').trim().slice(0, 80),
        rewardPointsBalance: existingProfile?.rewardPointsBalance ?? 250, // Welcome eco-onboarding credit
        totalCarbonOffsetKg: existingProfile?.totalCarbonOffsetKg ?? 0,
        totalBillDiscountInr: existingProfile?.totalBillDiscountInr ?? 0,
        updatedAt: serverTimestamp(),
      };

      if (input.category === 'domestic' && input.domesticProfile) {
        cleanPayload.domesticProfile = {
          householdSize: Math.max(1, Math.min(50, Number(input.domesticProfile.householdSize) || 1)),
          sqFt: Math.max(100, Math.min(50000, Number(input.domesticProfile.sqFt) || 1000)),
          appliances: (input.domesticProfile.appliances || []).slice(0, 20),
          hvacUsageHours: Math.max(0, Math.min(24, Number(input.domesticProfile.hvacUsageHours) || 0)),
          wfhMembers: Math.max(0, Math.min(30, Number(input.domesticProfile.wfhMembers) || 0)),
          solarCapacityKw: Math.max(0, Math.min(100, Number(input.domesticProfile.solarCapacityKw) || 0)),
        };
      } else if (input.category === 'commercial' && input.commercialProfile) {
        cleanPayload.commercialProfile = {
          businessType: (input.commercialProfile.businessType || 'Office / IT').slice(0, 80),
          floorAreaSqFt: Math.max(100, Math.min(1000000, Number(input.commercialProfile.floorAreaSqFt) || 1500)),
          openTime: (input.commercialProfile.openTime || '09:00').slice(0, 16),
          closeTime: (input.commercialProfile.closeTime || '20:00').slice(0, 16),
          operatingDaysPerWeek: Math.max(1, Math.min(7, Number(input.commercialProfile.operatingDaysPerWeek) || 6)),
          occupancyCount: Math.max(1, Math.min(50000, Number(input.commercialProfile.occupancyCount) || 10)),
          commercialLoads: (input.commercialProfile.commercialLoads || []).slice(0, 20),
          sanctionedLoadKw: Math.max(1, Math.min(50000, Number(input.commercialProfile.sanctionedLoadKw) || 15)),
        };
      } else if (input.category === 'industrial' && input.industrialProfile) {
        cleanPayload.industrialProfile = {
          industryType: (input.industrialProfile.industryType || 'Manufacturing').slice(0, 80),
          shiftsPerDay: Math.max(1, Math.min(3, Number(input.industrialProfile.shiftsPerDay) || 2)) as 1 | 2 | 3,
          processes: (input.industrialProfile.processes || []).slice(0, 20),
          contractDemandKva: Math.max(1, Math.min(500000, Number(input.industrialProfile.contractDemandKva) || 80)),
          powerFactor: Math.max(0.5, Math.min(1.0, Number(input.industrialProfile.powerFactor) || 0.94)),
          hasBackupGenerator: Boolean(input.industrialProfile.hasBackupGenerator),
          solarCapacityKw: Math.max(0, Math.min(100000, Number(input.industrialProfile.solarCapacityKw) || 0)),
        };
      }

      if (!existingProfile) {
        cleanPayload.createdAt = serverTimestamp();
        try {
          await setDoc(userRef, cleanPayload);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${uid}`);
        }
      } else {
        // Only send allowed profile update fields
        const updatePayload: Record<string, unknown> = {
          fullName: cleanPayload.fullName,
          category: cleanPayload.category,
          state: cleanPayload.state,
          city: cleanPayload.city,
          pinCode: cleanPayload.pinCode,
          discom: cleanPayload.discom,
          consumerId: cleanPayload.consumerId,
          propertyType: cleanPayload.propertyType,
          updatedAt: serverTimestamp(),
        };
        if (cleanPayload.domesticProfile) updatePayload.domesticProfile = cleanPayload.domesticProfile;
        if (cleanPayload.commercialProfile) updatePayload.commercialProfile = cleanPayload.commercialProfile;
        if (cleanPayload.industrialProfile) updatePayload.industrialProfile = cleanPayload.industrialProfile;

        try {
          await updateDoc(userRef, updatePayload);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
        }
      }
    },
    []
  );

  const registerWithEmail = useCallback(
    async (
      email: string,
      pass: string,
      initialProfile: Omit<
        UserProfile,
        | 'uid'
        | 'role'
        | 'rewardPointsBalance'
        | 'totalCarbonOffsetKg'
        | 'totalBillDiscountInr'
        | 'createdAt'
        | 'updatedAt'
      >
    ) => {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await sendEmailVerification(cred.user);
      if (cred.user.emailVerified) {
        await saveProfileInternal(cred.user.uid, email, initialProfile, null);
      }
      showToast(
        'Verification email sent',
        'Please verify your email link, then click "I have verified" to activate your profile.',
        'info'
      );
    },
    [saveProfileInternal, showToast]
  );

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const resendVerification = useCallback(async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  }, []);

  const refreshUserVerification = useCallback(async () => {
    if (!auth.currentUser) return false;
    await reload(auth.currentUser);
    setFirebaseUser({ ...auth.currentUser } as User);
    return auth.currentUser.emailVerified;
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const saveProfile = useCallback(
    async (
      input: Omit<
        UserProfile,
        | 'uid'
        | 'role'
        | 'rewardPointsBalance'
        | 'totalCarbonOffsetKg'
        | 'totalBillDiscountInr'
        | 'createdAt'
        | 'updatedAt'
      >
    ) => {
      if (!firebaseUser) throw new Error('Not authenticated.');
      await saveProfileInternal(
        firebaseUser.uid,
        firebaseUser.email || input.email,
        input,
        profile
      );
      showToast('Profile saved', 'Your consumer energy profile has been updated.', 'success');
    },
    [firebaseUser, profile, saveProfileInternal, showToast]
  );

  const addEnergyRecord = useCallback(
    async (input: {
      category: ConsumerCategory;
      granularity: 'hourly' | 'daily' | 'monthly';
      date: string;
      kwh: number;
      timePeriod: string;
      peakType: 'peak' | 'off_peak' | 'normal';
      notes: string;
      source?: 'manual' | 'bill_sync';
    }) => {
      if (!firebaseUser || !profile) throw new Error('Complete your profile first.');
      const id = makeCleanId('rec');
      const tariff = calculateDynamicTariff(
        {
          kwh: input.kwh,
          category: input.category,
          state: profile.state,
          discom: profile.discom,
          peakShareRatio: input.peakType === 'peak' ? 1 : 0,
          offPeakShareRatio: input.peakType === 'off_peak' ? 1 : 0,
        },
        tariffPolicies
      );

      // For daily/hourly entries, avoid inflating monthly fixed fee into each single-day entry cost
      const energyOnlyCost =
        input.granularity === 'monthly'
          ? tariff.totalPayableInr
          : Number((input.kwh * (tariff.effectiveRatePerKwh || 7)).toFixed(2));

      const payload = {
        userId: firebaseUser.uid,
        category: input.category,
        granularity: input.granularity,
        date: input.date.slice(0, 20),
        kwh: Math.max(0, Number(input.kwh)),
        timePeriod: (input.timePeriod || 'Full Day').slice(0, 40),
        peakType: input.peakType,
        estimatedCostInr: energyOnlyCost,
        carbonKg: tariff.carbonEmissionKg,
        source: input.source || 'manual',
        notes: (input.notes || '').slice(0, 300),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'energyRecords', id), payload);
        showToast('Consumption logged', `${input.kwh} kWh recorded for ${input.date}.`, 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `energyRecords/${id}`);
      }
    },
    [firebaseUser, profile, tariffPolicies, showToast]
  );

  const updateEnergyRecord = useCallback(
    async (
      id: string,
      patch: {
        category: ConsumerCategory;
        granularity: 'hourly' | 'daily' | 'monthly';
        date: string;
        kwh: number;
        timePeriod: string;
        peakType: 'peak' | 'off_peak' | 'normal';
        notes: string;
      }
    ) => {
      if (!firebaseUser || !profile) return;
      const tariff = calculateDynamicTariff(
        {
          kwh: patch.kwh,
          category: patch.category,
          state: profile.state,
          discom: profile.discom,
          peakShareRatio: patch.peakType === 'peak' ? 1 : 0,
          offPeakShareRatio: patch.peakType === 'off_peak' ? 1 : 0,
        },
        tariffPolicies
      );
      const cost =
        patch.granularity === 'monthly'
          ? tariff.totalPayableInr
          : Number((patch.kwh * (tariff.effectiveRatePerKwh || 7)).toFixed(2));

      try {
        await updateDoc(doc(db, 'energyRecords', id), {
          category: patch.category,
          granularity: patch.granularity,
          date: patch.date.slice(0, 20),
          kwh: Math.max(0, Number(patch.kwh)),
          timePeriod: patch.timePeriod.slice(0, 40),
          peakType: patch.peakType,
          estimatedCostInr: cost,
          carbonKg: tariff.carbonEmissionKg,
          notes: patch.notes.slice(0, 300),
          updatedAt: serverTimestamp(),
        });
        showToast('Record updated', 'Consumption entry updated successfully.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `energyRecords/${id}`);
      }
    },
    [firebaseUser, profile, tariffPolicies, showToast]
  );

  const deleteEnergyRecord = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'energyRecords', id));
        showToast('Record deleted', 'Consumption record removed.', 'info');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `energyRecords/${id}`);
      }
    },
    [showToast]
  );

  const saveElectricityBill = useCallback(
    async (
      bill: Omit<ElectricityBill, 'id' | 'userId' | 'uploadedAt' | 'createdAt' | 'updatedAt'>,
      syncToConsumption: boolean
    ): Promise<ElectricityBill | undefined> => {
      if (!firebaseUser || !profile) throw new Error('Not authenticated.');
      const billId = makeCleanId('bill');

      const resolvedProvider = sanitizeOptionalString(bill.provider ?? bill.electricityProvider, 120);
      const resolvedBillDate = sanitizeOptionalString(bill.billDate ?? bill.billIssueDate, 40);
      const resolvedPrevReading = sanitizeOptionalNumber(bill.previousReading ?? bill.previousMeterReading);
      const resolvedCurrReading = sanitizeOptionalNumber(bill.currentReading ?? bill.currentMeterReading);
      const resolvedUnits = sanitizeOptionalNumber(bill.unitsConsumed);
      const resolvedTotalKwh = Math.max(0, Number(bill.totalConsumptionKwh ?? resolvedUnits ?? 0) || 0);
      const resolvedPrevMonth = sanitizeOptionalNumber(
        bill.previousMonthConsumption ?? bill.previousMonthConsumptionKwh
      );

      const cleanBill = {
        userId: firebaseUser.uid,
        fileName: bill.fileName.slice(0, 200),
        fileType: bill.fileType.slice(0, 80),
        storageUrl: (bill.storageUrl || '').slice(0, 1200),
        storagePath: sanitizeOptionalString(bill.storagePath, 400),
        consumerName: sanitizeOptionalString(bill.consumerName, 120),
        consumerNumber: sanitizeOptionalString(bill.consumerNumber, 80),
        provider: resolvedProvider,
        electricityProvider: resolvedProvider,
        state: sanitizeOptionalString(bill.state, 80),
        city: sanitizeOptionalString(bill.city, 80),
        consumerCategory: sanitizeOptionalString(bill.consumerCategory, 60),
        tariffType: sanitizeOptionalString(bill.tariffType, 80),
        billingMonth: sanitizeOptionalString(bill.billingMonth, 40),
        billingPeriod: sanitizeOptionalString(
          bill.billingPeriod ||
            (bill.billingPeriodStart && bill.billingPeriodEnd
              ? `${bill.billingPeriodStart} to ${bill.billingPeriodEnd}`
              : bill.billingMonth),
          80
        ),
        billingPeriodStart: sanitizeOptionalString(bill.billingPeriodStart, 40),
        billingPeriodEnd: sanitizeOptionalString(bill.billingPeriodEnd, 40),
        billDate: resolvedBillDate,
        billIssueDate: resolvedBillDate,
        dueDate: sanitizeOptionalString(bill.dueDate, 40),
        previousReading: resolvedPrevReading,
        previousMeterReading: resolvedPrevReading,
        currentReading: resolvedCurrReading,
        currentMeterReading: resolvedCurrReading,
        unitsConsumed: resolvedUnits ?? resolvedTotalKwh,
        totalConsumptionKwh: resolvedTotalKwh,
        previousMonthConsumption: resolvedPrevMonth,
        previousMonthConsumptionKwh: resolvedPrevMonth,
        energyCharges: sanitizeOptionalNumber(bill.energyCharges),
        fixedCharges: sanitizeOptionalNumber(bill.fixedCharges),
        demandCharges: sanitizeOptionalNumber(bill.demandCharges),
        fuelAdjustmentCharges: sanitizeOptionalNumber(bill.fuelAdjustmentCharges),
        electricityDuty: sanitizeOptionalNumber(bill.electricityDuty),
        taxes: sanitizeOptionalNumber(bill.taxes),
        otherCharges: sanitizeOptionalNumber(bill.otherCharges),
        subsidies: sanitizeOptionalNumber(bill.subsidies),
        lateFees: sanitizeOptionalNumber(bill.lateFees),
        totalBillAmount: Math.max(0, Number(bill.totalBillAmount) || 0),
        paymentStatus: sanitizeOptionalString(bill.paymentStatus, 60),
        meterNumber: sanitizeOptionalString(bill.meterNumber, 80),
        tariffDetails: sanitizeStringList(bill.tariffDetails, 15, 240),
        extractionNotes: sanitizeStringList(bill.extractionNotes, 15, 300),
        confidence: sanitizeConfidence(bill.confidence),
        extractionStatus: (bill.extractionStatus || 'confirmed') as 'confirmed' | 'partial' | 'manual_override',
        extractedData: sanitizeBillSnapshot(bill.extractedData),
        confirmedData: sanitizeBillSnapshot(bill.confirmedData),
        verifiedByUser: true,
        uploadedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'bills', billId), cleanBill);

        if (syncToConsumption && cleanBill.totalConsumptionKwh > 0) {
          const recId = makeCleanId('rec_bill');
          const dateVal = resolveBillRecordDate(cleanBill);
          const tariff = calculateDynamicTariff(
            {
              kwh: cleanBill.totalConsumptionKwh,
              category: profile.category,
              state: cleanBill.state || profile.state,
              discom: cleanBill.provider || profile.discom,
              peakShareRatio: 0.32,
              offPeakShareRatio: 0.2,
            },
            tariffPolicies
          );

          await setDoc(doc(db, 'energyRecords', recId), {
            userId: firebaseUser.uid,
            category: profile.category,
            granularity: 'monthly',
            date: dateVal,
            kwh: cleanBill.totalConsumptionKwh,
            timePeriod: (cleanBill.billingMonth || cleanBill.billingPeriod || 'Billed Cycle').slice(0, 40),
            peakType: 'normal',
            estimatedCostInr: cleanBill.totalBillAmount || tariff.totalPayableInr,
            carbonKg: tariff.carbonEmissionKg,
            source: 'bill_sync',
            notes: `Verified Bill (${cleanBill.provider || 'Utility'}): ${cleanBill.fileName}`.slice(0, 300),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        showToast('Bill saved & verified', 'Electricity bill stored and dashboard synced.', 'success');
        return {
          id: billId,
          ...cleanBill,
        } as unknown as ElectricityBill;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `bills/${billId}`);
        return undefined;
      }
    },
    [firebaseUser, profile, tariffPolicies, showToast]
  );

  const redeemOffsetReward = useCallback(
    async (reward: OffsetRewardItem): Promise<OffsetRedemption> => {
      if (!firebaseUser || !profile) throw new Error('Profile not loaded.');
      if (profile.rewardPointsBalance < reward.pointsCost) {
        throw new Error('Insufficient Green Reward Points balance.');
      }

      const redemptionId = makeCleanId('red');
      const certificateCode = `ECO-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;

      const redemptionPayload = {
        userId: firebaseUser.uid,
        rewardId: reward.id,
        rewardTitle: reward.title.slice(0, 120),
        rewardType: reward.rewardType,
        pointsSpent: reward.pointsCost,
        carbonOffsetKg: reward.carbonOffsetKg,
        discountInr: reward.discountInr,
        certificateCode,
        status: (reward.rewardType === 'carbon_offset' ? 'completed' : 'applied') as
          | 'completed'
          | 'applied',
        createdAt: serverTimestamp(),
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'offsetRedemptions', redemptionId), redemptionPayload);
      batch.update(doc(db, 'users', firebaseUser.uid), {
        rewardPointsBalance: profile.rewardPointsBalance - reward.pointsCost,
        totalCarbonOffsetKg: profile.totalCarbonOffsetKg + reward.carbonOffsetKg,
        totalBillDiscountInr: profile.totalBillDiscountInr + reward.discountInr,
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
        showToast(
          'Redemption confirmed',
          `Issued ${certificateCode} (${reward.pointsCost} pts redeemed).`,
          'success'
        );
        return { id: redemptionId, ...redemptionPayload };
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `offsetRedemptions/${redemptionId}`);
      }
    },
    [firebaseUser, profile, showToast]
  );

  const creditRewardPoints = useCallback(
    async (pointsToAdd: number) => {
      if (!firebaseUser || !profile || pointsToAdd <= 0) return;
      try {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          rewardPointsBalance: profile.rewardPointsBalance + Math.round(pointsToAdd),
          totalCarbonOffsetKg: profile.totalCarbonOffsetKg,
          totalBillDiscountInr: profile.totalBillDiscountInr,
          updatedAt: serverTimestamp(),
        });
        showToast('Points credited', `+${Math.round(pointsToAdd)} Green Reward Points added to wallet.`, 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${firebaseUser.uid}`);
      }
    },
    [firebaseUser, profile, showToast]
  );

  const upsertTariffPolicy = useCallback(
    async (policy: Omit<TariffPolicy, 'updatedBy' | 'updatedAt'>) => {
      if (!firebaseUser || !isAdmin) throw new Error('Government Admin authorization required.');
      const cleanId = policy.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const payload = {
        state: policy.state.slice(0, 80),
        category: policy.category,
        discom: policy.discom.slice(0, 100),
        fixedChargePerMonth: Math.max(0, Number(policy.fixedChargePerMonth)),
        demandChargePerKva: Math.max(0, Number(policy.demandChargePerKva)),
        taxRatePercent: Math.max(0, Math.min(50, Number(policy.taxRatePercent))),
        carbonTaxThresholdKwh: Math.max(0, Number(policy.carbonTaxThresholdKwh)),
        carbonTaxRatePerKwh: Math.max(0, Number(policy.carbonTaxRatePerKwh)),
        peakHourSurchargePercent: Math.max(0, Math.min(100, Number(policy.peakHourSurchargePercent))),
        offPeakRebatePercent: Math.max(0, Math.min(50, Number(policy.offPeakRebatePercent))),
        subsidyUnitsLimit: Math.max(0, Number(policy.subsidyUnitsLimit)),
        subsidyDiscountPerKwh: Math.max(0, Number(policy.subsidyDiscountPerKwh)),
        gridEmissionFactorKgPerKwh: Math.max(0.05, Math.min(2.5, Number(policy.gridEmissionFactorKgPerKwh))),
        slabs: policy.slabs.slice(0, 8),
        updatedBy: firebaseUser.uid,
        updatedAt: serverTimestamp(),
      };
      try {
        await setDoc(doc(db, 'tariffPolicies', cleanId), payload);
        showToast('Policy published', `${policy.state} (${policy.category}) tariff updated live.`, 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `tariffPolicies/${cleanId}`);
      }
    },
    [firebaseUser, isAdmin, showToast]
  );

  const deleteTariffPolicy = useCallback(
    async (policyId: string) => {
      if (!isAdmin) throw new Error('Government Admin authorization required.');
      try {
        await deleteDoc(doc(db, 'tariffPolicies', policyId));
        showToast('Policy removed', 'Tariff override deleted.', 'info');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `tariffPolicies/${policyId}`);
      }
    },
    [isAdmin, showToast]
  );

  const publishAdvisory = useCallback(
    async (advisory: Omit<PolicyAdvisory, 'id' | 'createdBy' | 'createdAt'>) => {
      if (!firebaseUser || !isAdmin) throw new Error('Government Admin authorization required.');
      const id = makeCleanId('adv');
      try {
        await setDoc(doc(db, 'policyAdvisories', id), {
          title: advisory.title.slice(0, 160),
          message: advisory.message.slice(0, 800),
          targetCategory: advisory.targetCategory,
          targetState: advisory.targetState.slice(0, 80),
          severity: advisory.severity,
          createdBy: firebaseUser.uid,
          createdAt: serverTimestamp(),
        });
        showToast('Advisory broadcast', 'Policy notice published to consumer portals.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `policyAdvisories/${id}`);
      }
    },
    [firebaseUser, isAdmin, showToast]
  );

  const deleteAdvisory = useCallback(
    async (advisoryId: string) => {
      if (!isAdmin) throw new Error('Government Admin authorization required.');
      try {
        await deleteDoc(doc(db, 'policyAdvisories', advisoryId));
        showToast('Advisory removed', 'Policy notice deleted.', 'info');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `policyAdvisories/${advisoryId}`);
      }
    },
    [isAdmin, showToast]
  );

  return (
    <AuthContext.Provider
      value={{
        authReady,
        firebaseUser,
        profile,
        profileLoading,
        isAdmin,
        energyRecords,
        bills,
        redemptions,
        tariffPolicies,
        advisories,
        allConsumerSummaries,
        allRecordsAdmin,
        useDemoPreview,
        setUseDemoPreview,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        resetPassword,
        resendVerification,
        refreshUserVerification,
        logout,
        saveProfile,
        addEnergyRecord,
        updateEnergyRecord,
        deleteEnergyRecord,
        saveElectricityBill,
        redeemOffsetReward,
        creditRewardPoints,
        upsertTariffPolicy,
        deleteTariffPolicy,
        publishAdvisory,
        deleteAdvisory,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
