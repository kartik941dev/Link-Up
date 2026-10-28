import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { testConnection } from './utils/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import healthRoutes from './routes/health.routes.js';
import cardsRoutes from './routes/cards.routes.js';
import tagsRoutes from './routes/tags.routes.js';
import searchRoutes from './routes/search.routes.js';
import graphRoutes from './routes/graph.routes.js';
import arrangeRoutes from './routes/arrange.routes.js';
import ragRoutes from './routes/rag.routes.js';

const app = express();

// Security and utility middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware in dev
if (config.nodeEnv === 'development') {
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    console.log(`[${req.method}] ${req.url}`);
    next();
  });
}

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cards', cardsRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/graph', graphRoutes);
app.use('/api/arrange', arrangeRoutes);
app.use('/api/rag', ragRoutes);

// 404 Route handler
app.use((_req: express.Request, res: express.Response) => {
  res.status(404).json({
    error: 'The requested API endpoint was not found.',
    code: 'NOT_FOUND',
  });
});

// Centralized error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  console.log(`[INIT] Starting LinkUp Backend server in ${config.nodeEnv} mode...`);

  // Verify database connection on startup
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.warn(
      '[WARN] Database connection failed at startup. Server will continue running, but DB endpoints will fail until connected.'
    );
  }

  app.listen(config.port, () => {
    console.log(`[SERVER] LinkUp Backend is running on port ${config.port}`);
    console.log(`[SERVER] Base URL: ${config.apiUrl}`);
    console.log(`[SERVER] Health check: ${config.apiUrl}/api/health`);
  });
};

startServer();

export default app;
