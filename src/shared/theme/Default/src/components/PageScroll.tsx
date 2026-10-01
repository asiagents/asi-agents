import React from 'react';

interface PageScrollProps {
  children: React.ReactNode;
  width?: string;
}

/** Full-width, left-aligned scrolling page. `width` optionally caps line length without centering. */
export function PageScroll({ children, width = 'max-w-none' }: PageScrollProps) {
  return (
    <div className="h-full w-full overflow-y-auto px-4 pb-32 pt-6 md:px-6">
      <div className={`w-full ${width}`}>{children}</div>
    </div>);

}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>);

}