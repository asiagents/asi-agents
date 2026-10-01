import React from 'react';
import {
  ArrowUpRightIcon,
  CircleDashedIcon,
  CloudIcon,
  CpuIcon,
  WifiOffIcon,
  ZapIcon } from
'lucide-react';
import { getModel } from '../utils/lookup';
import type { ModelId } from '../types/models';

interface ModelChipProps {
  id: ModelId;
  size?: 'xs' | 'sm';
  showRole?: boolean;
  className?: string;
}

export function ModelChip({ id, size = 'sm', showRole = false, className = '' }: ModelChipProps) {
  const model = getModel(id);
  const iconSize = size === 'xs' ? 11 : 12;
  const Icon = iconFor(id, model.tier);
  const recipeNotInstalled = model.role === 'AMS recipe (not installed)';

  return (
    <span
      className={`inline-flex max-w-full items-center whitespace-nowrap rounded-full font-medium ${
      size === 'xs' ? 'gap-1 px-2 py-0.5 text-[11px]' : 'gap-1.5 px-2.5 py-1 text-xs'} ${
      styleFor(id, model.tier, recipeNotInstalled)} ${className}`}
      title={`${model.name} — ${model.role}`}>
      
      <Icon size={iconSize} aria-hidden="true" className="shrink-0" />
      <span className="truncate">{model.name}</span>
      {recipeNotInstalled && (
        <span className="truncate font-normal opacity-80">· not installed</span>
      )}
      {showRole && !recipeNotInstalled && (
        <span className="truncate font-normal opacity-70">· {model.role}</span>
      )}
    </span>);

}

function iconFor(id: ModelId, tier: string) {
  if (id === 'offline') return WifiOffIcon;
  if (id === 'pending') return CircleDashedIcon;
  if (tier === 'cloud') return CloudIcon;
  if (tier === 'escalate') return ArrowUpRightIcon;
  if (tier === 'edge' || tier === 'status') return ZapIcon;
  return CpuIcon;
}

function styleFor(id: ModelId, tier: string, recipeNotInstalled = false): string {
  if (id === 'offline') return 'bg-danger/10 text-danger ring-1 ring-inset ring-danger/25';
  if (id === 'pending') return 'border border-dashed border-overlay/20 text-muted';
  if (recipeNotInstalled)
    return 'border border-dashed border-warn/40 bg-warn/5 text-warn ring-1 ring-inset ring-warn/20';
  if (tier === 'escalate' || tier === 'cloud')
  return 'bg-warn/10 text-warn ring-1 ring-inset ring-warn/25';
  if (tier === 'edge' || tier === 'status') return 'bg-overlay/[0.05] text-muted ring-1 ring-inset ring-overlay/10';
  return 'bg-accent/15 text-accent-ink ring-1 ring-inset ring-accent/25';
}