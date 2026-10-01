import type { ProAgent } from '../types/pro';
import { CHIEF_ID } from '../utils/withChief';

/** Chief seat in every Pro set — links to core `/chat/chief`, not a `pro-*` thread. */
export const chiefProAgent: ProAgent = {
  id: CHIEF_ID,
  name: 'Chief',
  role: 'Chief of staff',
  categoryId: 'core',
  look: 'chief',
  height: 'tall',
  skills: ['routing', 'handoffs'],
  model: 'micro',
  deskAgentId: CHIEF_ID,
};
