// GET /streak (CA-28). The rule itself lives in backend/services/streak.js.
export type Streak = {
  count: number
  // True once a Start has counted today
  countedToday: boolean
}

// "No streak yet", "1-day streak", "5-day streak"
export function streakLabel({ count }: Streak) {
  return count === 0 ? 'No streak yet' : `${count}-day streak`
}

// Hover text: what today still needs
export function streakHint({ countedToday }: Streak) {
  return countedToday
    ? 'Today counts toward your streak.'
    : 'Start a block today to add to your streak. A day with blocks but no Start resets it.'
}
