import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    details: { type: String, default: '' },
    cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card' },
  },
  { timestamps: true }
);

activitySchema.index({ boardId: 1, createdAt: -1 });

export const Activity = mongoose.model('Activity', activitySchema);
