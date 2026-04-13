import mongoose from 'mongoose';

const boardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    background: { type: String, default: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    starredBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

boardSchema.index({ workspaceId: 1 });

export const Board = mongoose.model('Board', boardSchema);
