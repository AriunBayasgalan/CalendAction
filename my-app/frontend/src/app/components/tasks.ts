import type { Task } from './TaskForm.tsx'

// "Tue, Nov 10, 2:00 PM"
export const placedFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

// Placed tasks (the ones Skip can move), earliest first
export function scheduledTasks(tasks: Task[]) {
  return tasks
    .filter((task) => task.status === 'scheduled' && task.start && task.end)
    .sort((a, b) => Date.parse(a.start!) - Date.parse(b.start!))
}

// What Skip did with the task: a new time, or back to unscheduled when no later hole exists (CA-19)
export function skipMessage(task: Task) {
  return task.status === 'scheduled' && task.start
    ? `Moved “${task.title}” to ${placedFormat.format(new Date(task.start))}.`
    : `No later open time, so “${task.title}” is back in Needs a slot.`
}
