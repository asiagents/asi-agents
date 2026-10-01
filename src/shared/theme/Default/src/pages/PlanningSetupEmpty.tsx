import React from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

type Hint = {
  title: string;
  lead: string;
  steps: readonly string[];
  links?: readonly { to: string; label: string }[];
};

export function PlanningSetupEmpty({
  hint,
  icon: Icon,
}: {
  hint: Hint;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-card bg-surface p-10 text-center ring-1 ring-line">
      <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent-ink">
        <Icon size={22} aria-hidden="true" />
      </span>
      <p className="text-sm font-medium text-ink">{hint.title}</p>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted">{hint.lead}</p>
      <ol className="mx-auto mt-4 max-w-md list-decimal space-y-1.5 pl-5 text-left text-[13px] text-muted">
        {hint.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {hint.links && hint.links.length > 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {hint.links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-full bg-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-2">
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
