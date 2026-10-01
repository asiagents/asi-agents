import type { ChatItem, ChatReply, Proposal } from '../types/chat';

export const chiefThread: ChatItem[] = [];

export const chiefReply: ChatReply = {
  author: 'chief',
  model: 'micro',
  text: ''
};

export const singleThread: ChatItem[] = [];

export const singleReply: ChatReply = {
  author: 'chief',
  model: 'micro',
  text: ''
};

export const groupThread: ChatItem[] = [];

export const groupReply: ChatReply = {
  author: 'chief',
  model: 'micro',
  text: ''
};

export const emptyGroupProposal: Proposal = {
  title: '',
  by: 'chief',
  model: 'micro',
  points: [],
  note: '',
};

export function hasGroupProposalContent(proposal: Proposal): boolean {
  return (
    proposal.title.trim().length > 0 ||
    proposal.points.some((p) => p.trim().length > 0) ||
    proposal.note.trim().length > 0
  );
}