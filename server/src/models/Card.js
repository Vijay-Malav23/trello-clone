import mongoose from 'mongoose';

const cardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    listId: { type: mongoose.Schema.Types.ObjectId, ref: 'List', required: true },
    position: { type: Number, default: 0 },
    assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    dueDate: { type: Date, default: null },
  },
  { timestamps: true }
);

cardSchema.index({ listId: 1, position: 1 });

export const Card = mongoose.model('Card', cardSchema);
