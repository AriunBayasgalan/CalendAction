import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
    {
        owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        title: { type: String, required: true, trim: true, maxlength: 200 },
        durationMinutes: { type: Number, required: true, min: 1 },
        dueDate: { type: Date },
        notes: { type: String, default: '', maxlength: 2000 },
        todoText: { type: String, default: '', maxlength: 2000 },
        status: { type: String, enum: ['unscheduled'], default: 'unscheduled' },
    },
    { timestamps: true }
);

taskSchema.set('toJSON', {
    transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
    },
});

export default mongoose.model('Task', taskSchema);