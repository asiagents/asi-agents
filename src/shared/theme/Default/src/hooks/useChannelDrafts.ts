import { useCallback, useEffect, useState } from 'react';
import { api, type ChannelDraft } from '@asi-api';

export function useChannelDrafts() {
  const [drafts, setDrafts] = useState<ChannelDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await api.channelDrafts();
      setDrafts(r.drafts ?? []);
      setError(null);
    } catch {
      setError('Channel drafts offline — is :3445 up?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const send = useCallback(
    async (id: string) => {
      const r = await api.sendDraft(id);
      await refresh();
      return r;
    },
    [refresh]
  );

  const patch = useCallback(
    async (id: string, body: Partial<Pick<ChannelDraft, 'channel' | 'title' | 'meta' | 'to' | 'body'>>) => {
      const r = await api.patchChannelDraft(id, body);
      await refresh();
      return r.draft;
    },
    [refresh]
  );

  const create = useCallback(
    async (input: {
      channel: ChannelDraft['channel'];
      title: string;
      meta?: string;
      to?: string;
      body?: string;
    }) => {
      const r = await api.createChannelDraft(input);
      await refresh();
      return r.draft;
    },
    [refresh]
  );

  return { drafts, loading, error, refresh, send, patch, create };
}
