import React from 'react';

export function SettingsSection({
  id,
  title,
  description,
  children,
  stacked = false,
}: {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Title above content (flush left). Default is side title column on lg. */
  stacked?: boolean;
}) {
  // Always stack when stacked=true — never fall through to the 240px side column.
  if (stacked) {
    return (
      <section id={id} className="w-full min-w-0 scroll-mt-6 border-b border-line py-5 first:pt-0 last:border-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 text-[12px] leading-relaxed text-muted">{description}</p>}
        <div className="mt-3 w-full min-w-0">{children}</div>
      </section>
    );
  }

  return (
    <section id={id} className="scroll-mt-6 border-b border-line py-8 first:pt-0 last:border-0">
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {description && <p className="mt-1 text-[12px] leading-relaxed text-muted">{description}</p>}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

export function SettingsRow({ title, detail, children }: {title: string;detail?: string;children: React.ReactNode;}) {
  return (
    <div className="flex items-center gap-4 border-t border-line px-4 py-3.5 first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-ink">{title}</div>
        {detail && <div className="text-[12px] text-muted">{detail}</div>}
      </div>
      {children}
    </div>);

}

export function StatusPill({ tone, children }: {tone: 'success' | 'warn' | 'muted';children: React.ReactNode;}) {
  const cls = tone === 'success' ? 'bg-success/10 text-success' : tone === 'warn' ? 'bg-warn/10 text-warn' : 'bg-overlay/[0.06] text-muted';
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

export const inputClass =
'w-full rounded-lg bg-bg px-3 py-2 text-sm text-ink outline-none ring-1 ring-line placeholder:text-faint focus:ring-accent/60';