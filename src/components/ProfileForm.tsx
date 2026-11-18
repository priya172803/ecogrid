import React, { useState } from 'react';
import { Building2, Factory, Home, Save } from 'lucide-react';
import type {
  CommercialProfile,
  ConsumerCategory,
  DomesticProfile,
  IndustrialProfile,
  UserProfile,
} from '../types/energy';
import { STATE_DISCOM_OPTIONS } from '../utils/tariffEngine';

const DOMESTIC_APPLIANCES = [
  'Split / Inverter AC',
  'Window AC',
  'Electric Water Geyser',
  'Refrigerator',
  'Washing Machine',
  'Induction Cooktop',
  'EV Home Charger',
  'Microwave / Oven',
  'Desktop Workstations',
];

const COMMERCIAL_LOADS = [
  'Central HVAC / Chiller',
  'Commercial Refrigeration',
  'LED Lighting Banks',
  'Server & IT Racks',
  'Elevators / Escalators',
  'Illuminated Signage',
];

const INDUSTRIAL_PROCESSES = [
  'Heavy Motors & CNC',
  'Electric Furnaces / Boilers',
  'Air Compressors',
  'Conveyor & Assembly Lines',
  'Industrial Chilling Plants',
  'Welding / Electroplating',
];

export interface ProfileFormValues {
  fullName: string;
  email: string;
  category: ConsumerCategory;
  state: string;
  city: string;
  pinCode: string;
  discom: string;
  consumerId: string;
  propertyType: string;
  domesticProfile?: DomesticProfile;
  commercialProfile?: CommercialProfile;
  industrialProfile?: IndustrialProfile;
}

interface ProfileFormProps {
  initialEmail?: string;
  initialName?: string;
  existingProfile?: UserProfile | null;
  submitLabel?: string;
  onSubmit: (values: ProfileFormValues) => Promise<void>;
}

export function ProfileForm({
  initialEmail = '',
  initialName = '',
  existingProfile,
  submitLabel = 'Save Energy Profile',
  onSubmit,
}: ProfileFormProps) {
  const [fullName, setFullName] = useState(existingProfile?.fullName || initialName || '');
  const [email, setEmail] = useState(existingProfile?.email || initialEmail || '');
  const [category, setCategory] = useState<ConsumerCategory>(existingProfile?.category || 'domestic');
  const [state, setState] = useState(existingProfile?.state || 'Karnataka');
  const [city, setCity] = useState(existingProfile?.city || 'Bengaluru');
  const [pinCode, setPinCode] = useState(existingProfile?.pinCode || '560060');
  const [discom, setDiscom] = useState(existingProfile?.discom || 'BESCOM');
  const [consumerId, setConsumerId] = useState(existingProfile?.consumerId || '');
  const [propertyType, setPropertyType] = useState(
    existingProfile?.propertyType || 'Apartment / Residence'
  );

  // Domestic attributes
  const [householdSize, setHouseholdSize] = useState(
    existingProfile?.domesticProfile?.householdSize ?? 4
  );
  const [sqFt, setSqFt] = useState(existingProfile?.domesticProfile?.sqFt ?? 1350);
  const [wfhMembers, setWfhMembers] = useState(existingProfile?.domesticProfile?.wfhMembers ?? 1);
  const [hvacUsageHours, setHvacUsageHours] = useState(
    existingProfile?.domesticProfile?.hvacUsageHours ?? 5
  );
  const [domSolarKw, setDomSolarKw] = useState(
    existingProfile?.domesticProfile?.solarCapacityKw ?? 0
  );
  const [appliances, setAppliances] = useState<string[]>(
    existingProfile?.domesticProfile?.appliances || [
      'Split / Inverter AC',
      'Refrigerator',
      'Electric Water Geyser',
      'Washing Machine',
    ]
  );

  // Commercial attributes
  const [businessType, setBusinessType] = useState(
    existingProfile?.commercialProfile?.businessType || 'Office / IT Park'
  );
  const [floorAreaSqFt, setFloorAreaSqFt] = useState(
    existingProfile?.commercialProfile?.floorAreaSqFt ?? 2400
  );
  const [openTime, setOpenTime] = useState(existingProfile?.commercialProfile?.openTime || '09:00');
  const [closeTime, setCloseTime] = useState(
    existingProfile?.commercialProfile?.closeTime || '20:00'
  );
  const [operatingDaysPerWeek, setOperatingDaysPerWeek] = useState(
    existingProfile?.commercialProfile?.operatingDaysPerWeek ?? 6
  );
  const [occupancyCount, setOccupancyCount] = useState(
    existingProfile?.commercialProfile?.occupancyCount ?? 28
  );
  const [sanctionedLoadKw, setSanctionedLoadKw] = useState(
    existingProfile?.commercialProfile?.sanctionedLoadKw ?? 20
  );
  const [commercialLoads, setCommercialLoads] = useState<string[]>(
    existingProfile?.commercialProfile?.commercialLoads || [
      'Central HVAC / Chiller',
      'LED Lighting Banks',
      'Server & IT Racks',
    ]
  );

  // Industrial attributes
  const [industryType, setIndustryType] = useState(
    existingProfile?.industrialProfile?.industryType || 'Precision Manufacturing'
  );
  const [shiftsPerDay, setShiftsPerDay] = useState<1 | 2 | 3>(
    existingProfile?.industrialProfile?.shiftsPerDay ?? 2
  );
  const [contractDemandKva, setContractDemandKva] = useState(
    existingProfile?.industrialProfile?.contractDemandKva ?? 120
  );
  const [powerFactor, setPowerFactor] = useState(
    existingProfile?.industrialProfile?.powerFactor ?? 0.94
  );
  const [hasBackupGenerator, setHasBackupGenerator] = useState(
    existingProfile?.industrialProfile?.hasBackupGenerator ?? true
  );
  const [indSolarKw, setIndSolarKw] = useState(
    existingProfile?.industrialProfile?.solarCapacityKw ?? 10
  );
  const [processes, setProcesses] = useState<string[]>(
    existingProfile?.industrialProfile?.processes || [
      'Heavy Motors & CNC',
      'Air Compressors',
      'Conveyor & Assembly Lines',
    ]
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const availableDiscoms = STATE_DISCOM_OPTIONS[state] || ['State Electricity Board'];

  const toggleListItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    if (list.includes(item)) {
      setList(list.filter((x) => x !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleStateChange = (newState: string) => {
    setState(newState);
    const list = STATE_DISCOM_OPTIONS[newState];
    if (list && list.length > 0) {
      setDiscom(list[0]);
    }
  };

  const handleCategoryChange = (cat: ConsumerCategory) => {
    setCategory(cat);
    if (cat === 'domestic') setPropertyType('Apartment / Residence');
    if (cat === 'commercial') setPropertyType('Commercial Complex');
    if (cat === 'industrial') setPropertyType('Industrial Facility');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim() || !city.trim() || !pinCode.trim() || !discom.trim()) {
      setError('Please complete all required location and DISCOM fields.');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        fullName: fullName.trim(),
        email: email.trim(),
        category,
        state,
        city: city.trim(),
        pinCode: pinCode.trim(),
        discom: discom.trim(),
        consumerId: consumerId.trim(),
        propertyType: propertyType.trim(),
        domesticProfile:
          category === 'domestic'
            ? {
                householdSize,
                sqFt,
                appliances,
                hvacUsageHours,
                wfhMembers,
                solarCapacityKw: domSolarKw,
              }
            : undefined,
        commercialProfile:
          category === 'commercial'
            ? {
                businessType,
                floorAreaSqFt,
                openTime,
                closeTime,
                operatingDaysPerWeek,
                occupancyCount,
                commercialLoads,
                sanctionedLoadKw,
              }
            : undefined,
        industrialProfile:
          category === 'industrial'
            ? {
                industryType,
                shiftsPerDay,
                processes,
                contractDemandKva,
                powerFactor,
                hasBackupGenerator,
                solarCapacityKw: indSolarKw,
              }
            : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-800">
          {error}
        </div>
      )}

      {/* Consumer Category Selector */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-2">
          Consumer Category
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'domestic' as const, label: 'Domestic / Household', icon: Home },
            { id: 'commercial' as const, label: 'Commercial', icon: Building2 },
            { id: 'industrial' as const, label: 'Industrial', icon: Factory },
          ].map((opt) => {
            const Icon = opt.icon;
            const active = category === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleCategoryChange(opt.id)}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border text-sm font-medium transition-colors cursor-pointer text-left ${
                  active
                    ? 'bg-emerald-900 text-white border-emerald-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-700'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Core Location & Utility Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g., Ananya Sharma"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={Boolean(initialEmail)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 text-slate-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">State / Region *</label>
          <select
            value={state}
            onChange={(e) => handleStateChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
          >
            {Object.keys(STATE_DISCOM_OPTIONS).map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Electricity Provider / DISCOM *
          </label>
          <select
            value={availableDiscoms.includes(discom) ? discom : availableDiscoms[0]}
            onChange={(e) => setDiscom(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
          >
            {availableDiscoms.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">City *</label>
          <input
            type="text"
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">PIN Code *</label>
          <input
            type="text"
            required
            maxLength={12}
            value={pinCode}
            onChange={(e) => setPinCode(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-700"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Consumer / RR Number (Optional)
          </label>
          <input
            type="text"
            value={consumerId}
            onChange={(e) => setConsumerId(e.target.value)}
            placeholder="e.g., KA-BLR-904821"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Property Type</label>
          <input
            type="text"
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
          />
        </div>
      </div>

      {/* Category-Specific Comprehensive Profiling */}
      <div className="pt-4 border-t border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">
          {category === 'domestic' && 'Household Appliance & Occupancy Profile'}
          {category === 'commercial' && 'Commercial Operating Hours & Load Profile'}
          {category === 'industrial' && 'Industrial Process & Demand Profile'}
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Used to calibrate forecasting baselines, peak-hour load windows, and Gemini AI efficiency insights.
        </p>

        {category === 'domestic' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Household Size
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={householdSize}
                  onChange={(e) => setHouseholdSize(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Home Area (sq ft)
                </label>
                <input
                  type="number"
                  min={100}
                  max={50000}
                  value={sqFt}
                  onChange={(e) => setSqFt(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  WFH Occupants
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={wfhMembers}
                  onChange={(e) => setWfhMembers(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Daily AC / HVAC (hrs)
                </label>
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={hvacUsageHours}
                  onChange={(e) => setHvacUsageHours(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Rooftop Solar (kW)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={domSolarKw}
                  onChange={(e) => setDomSolarKw(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Major Appliances Owned
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DOMESTIC_APPLIANCES.map((app) => {
                  const selected = appliances.includes(app);
                  return (
                    <button
                      key={app}
                      type="button"
                      onClick={() => toggleListItem(appliances, setAppliances, app)}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors cursor-pointer ${
                        selected
                          ? 'bg-emerald-50 border-emerald-700 text-emerald-900'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {app}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {category === 'commercial' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Business Type
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option>Office / IT Park</option>
                  <option>Retail Store / Mall</option>
                  <option>Hospitality / Restaurant</option>
                  <option>Healthcare / Clinic</option>
                  <option>Educational Campus</option>
                  <option>Warehouse / Logistics</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Floor Area (sq ft)
                </label>
                <input
                  type="number"
                  min={100}
                  max={1000000}
                  value={floorAreaSqFt}
                  onChange={(e) => setFloorAreaSqFt(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Sanctioned Load (kW)
                </label>
                <input
                  type="number"
                  min={1}
                  max={50000}
                  value={sanctionedLoadKw}
                  onChange={(e) => setSanctionedLoadKw(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Opening Time
                </label>
                <input
                  type="time"
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Closing Time
                </label>
                <input
                  type="time"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Operating Days / Week
                </label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={operatingDaysPerWeek}
                  onChange={(e) => setOperatingDaysPerWeek(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Peak Occupancy
                </label>
                <input
                  type="number"
                  min={1}
                  max={50000}
                  value={occupancyCount}
                  onChange={(e) => setOccupancyCount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Primary Commercial Electrical Loads
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {COMMERCIAL_LOADS.map((load) => {
                  const selected = commercialLoads.includes(load);
                  return (
                    <button
                      key={load}
                      type="button"
                      onClick={() => toggleListItem(commercialLoads, setCommercialLoads, load)}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors cursor-pointer ${
                        selected
                          ? 'bg-emerald-50 border-emerald-700 text-emerald-900'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {load}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {category === 'industrial' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Industry Sector
                </label>
                <select
                  value={industryType}
                  onChange={(e) => setIndustryType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option>Precision Manufacturing</option>
                  <option>Textile &amp; Apparel</option>
                  <option>Metallurgy / Foundry</option>
                  <option>Food &amp; Beverage Processing</option>
                  <option>Pharma &amp; Chemicals</option>
                  <option>Cold Chain Storage</option>
                  <option>Packaging &amp; Plastics</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Production Shifts / Day
                </label>
                <select
                  value={shiftsPerDay}
                  onChange={(e) => setShiftsPerDay(Number(e.target.value) as 1 | 2 | 3)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value={1}>1 Shift (8 hrs)</option>
                  <option value={2}>2 Shifts (16 hrs)</option>
                  <option value={3}>3 Shifts (24x7 Continuous)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Contract Demand (kVA)
                </label>
                <input
                  type="number"
                  min={1}
                  max={500000}
                  value={contractDemandKva}
                  onChange={(e) => setContractDemandKva(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Power Factor (0.50–1.00)
                </label>
                <input
                  type="number"
                  min={0.5}
                  max={1.0}
                  step="0.01"
                  value={powerFactor}
                  onChange={(e) => setPowerFactor(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Captive Solar (kW)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100000}
                  value={indSolarKw}
                  onChange={(e) => setIndSolarKw(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasBackupGenerator}
                    onChange={(e) => setHasBackupGenerator(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
                  />
                  Backup DG / Captive Set Installed
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Active Industrial Processes
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {INDUSTRIAL_PROCESSES.map((proc) => {
                  const selected = processes.includes(proc);
                  return (
                    <button
                      key={proc}
                      type="button"
                      onClick={() => toggleListItem(processes, setProcesses, proc)}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors cursor-pointer ${
                        selected
                          ? 'bg-emerald-50 border-emerald-700 text-emerald-900'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {proc}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 text-white text-sm font-medium rounded-lg hover:bg-emerald-900 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving Profile...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
