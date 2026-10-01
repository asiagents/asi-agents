import React from 'react';
import { useParams } from 'react-router-dom';
import { ChatWorkspace } from '../components/chat/ChatWorkspace';

export function Chat() {
  const { threadId = 'chief' } = useParams();
  return <ChatWorkspace threadId={threadId} />;
}