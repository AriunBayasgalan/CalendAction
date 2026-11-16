import { z } from 'zod';

// CA-24: the to-do lines a user checked off, stored as line indexes of the to-do text
// (split on "\n"). Duplicates are dropped and the list is sorted. Shared by tasks
// (todoText) and classes (notes).
export const todoDoneInput = z
    .array(z.number().int().min(0).max(2000))
    .max(2000)
    .transform((lines) => [...new Set(lines)].sort((a, b) => a - b));
