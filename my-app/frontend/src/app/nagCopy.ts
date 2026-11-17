export type NagSituation =
  | "startingSoon"
  | "skipped"
  | "streakUp"
  | "emptyAfternoon"
  | "nothingScheduled";

// Canned lines the bird can say. Each line is one sentence about one situation.
export const nagCopy: Record<NagSituation, string[]> = {
  startingSoon: [
    "Your next task starts in 15 minutes, so start wrapping up what you're doing.",
    "Heads up, a task begins within 15 minutes, so get ready.",
    "Your next block starts in under 15 minutes, so it's time to get set.",
  ],
  skipped: [
    "You skipped that task, so I moved it to the next open spot.",
    "No problem that you skipped it, but it's waiting in a later slot now.",
    "That task got pushed back, so try to catch it next time.",
  ],
  streakUp: [
    "Your streak just went up, so keep the momentum going!",
    "Another task done, and your streak keeps growing.",
    "Nice work finishing on time, which adds another day to your streak.",
  ],
  emptyAfternoon: [
    "Your afternoon is wide open, so it's a great time to place a task.",
    "Nothing is planned for this afternoon, so why not get ahead?",
    "You have a free afternoon, and a task would fit nicely right now.",
  ],
  nothingScheduled: [
    "You have nothing scheduled yet, so add a task to get started.",
    "Your week is empty, and a single task would be a good first step.",
    "No tasks are on your calendar, so let's put something on it.",
  ],
};