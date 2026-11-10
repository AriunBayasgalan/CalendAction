// Default visible day used when the user has no notBefore/notAfter rules.
// Keep in sync with my-app/frontend/src/app/components/week.ts
// (DAY_START_HOUR / DAY_END_HOUR). The week grid still only draws this range,
// even if a rule allows hours outside it.
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 22;
