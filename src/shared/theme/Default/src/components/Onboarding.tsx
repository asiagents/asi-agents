import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BriefcaseIcon,
  Building2Icon,
  CheckIcon,
  CpuIcon,
  HomeIcon,
  SparklesIcon,
  UsersIcon,
} from 'lucide-react';
import { api } from '@asi-api';
import { AmsSkillMultiSelect } from './agents/AmsSkillMultiSelect';
import { ModelSuggestions } from './models/ModelSuggestions';
import { useDesk } from '../contexts/DeskContext';
import { usePrefs } from '../contexts/PrefsContext';
import { useSettings } from '../contexts/SettingsContext';
import {
  AGENT_NAME_SETS,
  getAgentNameSet,
  type AgentNameSuggestion,
} from '../data/agentNameSets';
import { fetchAndApplyAgents } from '../data/agents';
import { DEFAULT_DISPLAY_NAME } from '../types/settings';
import {
  readJson,
  STORAGE_KEYS,
  writeFlag,
  writeJson,
  type OnboardingProfile,
  type OnboardingProfileKind,
} from '../utils/storage';

type Step = 'welcome' | 'profile' | 'company' | 'agents' | 'skills' | 'models' | 'done';

const STEPS: Step[] = ['welcome', 'profile', 'company', 'agents', 'skills', 'models', 'done'];

const LABELS: Record<Step, string> = {
  welcome: 'Welcome',
  profile: 'Profile',
  company: 'About',
  agents: 'Hire',
  skills: 'Skills',
  models: 'Models',
  done: 'Done',
};

const ease = [0.23, 1, 0.32, 1] as const;

type DraftAgent = AgentNameSuggestion & { key: string };

function draftKey(setId: string, name: string, role?: string) {
  return `${setId}:${name}:${role ?? ''}`;
}

/**
 * Visual signup / create-agents wizard (Paperclip-inspired longer path).
 * Hiring is flat by default — batch create never assigns reportsTo / parentId.
 */
export function Onboarding() {
  const { s, set } = useSettings();
  const { appName } = usePrefs();
  const { mode } = useDesk();
  const navigate = useNavigate();

  const saved = readJson<Partial<OnboardingProfile>>(STORAGE_KEYS.onboardingProfile, {});
  const [step, setStep] = useState<Step>('welcome');
  const [kind, setKind] = useState<OnboardingProfileKind>(saved.kind ?? 'work');
  const [companyName, setCompanyName] = useState(saved.companyName ?? '');
  const [companyAbout, setCompanyAbout] = useState(saved.companyAbout ?? '');
  const [displayName, setDisplayName] = useState(s.displayName ?? DEFAULT_DISPLAY_NAME);
  const [setId, setSetId] = useState(AGENT_NAME_SETS[0]?.id ?? '');
  const [picked, setPicked] = useState<DraftAgent[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [hiring, setHiring] = useState(false);
  const [hireError, setHireError] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState(0);
  const [hired, setHired] = useState(false);

  const activeSet = useMemo(() => getAgentNameSet(setId) ?? AGENT_NAME_SETS[0]!, [setId]);
  const idx = STEPS.indexOf(step);
  const greet = displayName.trim() || DEFAULT_DISPLAY_NAME;

  if (s.onboarded && step !== 'done') {
    return <Navigate to="/" replace />;
  }

  const persistProfile = (patch: Partial<OnboardingProfile> = {}) => {
    const next: OnboardingProfile = {
      kind,
      companyName: companyName.trim() || undefined,
      companyAbout: companyAbout.trim() || undefined,
      ...patch,
    };
    writeJson(STORAGE_KEYS.onboardingProfile, next);
  };

  const go = (next: Step) => setStep(next);
  const back = () => {
    if (idx <= 0) return;
    go(STEPS[idx - 1]!);
  };

  const togglePick = (suggestion: AgentNameSuggestion) => {
    const key = draftKey(activeSet.id, suggestion.name, suggestion.role);
    setPicked((prev) => {
      if (prev.some((p) => p.key === key)) return prev.filter((p) => p.key !== key);
      return [...prev, { ...suggestion, key }];
    });
  };

  const pickWholeSet = () => {
    const rows = activeSet.names.map((n) => ({
      ...n,
      key: draftKey(activeSet.id, n.name, n.role),
    }));
    setPicked((prev) => {
      const map = new Map(prev.map((p) => [p.key, p]));
      for (const r of rows) map.set(r.key, r);
      return Array.from(map.values());
    });
  };

  const clearPicks = () => setPicked([]);

  const hireBatch = async (): Promise<boolean> => {
    if (hired) return true;
    if (picked.length === 0) {
      setHireError('Pick at least one name to hire.');
      return false;
    }
    setHiring(true);
    setHireError(null);
    try {
      // Flat hire: explicit null reportsTo — never invent org nesting.
      await api.createAgents({
        reportsTo: null,
        agents: picked.map((p) => ({
          name: p.name,
          role: p.role,
          skills: skills.length ? skills : undefined,
          reportsTo: null,
        })),
        skills: skills.length ? skills : undefined,
      });
      await fetchAndApplyAgents().catch(() => undefined);
      setCreatedCount(picked.length);
      setHired(true);
      writeFlag(STORAGE_KEYS.modelsOnboardingDone, true);
      return true;
    } catch (err) {
      setHireError(err instanceof Error ? err.message : 'Could not create agents — is the API on :3445?');
      return false;
    } finally {
      setHiring(false);
    }
  };

  const finish = () => {
    persistProfile();
    if (displayName.trim() && displayName.trim() !== s.displayName) {
      set('displayName', displayName.trim());
    }
    set('onboarded', true);
    api.completeOnboarding('manual').catch(() => undefined);
    navigate('/', { replace: true });
  };

  const primary =
    'inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg transition-colors duration-150 hover:bg-ink/90 disabled:opacity-40';
  const ghost =
    'inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink';

  const advanceFromCompany = () => {
    persistProfile({ kind, companyName: companyName.trim() || undefined, companyAbout: companyAbout.trim() || undefined });
    go('agents');
  };

  const advanceFromSkills = async () => {
    const ok = await hireBatch();
    if (ok) go('models');
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-bg">
      {/* Atmosphere: ink wash + warm paper grain — Default tokens, not purple sludge */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 10% -10%, rgb(var(--ink) / 0.06), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 0%, rgb(var(--warn) / 0.08), transparent 45%), linear-gradient(180deg, rgb(var(--raised)) 0%, rgb(var(--bg)) 42%, rgb(var(--bg)) 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-multiply"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.45\'/%3E%3C/svg%3E")',
        }}
      />

      <div className="relative mx-auto flex min-h-full max-w-3xl flex-col px-6 py-10 md:max-w-4xl md:px-10">
        <header className="flex flex-wrap items-center gap-3">
          <p className="text-[13px] font-semibold tracking-tight text-ink">{appName}</p>
          <ol className="ml-auto flex flex-wrap items-center gap-1" aria-label="Setup progress">
            {STEPS.map((st, i) => (
              <li
                key={st}
                aria-current={st === step ? 'step' : undefined}
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  i < idx ? 'text-ink/70' : st === step ? 'bg-ink text-bg' : 'text-faint'
                }`}
              >
                {LABELS[st]}
              </li>
            ))}
          </ol>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease }}
            className="mt-10 flex-1"
          >
            {step === 'welcome' && (
              <section className="max-w-xl">
                <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">First run</p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink md:text-5xl">
                  {appName}
                </h1>
                <p className="mt-4 text-base leading-relaxed text-muted">
                  Hi {greet}. Build a flat desk of agents — pick names, skills, and a model pool. Org charts stay
                  optional; hiring never invents a hierarchy for you.
                </p>
                <div className="mt-10 flex flex-wrap items-center gap-4">
                  <button type="button" className={primary} onClick={() => go('profile')}>
                    Start setup <ArrowRightIcon size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={ghost}
                    onClick={() => {
                      set('onboarded', true);
                      api.completeOnboarding('chat').catch(() => undefined);
                      navigate('/chat/chief', { replace: true });
                    }}
                  >
                    Skip → Chief chat
                  </button>
                </div>
              </section>
            )}

            {step === 'profile' && (
              <section>
                <h1 className="text-3xl font-semibold tracking-tight text-ink">How will you use this?</h1>
                <p className="mt-2 max-w-xl text-sm text-muted">Work desks get an optional company step. Personal stays light.</p>

                <label className="mt-6 block max-w-sm">
                  <span className="text-[12px] font-medium text-muted">Your display name</span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value.slice(0, 40))}
                    className="mt-1 h-10 w-full rounded-lg bg-surface px-3 text-[14px] text-ink outline-none ring-1 ring-line focus:ring-ink/30"
                    placeholder={DEFAULT_DISPLAY_NAME}
                  />
                </label>

                <div className="mt-6 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Profile type">
                  {(
                    [
                      { id: 'work' as const, title: 'Work', blurb: 'Team desk, company context, specialist hire.', Icon: BriefcaseIcon },
                      { id: 'personal' as const, title: 'Personal', blurb: 'Solo desk — skip company details.', Icon: HomeIcon },
                    ] as const
                  ).map(({ id, title, blurb, Icon }) => {
                    const on = kind === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setKind(id)}
                        className={`flex items-start gap-3 rounded-2xl bg-surface p-4 text-left ring-1 transition-colors duration-150 ${
                          on ? 'ring-ink/50' : 'ring-line hover:ring-ink/25'
                        }`}
                      >
                        <span className={`mt-0.5 grid h-9 w-9 place-items-center rounded-xl ${on ? 'bg-ink text-bg' : 'bg-raised text-muted'}`}>
                          <Icon size={18} aria-hidden="true" />
                        </span>
                        <span>
                          <span className="block text-[15px] font-semibold text-ink">{title}</span>
                          <span className="mt-0.5 block text-[13px] text-muted">{blurb}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-8 flex flex-wrap gap-4">
                  <button
                    type="button"
                    className={primary}
                    onClick={() => {
                      if (displayName.trim()) set('displayName', displayName.trim());
                      persistProfile({ kind });
                      go(kind === 'work' ? 'company' : 'agents');
                    }}
                  >
                    Continue <ArrowRightIcon size={16} aria-hidden="true" />
                  </button>
                </div>
              </section>
            )}

            {step === 'company' && (
              <section className="max-w-lg">
                <h1 className="text-3xl font-semibold tracking-tight text-ink">Company / about</h1>
                <p className="mt-2 text-sm text-muted">Optional. Agents can use this later for tone — skip anytime.</p>
                <label className="mt-6 block">
                  <span className="text-[12px] font-medium text-muted">Company or project name</span>
                  <input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value.slice(0, 80))}
                    className="mt-1 h-10 w-full rounded-lg bg-surface px-3 text-[14px] text-ink outline-none ring-1 ring-line focus:ring-ink/30"
                    placeholder="e.g. Northwind Labs"
                  />
                </label>
                <label className="mt-4 block">
                  <span className="text-[12px] font-medium text-muted">About</span>
                  <textarea
                    value={companyAbout}
                    onChange={(e) => setCompanyAbout(e.target.value.slice(0, 400))}
                    rows={4}
                    className="mt-1 w-full resize-y rounded-lg bg-surface px-3 py-2 text-[14px] text-ink outline-none ring-1 ring-line focus:ring-ink/30"
                    placeholder="What you build, who you serve…"
                  />
                </label>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <button type="button" className={primary} onClick={advanceFromCompany}>
                    Continue <ArrowRightIcon size={16} aria-hidden="true" />
                  </button>
                  <button type="button" className={ghost} onClick={advanceFromCompany}>
                    Skip
                  </button>
                </div>
              </section>
            )}

            {step === 'agents' && (
              <section>
                <h1 className="text-3xl font-semibold tracking-tight text-ink">Hire your first agents</h1>
                <p className="mt-2 max-w-xl text-sm text-muted">
                  Pick a name set, then select who to create. Batch hire is <span className="font-medium text-ink">flat</span>
                  — no auto reportsTo. Set org later in Office → Hierarchy if you want.
                </p>

                <div className="mt-6 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Name sets">
                  {AGENT_NAME_SETS.map((set) => {
                    const on = set.id === activeSet.id;
                    return (
                      <button
                        key={set.id}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        title={set.description}
                        onClick={() => setSetId(set.id)}
                        className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition-colors duration-150 ${
                          on ? 'bg-ink text-bg' : 'text-muted hover:text-ink'
                        }`}
                      >
                        {set.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <p className="text-[12px] text-muted">{activeSet.description}</p>
                  <button
                    type="button"
                    onClick={pickWholeSet}
                    className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-medium text-ink ring-1 ring-line hover:bg-raised"
                  >
                    Add whole set
                  </button>
                  {picked.length > 0 && (
                    <button type="button" onClick={clearPicks} className="text-[11px] font-medium text-muted hover:text-ink">
                      Clear ({picked.length})
                    </button>
                  )}
                </div>

                <ul className="mt-3 flex max-h-56 flex-wrap gap-1.5 overflow-y-auto" aria-label={`${activeSet.label} names`}>
                  {activeSet.names.map((n) => {
                    const key = draftKey(activeSet.id, n.name, n.role);
                    const selected = picked.some((p) => p.key === key);
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => togglePick(n)}
                          className={`inline-flex max-w-full flex-col items-start rounded-lg px-2.5 py-1.5 text-left ring-1 ring-inset transition-colors duration-150 ${
                            selected ? 'bg-ink text-bg ring-ink' : 'bg-surface text-ink ring-line hover:ring-ink/30'
                          }`}
                        >
                          <span className="text-[12px] font-medium leading-tight">{n.name}</span>
                          {n.role && (
                            <span className={`mt-0.5 text-[10px] leading-tight ${selected ? 'text-bg/70' : 'text-muted'}`}>
                              {n.role}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {picked.length > 0 && (
                  <p className="mt-4 inline-flex items-center gap-2 text-[13px] text-ink">
                    <UsersIcon size={14} aria-hidden="true" />
                    {picked.length} selected · will hire as peers (flat)
                  </p>
                )}

                <div className="mt-8 flex flex-wrap gap-4">
                  <button
                    type="button"
                    className={primary}
                    disabled={picked.length === 0}
                    onClick={() => go('skills')}
                  >
                    Continue <ArrowRightIcon size={16} aria-hidden="true" />
                  </button>
                </div>
              </section>
            )}

            {step === 'skills' && (
              <section>
                <h1 className="text-3xl font-semibold tracking-tight text-ink">Skills for this hire</h1>
                <p className="mt-2 max-w-xl text-sm text-muted">
                  Optional AMS catalog skills applied to all {picked.length} selected agents. Same skills for the batch —
                  tweak per agent later on their profile.
                </p>
                <div className="mt-6 max-w-2xl">
                  <AmsSkillMultiSelect selected={skills} onChange={setSkills} active />
                </div>
                {hireError && <p className="mt-3 text-[13px] text-danger">{hireError}</p>}
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <button type="button" className={primary} disabled={hiring} onClick={() => void advanceFromSkills()}>
                    {hiring ? 'Hiring…' : hired ? 'Continue' : `Hire ${picked.length} flat`}
                    {!hiring && <ArrowRightIcon size={16} aria-hidden="true" />}
                  </button>
                  <button
                    type="button"
                    className={ghost}
                    disabled={hiring}
                    onClick={() => {
                      setSkills([]);
                      void advanceFromSkills();
                    }}
                  >
                    Hire without skills
                  </button>
                </div>
              </section>
            )}

            {step === 'models' && (
              <section>
                <h1 className="text-3xl font-semibold tracking-tight text-ink">Models pool</h1>
                <p className="mt-2 max-w-xl text-sm text-muted">
                  Hint only — agents start on the default chat route. Browse the live pool and assign per agent in Settings
                  → Models when you are ready.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-[12px] text-muted ring-1 ring-line">
                  <CpuIcon size={14} aria-hidden="true" />
                  AMS Micro 70M routes locally first · online asks you
                </div>
                <div className="mt-6">
                  <ModelSuggestions mode={mode} />
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to="/settings/models"
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium text-ink ring-1 ring-line transition-colors hover:bg-raised"
                  >
                    Open models pool
                  </Link>
                  <button type="button" className={primary} onClick={() => go('done')}>
                    Looks good <ArrowRightIcon size={16} aria-hidden="true" />
                  </button>
                </div>
              </section>
            )}

            {step === 'done' && (
              <section className="max-w-lg">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-bg">
                  <CheckIcon size={22} aria-hidden="true" />
                </span>
                <h1 className="mt-5 text-3xl font-semibold tracking-tight text-ink">You are set</h1>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {createdCount > 0
                    ? `Hired ${createdCount} agent${createdCount === 1 ? '' : 's'} as a flat desk.`
                    : 'Setup complete.'}{' '}
                  {kind === 'work' && companyName.trim()
                    ? `Context saved for ${companyName.trim()}. `
                    : ''}
                  Want a hierarchy later? Office → Hierarchy — still optional.
                </p>
                <ul className="mt-6 space-y-2 text-[13px] text-muted">
                  <li className="flex items-center gap-2">
                    <SparklesIcon size={14} className="text-ink" aria-hidden="true" /> Chat with Chief anytime
                  </li>
                  <li className="flex items-center gap-2">
                    <UsersIcon size={14} className="text-ink" aria-hidden="true" /> Roster at Agents
                  </li>
                  <li className="flex items-center gap-2">
                    <Building2Icon size={14} className="text-ink" aria-hidden="true" /> Org chart only if you build one
                  </li>
                </ul>
                <button type="button" className={`mt-10 ${primary}`} onClick={finish}>
                  Enter {appName}
                </button>
              </section>
            )}
          </motion.div>
        </AnimatePresence>

        {idx > 0 && step !== 'done' && (
          <button type="button" onClick={back} className={`mt-10 self-start ${ghost}`}>
            <ArrowLeftIcon size={14} aria-hidden="true" /> Back
          </button>
        )}
      </div>
    </div>
  );
}
