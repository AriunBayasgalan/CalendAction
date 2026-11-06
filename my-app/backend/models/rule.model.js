import mongoose from "mongoose";

// Matches times like "09:30" or "18:00" (24-hour clock)
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const ruleSchema = new mongoose.Schema(
  {
    notBefore: { type: String, required: true, match: timePattern },
    notAfter: { type: String, required: true, match: timePattern },
    label: { type: String, trim: true },
  },
  { timestamps: true },
);

export default mongoose.model("Rule", ruleSchema);