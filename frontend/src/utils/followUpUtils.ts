import { FollowUp } from '../types/models';

export interface CategorizedFollowUps {
  today: FollowUp[];
  overdue: FollowUp[];
  upcoming: FollowUp[];
  completed: FollowUp[];
}

export function categorizeFollowUps(followUps: FollowUp[]): CategorizedFollowUps {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
  const currentTime = now.getTime();

  const today: FollowUp[] = [];
  const overdue: FollowUp[] = [];
  const upcoming: FollowUp[] = [];
  const completed: FollowUp[] = [];

  for (const item of followUps) {
    if (item.status === 'COMPLETED' || item.status === 'CANCELLED') {
      completed.push(item);
      continue;
    }

    const dueTime = new Date(item.dueAt).getTime();

    if (dueTime < currentTime && dueTime < startOfToday) {
      // Overdue prior to today
      overdue.push(item);
    } else if (dueTime >= startOfToday && dueTime <= endOfToday) {
      // Scheduled for today (whether earlier today or later today)
      today.push(item);
    } else if (dueTime > endOfToday) {
      // Scheduled for future days
      upcoming.push(item);
    } else {
      // Past due fallback
      overdue.push(item);
    }
  }

  // Sort logically:
  // Overdue: oldest due first (most urgent)
  overdue.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  // Today: earliest due time first
  today.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  // Upcoming: earliest due date first
  upcoming.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  // Completed: most recently completed first
  completed.sort((a, b) => {
    const timeA = new Date(a.completedAt || a.updatedAt).getTime();
    const timeB = new Date(b.completedAt || b.updatedAt).getTime();
    return timeB - timeA;
  });

  return { today, overdue, upcoming, completed };
}

export function getNextPendingFollowUp(followUps: FollowUp[] = []): FollowUp | null {
  const pending = followUps.filter((f) => f.status === 'PENDING' || f.status === 'IN_PROGRESS');
  if (pending.length === 0) return null;

  pending.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  return pending[0];
}
