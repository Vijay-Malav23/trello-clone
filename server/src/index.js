import dotenv from "dotenv";
dotenv.config();
import express from 'express';

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'dev-only-change-in-production';
  console.warn('JWT_SECRET not set; using insecure dev default.');
}
import cors from 'cors';
import { connectDb } from './db.js';
import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspaces.js';
import boardRoutes from './routes/boards.js';
import listRoutes from './routes/lists.js';
import cardRoutes from './routes/cards.js';
import commentRoutes from './routes/comments.js';
import notificationRoutes from './routes/notifications.js';
import activityRoutes from './routes/activities.js';

const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://trello-clone-pearl-zeta.vercel.app"
    ],
    credentials: true
  })
);
app.use(express.json());

app.get('/', (req, res) => {
  res.type('html').send(`<!DOCTYPE html><meta charset="utf-8"><title>BoardFlow API</title>
<body style="font-family:system-ui;margin:2rem;line-height:1.5">
<p>This is the <strong>API</strong> (port 5000). There is no web UI here.</p>
<p>Open the app in dev: <a href="http://localhost:5173">http://localhost:5173</a> (Vite must be running — use <code>npm run dev</code> from the project root).</p>
<p>Check API: <a href="/api/health">/api/health</a></p>
</body>`);
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activities', activityRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

connectDb(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((e) => {
    console.error('MongoDB connection failed:', e.message);
    process.exit(1);
  });