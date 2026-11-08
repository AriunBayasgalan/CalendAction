import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
    {
        owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        title: { type: String, required: true, trim: true },
        durationMinutes: { type: Number, required: true, min: 1 },
        dueDate: { type: Date },
        notes: { type: String, default: '' },
        todoText: { type: String, default: '' },
        status: { type: String, enum: ['unscheduled', 'scheduled'], default: 'unscheduled' },
        start: { type: Date }, 
        end: { type: Date }
    },
    { timestamps: true }
);

taskSchema.pre('validate', function () {
  if (this.status === 'scheduled') {
    if (!this.start || !this.end) {
      this.invalidate('start', 'Scheduled tasks require start and end');
    } else if (this.end <= this.start) {
      this.invalidate('end', 'end must be after start');
    }
  } else {
    this.start = undefined;
    this.end = undefined;
  }
});

taskSchema.set('toJSON', {
    transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
    },
});

taskSchema.index({ owner: 1, start: 1 });

export default mongoose.model('Task', taskSchema);