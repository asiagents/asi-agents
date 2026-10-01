import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ArchiveRestoreIcon,
  EraserIcon,
  RefreshCwIcon,
  Trash2Icon,
} from 'lucide-react';
import { api, type RecycleBinItem, type RecycleRetentionDays } from '@asi-api';
import { SettingsRow, SettingsSection } from '../../components/settings/SettingsUI';
import { useDesk } from '../../contexts/DeskContext';
import { useAgentsMeta } from '../../contexts/AgentsContext';
import { usePro } from '../../contexts/ProContext';

const RETENTION_OPTIONS: { value: RecycleRetentionDays; label: string }[] = [
  { value: 0, label: 'Immediately' },
  { value: 1, label: '1 day' },
  { value: 3, label: '3 days' },
  { value: 7, label: '7 days' },
  { value: 15, label: '15 days' },
  { value: 30, label: '30 days' },
  { value: 45, label: '45 days' },
  { value: 90, label: '90 days' },
];

const kindLabel: Record<RecycleBinItem['kind'], string> = {
  cleared_chat: 'Cleared chat',
  cleared_group: 'Cleared group',
  deleted_agent: 'Deleted agent',
  deleted_log: 'Deleted logs',
};

function formatWhen(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString();
}

function itemDetail(item: RecycleBinItem): string {
  switch (item.kind) {
    case 'cleared_chat':
      return `${item.payload.messages?.length ?? 0} messages · ${item.payload.threadKey ?? 'thread'}`;
    case 'cleared_group':
      return `${item.payload.groupMessages?.length ?? 0} messages · ${item.payload.groupName ?? item.payload.groupId ?? 'group'}`;
    case 'deleted_agent':
      return item.payload.customPro
        ? `Custom Pro · ${item.payload.agent?.id ?? ''}`
        : `Registry · ${item.payload.agent?.id ?? ''}`;
    case 'deleted_log':
      return `${item.payload.logEntries?.length ?? 0} entries`;
    default:
      return '';
  }
}

export function SettingsLogsRecycle() {
  const { controlLog, log, clearControlLog } = useDesk();
  const { refresh: refreshAgents } = useAgentsMeta();
  const { restoreCustomAgent } = usePro();
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [retentionDays, setRetentionDays] = useState<RecycleRetentionDays>(90);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.recycleBin();
      setItems(data.items);
      setRetentionDays(data.retentionDays);
    } catch {
      toast.error('Could not load recycle bin');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setRetention = async (days: RecycleRetentionDays) => {
    setBusy(true);
    try {
      const data = await api.setRecycleRetention(days);
      setItems(data.items);
      setRetentionDays(data.retentionDays);
      toast.success(
        days === 0
          ? 'Retention set to Immediately — new clears wipe without keeping a copy'
          : `Retention set to ${days} day${days === 1 ? '' : 's'}`
      );
    } catch {
      toast.error('Could not update retention');
    } finally {
      setBusy(false);
    }
  };

  const purgeNow = async () => {
    setBusy(true);
    try {
      const data = await api.purgeRecycleBin();
      setItems(data.items);
      setRetentionDays(data.retentionDays);
      toast.success(data.purged ? `Purged ${data.purged} expired item${data.purged === 1 ? '' : 's'}` : 'Nothing expired');
    } catch {
      toast.error('Purge failed');
    } finally {
      setBusy(false);
    }
  };

  const emptyAll = async () => {
    if (!items.length) return;
    setBusy(true);
    try {
      const data = await api.emptyRecycleBin();
      setItems(data.items);
      toast.success(`Emptied ${data.removed} item${data.removed === 1 ? '' : 's'}`);
    } catch {
      toast.error('Could not empty recycle bin');
    } finally {
      setBusy(false);
    }
  };

  const restore = async (item: RecycleBinItem) => {
    setBusy(true);
    try {
      const data = await api.restoreRecycleItem(item.id);
      setItems(data.items);
      if (item.kind === 'deleted_log' && data.item.payload.logEntries?.length) {
        for (const e of data.item.payload.logEntries) {
          log({
            actor: e.actor,
            agentId: e.agentId,
            text: e.text,
            tone: e.tone,
          });
        }
      }
      if (item.kind === 'deleted_agent') {
        await refreshAgents();
        if (item.payload.customPro && item.payload.agent) {
          const a = item.payload.agent;
          const look = a.roleTag || 'cube';
          const height = (a.initials === 'short' || a.initials === 'tall' ? a.initials : 'mid') as
            | 'short'
            | 'mid'
            | 'tall';
          restoreCustomAgent({
            id: a.id,
            name: a.name,
            role: a.role,
            categoryId: 'custom',
            look,
            height,
            skills: a.skills ?? [],
            model: (a.modelId as 'agentchat') || 'agentchat',
            deskAgentId: a.currentTask || undefined,
          });
        }
      }
      toast.success(`Restored “${item.label}”`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Restore failed';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (id: string) => {
    setBusy(true);
    try {
      const data = await api.deleteRecycleItem(id);
      setItems(data.items);
      toast.success('Permanently deleted');
    } catch {
      toast.error('Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const softDeleteControlLog = async () => {
    if (!controlLog.length) {
      toast.message('Control log is already empty');
      return;
    }
    setBusy(true);
    try {
      await api.softDeleteLogs(
        controlLog.map((e) => ({
          id: e.id,
          time: e.time,
          actor: e.actor,
          agentId: e.agentId,
          text: e.text,
          tone: e.tone,
        })),
        'Control log'
      );
      clearControlLog();
      await reload();
      toast.success('Control log moved to recycle bin');
    } catch {
      toast.error('Could not move control log');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SettingsSection
        title="Retention"
        description="How long soft-deleted chats, agents, and logs stay recoverable. Default is 90 days. Immediately skips the recycle bin."
      >
        <div className="max-w-2xl rounded-card bg-surface ring-1 ring-line">
          <SettingsRow title="Keep for" detail="Applies to new soft-deletes; expired items purge on the hourly job or when you purge now.">
            <select
              value={retentionDays}
              disabled={busy}
              onChange={(e) => void setRetention(Number(e.target.value) as RecycleRetentionDays)}
              className="rounded-lg bg-bg px-2.5 py-1.5 text-[13px] text-ink ring-1 ring-line"
              aria-label="Recycle bin retention"
            >
              {RETENTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </SettingsRow>
          <SettingsRow title="Purge expired" detail="Run the retention job now (also runs hourly in the background).">
            <button
              type="button"
              disabled={busy}
              onClick={() => void purgeNow()}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05] disabled:opacity-40"
            >
              <RefreshCwIcon size={14} aria-hidden="true" /> Purge now
            </button>
          </SettingsRow>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Control log"
        description={`${controlLog.length} entries in your vault. Soft-delete moves a snapshot here instead of wiping forever.`}
      >
        <button
          type="button"
          disabled={busy || !controlLog.length}
          onClick={() => void softDeleteControlLog()}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05] disabled:opacity-40"
        >
          <EraserIcon size={15} aria-hidden="true" /> Soft-delete control log
        </button>
      </SettingsSection>

      <SettingsSection
        title="Recycle bin"
        description={
          loading
            ? 'Loading…'
            : items.length
              ? `${items.length} recoverable item${items.length === 1 ? '' : 's'}. Restore agents and chat snapshots when possible.`
              : 'Empty — cleared chats and deleted agents land here when retention is not Immediately.'
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void reload()}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05] disabled:opacity-40"
          >
            <RefreshCwIcon size={14} aria-hidden="true" /> Refresh
          </button>
          <button
            type="button"
            disabled={busy || !items.length}
            onClick={() => void emptyAll()}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-danger ring-1 ring-danger/30 transition-colors duration-150 hover:bg-danger/10 disabled:opacity-40"
          >
            <Trash2Icon size={14} aria-hidden="true" /> Empty bin
          </button>
        </div>

        {!loading && items.length > 0 && (
          <ul className="max-w-2xl divide-y divide-line rounded-card bg-surface ring-1 ring-line">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ink">{item.label}</div>
                  <div className="mt-0.5 text-[12px] text-muted">
                    {kindLabel[item.kind]} · {itemDetail(item)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-faint">
                    Deleted {formatWhen(item.deletedAt)}
                    {item.expiresAt ? ` · expires ${formatWhen(item.expiresAt)}` : ''}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void restore(item)}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-medium text-accent-ink transition-colors duration-150 hover:bg-accent/10 disabled:opacity-40"
                  >
                    <ArchiveRestoreIcon size={13} aria-hidden="true" /> Restore
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeItem(item.id)}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-medium text-danger transition-colors duration-150 hover:bg-danger/10 disabled:opacity-40"
                  >
                    <Trash2Icon size={13} aria-hidden="true" /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
    </>
  );
}
