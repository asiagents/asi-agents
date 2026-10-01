import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange?: (next: boolean) => void;
  label: string;
  locked?: boolean;
}

export function Toggle({ checked, onChange, label, locked = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={locked}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 disabled:cursor-not-allowed ${
      checked ? 'bg-accent-strong' : 'bg-overlay/15'} ${
      locked ? 'opacity-70' : ''}`}>
      
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${
        checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`
        } />
      
    </button>);

}