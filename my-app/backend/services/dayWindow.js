// Default placement window used when the user has no notBefore/notAfter rules.
// The week grid (my-app/frontend/src/app/components/week.ts) draws all 24 hours
// and opens scrolled to DAY_START_HOUR (SCROLL_TO_HOUR there), so blocks a rule
// places outside this window are still visible.
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 22;
