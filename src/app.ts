import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import chainTemplateRoutes from './routes/chain-template.routes.js';
import commandRoutes from './routes/command.routes.js';
import commandRunRoutes from './routes/command-run.routes.js';
import directoryRoutes from './routes/directory.routes.js';

const app = express();

app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/directories', directoryRoutes);
app.use('/api/commands', commandRoutes);
app.use('/api/chain-templates', chainTemplateRoutes);
app.use('/api/command-runs', commandRunRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found.' });
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ message: 'Internal server error.' });
});

export default app;
