import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    location: { type: String, trim: true, maxlength: 200 },
    notes: { type: String, trim: true, maxlength: 2000 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);


eventSchema.pre('validate', function () {
  if (this.start && this.end && this.end < this.start) {
    this.invalidate('end', 'End must be after start');
  }
});

eventSchema.index({ owner: 1, start: 1 });

export default mongoose.model("Event", eventSchema);
