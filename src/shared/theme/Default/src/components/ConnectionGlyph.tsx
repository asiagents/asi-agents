import React from 'react';
import { EthernetPortIcon, LoaderCircleIcon, WifiIcon, WifiOffIcon } from 'lucide-react';
import { getModel } from '../utils/lookup';
import type { ModelId } from '../types/models';

interface ConnectionGlyphProps {
  id: ModelId;
  showLabel?: boolean;
  className?: string;
}

export function ConnectionGlyph({ id, showLabel = true, className = '' }: ConnectionGlyphProps) {
  const tier = getModel(id).tier;
  const meta =
  id === 'offline' ?
  { Icon: WifiOffIcon, label: 'Offline', color: 'text-danger' } :
  id === 'pending' ?
  { Icon: LoaderCircleIcon, label: 'Connecting', color: 'text-faint' } :
  tier === 'escalate' || tier === 'cloud' ?
  { Icon: WifiIcon, label: 'Off-device', color: 'text-warn' } :
  { Icon: EthernetPortIcon, label: 'On-device', color: 'text-muted' };

  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium ${meta.color} ${className}`} title={meta.label}>
      <meta.Icon size={13} aria-hidden="true" />
      {showLabel ? <span>{meta.label}</span> : <span className="sr-only">{meta.label}</span>}
    </span>);

}