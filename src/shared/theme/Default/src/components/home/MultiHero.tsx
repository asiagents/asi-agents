import React from 'react';
import { Link } from 'react-router-dom';
import { useDesk } from '../../contexts/DeskContext';

/**
 * Multi home tip only — Office / Agents / Board / Task live in the bottom nav
 * (not a blocking header row). Working-agents banner removed.
 */
export function MultiHero() {
  const { pausedAt, isTeamMode } = useDesk();
  if (!isTeamMode) return null;

  return (
    <section aria-label="Your team" className="mb-6 rounded-card bg-surface px-4 py-3 ring-1 ring-line">
      <p className="text-[13px] text-ink">
        {pausedAt ? (
          <span className="font-medium">Team paused.</span>
        ) : (
          <span className="font-medium">Multi Agents</span>
        )}{' '}
        <span className="text-muted">
          Office, Agents, Board, and Task are in the bottom menu — not the header.
        </span>
      </p>
      <p className="mt-1 text-[12px] text-muted">
        Prefer the floor?{' '}
        <Link to="/office" className="font-medium text-accent-ink hover:underline">
          Open Office
        </Link>
      </p>
    </section>
  );
}
