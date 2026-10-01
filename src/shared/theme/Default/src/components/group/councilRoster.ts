import { getAgent } from '../../utils/lookup';
import { withChiefIds } from '../../utils/withChief';
import type { Agent } from '../../types/agents';

/** Council / board members in board order with Chief first (uses defaultBoardIds / desk boardIds). */
export function councilRoster(boardIds: readonly string[]): Agent[] {
  return withChiefIds(boardIds)
    .map((id) => getAgent(id))
    .filter((a): a is Agent => !!a);
}
