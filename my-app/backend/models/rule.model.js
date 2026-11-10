import mongoose from "mongoose";

// Matches times like "09:30" or "18:00" (24-hour clock)
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

// Enforces notBefore < notAfter at the model layer. "HH:MM" strings compare correctly as text.
// On save/create `this` is the document; on findOneAndUpdate (update validators) `this` is the query.
function notAfterIsLater(notAfter) {
  let notBefore;

  if (this instanceof mongoose.Query) {
    const update = this.getUpdate() ?? {};
    notBefore = update.notBefore ?? update.$set?.notBefore;
  } else {
    notBefore = this.notBefore;
  }

  // If notBefore is missing here, its own required/match validator reports it
  // (or, for a partial update, there is nothing to compare against).
  if (notBefore === undefined) return true;

  return notBefore < notAfter;
}

const ruleSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    notBefore: { type: String, required: true, match: timePattern },
    notAfter: {
      type: String,
      required: true,
      match: timePattern,
      validate: {
        validator: notAfterIsLater,
        message: "notBefore must be earlier than notAfter",
      },
    },
    label: { type: String, trim: true },
  },
  { timestamps: true },
);

export default mongoose.model("Rule", ruleSchema);
