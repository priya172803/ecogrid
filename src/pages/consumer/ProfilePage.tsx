import React from 'react';
import { ProfileForm, type ProfileFormValues } from '../../components/ProfileForm';
import { useAuth } from '../../contexts/AuthContext';

export function ProfilePage() {
  const { profile, saveProfile } = useAuth();

  if (!profile) return null;

  const handleSave = async (values: ProfileFormValues) => {
    await saveProfile(values);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
          <span className="capitalize font-medium text-emerald-800">{profile.category} Account</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">{profile.uid.slice(0, 12)}</span>
          <span aria-hidden="true">·</span>
          <span>{profile.email}</span>
        </div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Comprehensive Energy Consumer Profile
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Update your property details, DISCOM, and category-specific energy attributes (appliances, operating hours, or industrial processes) to refine forecasting and AI recommendations.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
        <ProfileForm
          initialEmail={profile.email}
          initialName={profile.fullName}
          existingProfile={profile}
          submitLabel="Update Energy Profile"
          onSubmit={handleSave}
        />
      </div>
    </div>
  );
}
