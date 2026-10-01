import { format } from 'date-fns';

export function nowTime(): string {
  return format(new Date(), 'HH:mm');
}

export function createId(): string {
  return Math.random().toString(36).slice(2, 10);
}