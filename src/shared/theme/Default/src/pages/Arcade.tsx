import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Gamepad2Icon, Maximize2Icon, Minimize2Icon } from 'lucide-react';
import { PageHeader, PageScroll } from '../components/PageScroll';
import { api } from '@asi-api';
import { hiddenNavIds } from '../data/nav';
import { AgentBikeRace } from './arcade/AgentBikeRace';
import { AgentBrawl } from './arcade/AgentBrawl';
import { AgentChaos } from './arcade/AgentChaos';

const arcadeDisabled = hiddenNavIds.includes('arcade');

/** Soft-disable notice when Arcade is in hiddenNavIds (modules kept). */
function GamesUnavailable() {
  return (
    <div className="grid h-full w-full place-items-center px-4 pb-28">
      <div className="max-w-md text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent-ink">
          <Gamepad2Icon size={22} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-ink">Games unavailable</h1>
        <p className="mt-2 text-sm text-muted">
          Arcade mini-games are turned off in this build. The rest of the app works as usual.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex rounded-full bg-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-2"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

type GameMeta = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  route: string;
};

/** Fail-closed local catalog when GET /api/games/catalog is down. */
const LOCAL_GAMES: GameMeta[] = [
  {
    id: 'agent-bike-race',
    title: 'Agent Bike Race',
    description: 'Side-scrolling race — pick an agent and boost with Space.',
    tags: ['racing', 'agents', 'local'],
    route: '/arcade/agent-bike-race',
  },
  {
    id: 'agent-brawl',
    title: 'Agent Brawl',
    description: 'Quick local brawl with roster agents.',
    tags: ['brawl', 'agents', 'local'],
    route: '/arcade/agent-brawl',
  },
  {
    id: 'agent-chaos',
    title: 'Agent Chaos',
    description: 'Chaotic mini-game with your agents.',
    tags: ['chaos', 'agents', 'local'],
    route: '/arcade/agent-chaos',
  },
];

const ARCADE_SHELL_ATTR = 'data-arcade-shell';

function useArcadeFullscreen(targetRef: React.RefObject<HTMLElement | null>) {
  const [fs, setFs] = useState(false);
  useEffect(() => {
    const sync = () => {
      const el = targetRef.current;
      setFs(Boolean(el && document.fullscreenElement === el));
    };
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [targetRef]);

  const toggle = useCallback(async () => {
    const el = targetRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      /* denied — stay windowed */
    }
  }, [targetRef]);

  return { fs, toggle };
}

function FullscreenBtn({ fs, onToggle }: { fs: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line hover:bg-overlay/[0.05]"
      title={fs ? 'Exit arcade full screen (Esc)' : 'Arcade full screen'}
    >
      {fs ? <Minimize2Icon size={14} aria-hidden="true" /> : <Maximize2Icon size={14} aria-hidden="true" />}
      {fs ? 'Exit full screen' : 'Full screen'}
    </button>
  );
}

function ArcadeHub() {
  const [games, setGames] = useState<GameMeta[]>(LOCAL_GAMES);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .gamesCatalog()
      .then((r) => {
        if (Array.isArray(r.games) && r.games.length > 0) {
          setGames(r.games);
          setErr(null);
        }
      })
      .catch(() => {
        setGames(LOCAL_GAMES);
        setErr('API catalog offline — showing built-in games.');
      });
  }, []);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {err && <p className="text-[13px] text-muted sm:col-span-2">{err}</p>}
      {games.map((g) => (
        <Link
          key={g.id}
          to={g.route}
          className="block rounded-card bg-surface p-4 ring-1 ring-line transition-colors hover:ring-accent/40"
        >
          <h2 className="text-[15px] font-semibold text-ink">{g.title}</h2>
          <p className="mt-1 text-[12px] text-muted">{g.description}</p>
          <p className="mt-2 text-[11px] text-faint">{g.tags.join(' · ')}</p>
        </Link>
      ))}
    </div>
  );
}

function GameBody({ gameId }: { gameId: string }) {
  switch (gameId) {
    case 'agent-bike-race':
      return <AgentBikeRace />;
    case 'agent-brawl':
      return <AgentBrawl />;
    case 'agent-chaos':
      return <AgentChaos />;
    default:
      return (
        <p className="text-muted">
          Unknown game. <Link to="/arcade">Back to arcade</Link>
        </p>
      );
  }
}

/**
 * /arcade hub. Footer Menu → Arcade uses ?play=agent-bike-race so this visit
 * auto-starts the bike race once (query stripped via replace navigation).
 */
export function Arcade() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const play = params.get('play')?.trim() || '';
  const shellRef = useRef<HTMLDivElement>(null);
  const { fs, toggle } = useArcadeFullscreen(shellRef);

  // Footer Arcade uses ?play= once per open; replace navigation drops the query so refresh does not re-loop.
  useEffect(() => {
    if (arcadeDisabled || !play) return;
    navigate(`/arcade/${play}`, { replace: true });
  }, [play, navigate]);

  if (arcadeDisabled) return <GamesUnavailable />;

  if (play) {
    return (
      <div ref={shellRef} {...{ [ARCADE_SHELL_ATTR]: '' }} className="min-h-full bg-bg p-4">
        <p className="text-[13px] text-muted">Starting {play.replace(/-/g, ' ')}…</p>
      </div>
    );
  }

  return (
    <div ref={shellRef} {...{ [ARCADE_SHELL_ATTR]: '' }} className="min-h-full bg-bg">
      <PageScroll>
        <PageHeader
          title="Arcade"
          description="Agent mini-games — local fun, no model required."
          actions={<FullscreenBtn fs={fs} onToggle={() => void toggle()} />}
        />
        <ArcadeHub />
      </PageScroll>
    </div>
  );
}

/** /arcade/:gameId — single game screen with arcade fullscreen. */
export function ArcadeGame() {
  const { gameId } = useParams();
  const id = gameId ?? '';
  const shellRef = useRef<HTMLDivElement>(null);
  const { fs, toggle } = useArcadeFullscreen(shellRef);

  if (arcadeDisabled) return <GamesUnavailable />;

  return (
    <div ref={shellRef} {...{ [ARCADE_SHELL_ATTR]: '' }} className="min-h-full bg-bg">
      <PageScroll>
        <PageHeader
          title="Arcade"
          description={id.replace(/-/g, ' ')}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/arcade" className="text-[12px] font-medium text-accent-ink hover:underline">
                All games
              </Link>
              <FullscreenBtn fs={fs} onToggle={() => void toggle()} />
            </div>
          }
        />
        <GameBody gameId={id} />
      </PageScroll>
    </div>
  );
}

export { ARCADE_SHELL_ATTR };
