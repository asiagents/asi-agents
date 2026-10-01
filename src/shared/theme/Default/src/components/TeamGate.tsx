import React from 'react';
import { Link } from 'react-router-dom';
import { UsersIcon } from 'lucide-react';

interface TeamGateProps {
  feature: string;
  description: string;
}

/** Full-page notice for team-only surfaces (Multi / Pro). Mode is changed in Settings → General only. */
export function TeamGate({ feature, description }: TeamGateProps) {
  return (
    <div className="grid h-full w-full place-items-center px-4 pb-28">
      <div className="max-w-md text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent-ink">
          <UsersIcon size={22} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-ink">{feature} lives in Multi and Pro</h1>
        <p className="mt-2 text-sm text-muted">{description}</p>
        <Link to="/settings/general" className="mt-5 inline-flex rounded-full bg-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-2">
          Change mode in Settings
        </Link>
      </div>
    </div>);

}

export function TeamBanner({ text }: {text: string;}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-warn/20 bg-warn/[0.07] px-4 py-2.5 text-[13px] text-ink">
      <UsersIcon size={15} className="text-warn" aria-hidden="true" />
      {text}
      <Link to="/settings/general" className="ml-auto rounded-full bg-accent-strong px-3 py-1 text-[12px] font-medium text-white transition-colors duration-150 hover:bg-accent-2">
        Change mode
      </Link>
    </div>);

}