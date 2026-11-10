import { z } from "zod";
import mongoose from "mongoose";
import Rule from "../models/rule.model.js";

// Matches times like "09:30" or "18:00" (24-hour clock)
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

// What a valid rule must look like when someone sends one to us
export const ruleSchema = z
  .object({
    notBefore: z.string().regex(timePattern, "Use a 24-hour time like 10:00"),
    notAfter: z.string().regex(timePattern, "Use a 24-hour time like 18:00"),
    label: z.string().trim().max(50).optional(),
  })
  .refine((rule) => rule.notBefore < rule.notAfter, {
    message: "notBefore must be earlier than notAfter",
    path: ["notAfter"],
  });

// Create a new rule
export async function createRule(req, res) {
  const result = ruleSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Invalid rule",
      details: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const rule = await Rule.create({ ...result.data, owner: req.user.id });
  res.status(201).json(rule);
}

// List the signed-in user's rules
export async function getRules(req, res) {
  const rules = await Rule.find({ owner: req.user.id }).sort({ createdAt: -1 });
  res.json(rules);
}

// Edit an existing rule
export async function updateRule(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid rule id" });
  }

  const result = ruleSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Invalid rule",
      details: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  // Scoped to the owner, so someone else's rule looks like it doesn't exist (404).
  // runValidators makes the model-level checks run on updates too.
  const rule = await Rule.findOneAndUpdate(
    { _id: id, owner: req.user.id },
    result.data,
    { returnDocument: "after", runValidators: true },
  );

  if (!rule) {
    return res.status(404).json({ error: "Rule not found" });
  }

  res.json(rule);
}

// Delete a rule
export async function deleteRule(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid rule id" });
  }

  const rule = await Rule.findOneAndDelete({ _id: id, owner: req.user.id });

  if (!rule) {
    return res.status(404).json({ error: "Rule not found" });
  }

  res.status(204).send();
}