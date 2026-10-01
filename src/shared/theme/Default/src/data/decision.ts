import { withChiefIds } from '../utils/withChief';

export type Stance = 'for' | 'info' | 'against';

/** Default board / council roster — Chief is always included (product rule). */
export const defaultBoardIds: string[] = withChiefIds(['chief', 'research', 'coder', 'design']);
