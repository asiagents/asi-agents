import type { TaskStatus } from '@asi-api';

/** UI buckets on Tasks + home widgets. */
export type TaskBucket = 'ongoing' | 'pending' | 'completed';

const LEGACY: Record<string, TaskStatus> = {
  open: 'pending',
  done: 'completed',
};

/** Normalize API / legacy statuses to the live vocabulary. */
export function normalizeTaskStatus(status: unknown): TaskStatus {
  if (typeof status !== 'string') return 'pending';
  const mapped = LEGACY[status] ?? status;
  if (mapped === 'pending' || mapped === 'ongoing' || mapped === 'completed' || mapped === 'blocked') {
    return mapped;
  }
  return 'pending';
}

/**
 * Map statuses into Tasks page sections:
 * - Ongoing ← ongoing + blocked (in-flight or stuck mid-run)
 * - Pending ← pending
 * - Completed ← completed
 */
export function taskBucket(status: TaskStatus | string): TaskBucket {
  const s = normalizeTaskStatus(status);
  if (s === 'completed') return 'completed';
  if (s === 'pending') return 'pending';
  return 'ongoing';
}

export function isTaskComplete(status: TaskStatus | string): boolean {
  return normalizeTaskStatus(status) === 'completed';
}

export function toggleTaskStatus(status: TaskStatus | string): TaskStatus {
  return isTaskComplete(status) ? 'pending' : 'completed';
}
