import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    // CA-28. Only services/streak.js changes this; the rule is written there.
    // lastDay is the last day ("YYYY-MM-DD" in the user's time zone) a Start counted,
    // and is unset while there is no streak.
    streak: {
      count: { type: Number, default: 0, min: 0 },
      lastDay: { type: String },
    },
  }
);

// removes password when the user object is returned
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('User', userSchema);