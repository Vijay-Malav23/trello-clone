import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

commentSchema.index({ cardId: 1, createdAt: 1 });

export const Comment = mongoose.model('Comment', commentSchema);
