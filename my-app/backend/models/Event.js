import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    location: { type: String, trim: true, maxlength: 200 },
    notes: { type: String, trim: true, maxlength: 2000 },
    // Set on each date of a weekly series. One-off events leave it unset.
    repeat: { type: String, enum: ['weekly'] },
    seriesId: { type: mongoose.Schema.Types.ObjectId, index: true },
    // When the user pressed Start on this block (CA-25); only POST /events/:id/start sets it,
    // and updateEvent clears it when the class gets a new time
    startedAt: { type: Date },
    // CA-24: indexes of the notes lines (the class's to-do) the user checked off
    todoDone: { type: [Number], default: [] },
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
