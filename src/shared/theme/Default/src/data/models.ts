import type { ModelInfo, ModelLaneInfo } from '../types/models';

export const models: ModelInfo[] = [
{
  id: 'micro',
  name: 'ASI AMS Micro 70M',
  role: 'Local router · on-device',
  tier: 'local',
  note: 'Default router. Handles everything it can without leaving your machine.'
},
{
  id: 'hybrid',
  name: 'ASI AMS Hybrid 120M',
  role: 'Local router · optional',
  tier: 'local',
  note: 'A slightly larger local router for longer notes and readings.'
},
{
  id: 'agentchat',
  name: 'ASI AMS Agent Chat (~50–100M)',
  role: 'Short replies · optional',
  tier: 'local',
  note: 'Quick, short replies for specialists. Stays on-device.'
},
{
  id: 'ultra',
  name: 'Ultra gate ~1M',
  role: 'Edge toy · not ship brain',
  tier: 'edge',
  note: 'Tiny gate for experiments. Never used for real decisions.'
},
{
  id: 'chat1b',
  name: 'Chat 1B',
  role: 'Escalate · off-device',
  tier: 'escalate',
  note: 'Used when a task outgrows local models. Always shown as a handoff first.'
},
{
  id: 'chat3b',
  name: 'Chat 3B',
  role: 'Escalate · off-device',
  tier: 'escalate',
  note: 'For long readings and multi-step reasoning. Always shown as a handoff first.'
},
{
  id: 'cloud',
  name: 'Cloud model',
  role: 'Escalate · user-approved',
  tier: 'cloud',
  note: 'Only runs after you approve. Text leaves this device.'
},
{
  id: 'pending',
  name: 'Model pending',
  role: 'Waiting to load',
  tier: 'status',
  note: 'The agent waits. Nothing runs until a model is ready.'
},
{
  id: 'offline',
  name: 'Model offline',
  role: 'Blocked · fail closed',
  tier: 'status',
  note: 'The agent is blocked. Actions fail closed instead of guessing.'
}];


export const modelLanes: ModelLaneInfo[] = [
{
  id: 'local',
  label: 'Local',
  description: 'On-device. Free, private, and the default.',
  ids: ['micro', 'hybrid']
},
{
  id: 'online',
  label: 'Online',
  description: 'Off-device escalation. Always shown as a handoff first.',
  ids: ['chat1b', 'chat3b']
},
{
  id: 'pro',
  label: 'Pro',
  description: 'Cloud model. Every call waits for your approval.',
  ids: ['cloud']
}];