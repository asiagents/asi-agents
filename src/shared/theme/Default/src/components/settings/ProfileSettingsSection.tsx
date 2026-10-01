import React from 'react';
import { BriefcaseIcon, HomeIcon } from 'lucide-react';
import { useProfile } from '../../contexts/ProfileContext';
import { useDesk } from '../../contexts/DeskContext';
import type { ProfileHomeMode, UserProfileId } from '@asi-api';
import { SettingsRow, SettingsSection, inputClass } from '../../components/settings/SettingsUI';

const profileOptions: { id: UserProfileId; label: string; detail: string; icon: typeof BriefcaseIcon }[] = [
  { id: 'work', label: 'Work', detail: 'Office roster favorites and work home mode', icon: BriefcaseIcon },
  { id: 'personal', label: 'Personal', detail: 'Personal favorites and home mode', icon: HomeIcon },
];

const homeModeOptions: { id: ProfileHomeMode; label: string }[] = [
  { id: 'super', label: 'Super' },
  { id: 'multi', label: 'Multi' },
  { id: 'pro', label: 'Pro' },
];

/** Work vs Personal profile switch + per-slice prefs (favorites / home mode / display context). */
export function ProfileSettingsSection() {
  const { activeProfile, slice, setActiveProfile, updateActiveSlice, prefs } = useProfile();
  const { mode } = useDesk();

  return (
    <SettingsSection
      title="Work vs Personal"
      description="Same sign-in, two preference slices. Switching applies that profile’s home mode and favorites. Persisted in app-state prefs (not Postgres)."
    >
      <div role="radiogroup" aria-label="Active profile" className="mb-4 inline-flex rounded-full bg-surface p-1 ring-1 ring-line">
        {profileOptions.map((o) => {
          const active = activeProfile === o.id;
          const Icon = o.icon;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => void setActiveProfile(o.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
                active ? 'bg-accent/15 text-accent-ink' : 'text-muted hover:text-ink'
              }`}
            >
              <Icon size={13} aria-hidden="true" />
              {o.label}
            </button>
          );
        })}
      </div>

      <div className="max-w-2xl rounded-card bg-surface ring-1 ring-line">
        <SettingsRow
          title={`${activeProfile === 'work' ? 'Work' : 'Personal'} home mode`}
          detail={`Applied when this profile is active (currently ${mode}).`}
        >
          <select
            value={slice.homeMode}
            onChange={(e) => void updateActiveSlice({ homeMode: e.target.value as ProfileHomeMode })}
            className="rounded-lg bg-bg px-2.5 py-1.5 text-[13px] text-ink ring-1 ring-line"
            aria-label="Profile home mode"
          >
            {homeModeOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </SettingsRow>
        <SettingsRow title="Display context" detail="Short label shown next to the profile in the header.">
          <input
            key={`${activeProfile}-ctx`}
            defaultValue={slice.displayContext}
            maxLength={64}
            placeholder={activeProfile === 'work' ? 'e.g. Office' : 'e.g. Home desk'}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next !== slice.displayContext) void updateActiveSlice({ displayContext: next });
            }}
            className={`max-w-[220px] ${inputClass}`}
            aria-label="Display context"
          />
        </SettingsRow>
        <SettingsRow
          title="Agent favorites"
          detail={
            slice.favoriteAgentIds.length
              ? `${slice.favoriteAgentIds.length} pinned for this profile — toggle stars on Agents.`
              : 'None yet — star agents on the Agents page.'
          }
        >
          <span className="text-[12px] tabular-nums text-muted">
            {prefs.profiles.work.favoriteAgentIds.length}W · {prefs.profiles.personal.favoriteAgentIds.length}P
          </span>
        </SettingsRow>
      </div>
    </SettingsSection>
  );
}
