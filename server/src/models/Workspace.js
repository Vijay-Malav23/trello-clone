import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        role: {
          type: String,
          enum: ['admin', 'member', 'guest'],
          default: 'member',
        },
      },
    ],
  },
  { timestamps: true }
);

workspaceSchema.index({ 'members.user': 1 });

export const Workspace = mongoose.model('Workspace', workspaceSchema);
