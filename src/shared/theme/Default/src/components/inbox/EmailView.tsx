import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MessageSquareIcon, ReplyIcon, UsersIcon } from 'lucide-react';
import { api } from '@asi-api';
import { AgentAvatar } from '../AgentAvatar';
import { ConfirmDialog } from '../ConfirmDialog';
import { useDesk } from '../../contexts/DeskContext';
import { getAgent } from '../../utils/lookup';
import type { Email } from '../../types/inbox';

type DraftState = 'none' | 'editing' | 'saved' | 'sent';

const action =
'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line transition-colors duration-150 hover:bg-overlay/[0.05] disabled:opacity-40';

function replySubject(subject: string): string {
  return /^re:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`;
}

/** Full email first; reply is a draft that only sends after Approve. */
export function EmailView({ email }: {email: Email;}) {
  const navigate = useNavigate();
  const { isTeamMode, log, pausedAt } = useDesk();
  const specialist = email.suggest ? getAgent(email.suggest) : undefined;
  const [draft, setDraft] = useState('');
  const [state, setState] = useState<DraftState>('none');
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setDraft('');
    setState('none');
  }, [email.id]);

  const shareWithChief = () => {
    log({ actor: 'You', agentId: 'chief', text: `Shared "${email.subject}" with Chief`, tone: 'neutral' });
    toast.message('Opened Chief chat — paste or type your summary there.');
    navigate('/chat/chief');
  };

  const callMeeting = () => {
    if (!isTeamMode) {
      toast('Meetings need Multi or Pro', { action: { label: 'Change mode', onClick: () => navigate('/settings/general') } });
      return;
    }
    log({ actor: 'You', text: `Called a meeting about "${email.subject}"`, tone: 'neutral' });
    navigate('/group');
  };

  const summon = () => {
    if (!specialist) return;
    log({ actor: 'You', agentId: specialist.id, text: `Summoned ${specialist.name} for "${email.subject}"`, tone: 'neutral' });
    navigate(`/chat/${specialist.id}`);
  };

  const approveSend = async () => {
    setConfirm(false);
    setSending(true);
    try {
      const result = await api.sendInboxEmail({
        to: email.address,
        subject: replySubject(email.subject),
        text: draft.trim(),
      });
      if (!result.ok) {
        const detail = result.message ?? result.setup ?? result.error ?? 'Send failed';
        toast.error(detail);
        return;
      }
      setState('sent');
      log({ actor: 'You', text: `Approved & sent reply to ${email.address}`, tone: 'success' });
      toast.success('Reply sent');
    } catch {
      toast.error('Inbox send API offline — is the server running on :3445?');
    } finally {
      setSending(false);
    }
  };

  return (
    <article className="flex min-h-0 flex-col" aria-labelledby="email-subject">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-28 pt-5 md:px-8">
        <h1 id="email-subject" className="text-xl font-semibold tracking-tight text-ink">{email.subject}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
          <span className="font-medium text-ink">{email.from}</span>
          <span>&lt;{email.address}&gt;</span>
          <span className="ml-auto text-faint">{email.time}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={action} onClick={() => setState('editing')} disabled={state === 'sent'}>
            <ReplyIcon size={14} aria-hidden="true" /> Reply
          </button>
          <button type="button" className={action} onClick={shareWithChief}>
            <MessageSquareIcon size={14} aria-hidden="true" /> Send chat message
          </button>
          <button type="button" className={action} onClick={callMeeting}>
            <UsersIcon size={14} aria-hidden="true" /> Call meeting
          </button>
          {specialist &&
          <button type="button" className={action} onClick={summon}>
              <AgentAvatar agent={specialist} size="xs" /> Summon {specialist.name}
            </button>
          }
        </div>

        <div className="mt-6 whitespace-pre-line rounded-card bg-surface p-5 text-[14px] leading-relaxed text-ink ring-1 ring-line">{email.body}</div>

        {state !== 'none' &&
        <section aria-label="Reply draft" className="mt-5 rounded-card bg-surface p-4 ring-1 ring-line">
            <div className="mb-2 flex items-center gap-2 text-[12px] font-medium">
              <span className={state === 'sent' ? 'text-success' : 'text-warn'}>
                {state === 'sent' ? 'Sent · logged' : state === 'saved' ? 'Draft saved · waiting for your Approve' : 'Draft · nothing sends until you approve'}
              </span>
            </div>
            <label htmlFor="reply" className="sr-only">Reply</label>
            <textarea
            id="reply"
            rows={6}
            value={draft}
            readOnly={state === 'sent'}
            onChange={(e) => {
              setDraft(e.target.value);
              setState('editing');
            }}
            className="w-full resize-y rounded-lg bg-bg p-3 text-sm text-ink outline-none ring-1 ring-line focus:ring-accent/60"
            placeholder="Write your reply…" />
          
            {state !== 'sent' &&
          <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button type="button" className={action} disabled={!draft.trim()} onClick={() => setState('saved')}>Save draft</button>
                <button
              type="button"
              disabled={!draft.trim() || !!pausedAt || sending}
              onClick={() => setConfirm(true)}
              className="rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-accent-2 disabled:opacity-40">
              
                  {sending ? 'Sending…' : 'Approve & send'}
                </button>
              </div>
          }
          </section>
        }
      </div>
      <ConfirmDialog
        open={confirm}
        title={`Send to ${email.from}?`}
        body="This is the only step that sends. It goes out from your connected account via SMTP and is written to the control log."
        confirmLabel="Approve & send"
        onCancel={() => setConfirm(false)}
        onConfirm={() => void approveSend()} />
      
    </article>);

}
