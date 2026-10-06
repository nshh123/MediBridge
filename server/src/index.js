import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { initRelationalDb } from './config/relationalDb.js';
import { initMongoDb } from './config/mongoDb.js';
import { initRabbitMq } from './services/rabbitmq.js';
import { seedDatabasesIfNeeded } from './config/seed.js';
import { recordRequestLatency } from './services/cacheService.js';

import authRoutes from './routes/authRoutes.js';
import pharmacyRoutes from './routes/pharmacyRoutes.js';
import prescriptionRoutes from './routes/prescriptionRoutes.js';
import brokerRoutes from './routes/brokerRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import systemRoutes from './routes/systemRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createApp() {
  await initRelationalDb();
  await initMongoDb();
  await initRabbitMq();
  await seedDatabasesIfNeeded();

  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  // Performance latency profiling middleware (Requirement 6)
  app.use((req, res, next) => {
    const start = performance.now();
    res.on('finish', () => {
      if (req.originalUrl.startsWith('/api')) {
        const duration = performance.now() - start;
        const cacheHeader = res.getHeader('X-Cache') || 'BYPASS';
        recordRequestLatency(req.originalUrl.split('?')[0], req.method, duration, String(cacheHeader));
      }
    });
    next();
  });

  // Healthcheck endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'UP',
      service: 'MediBridge Hybrid Backend API',
      timestamp: new Date().toISOString()
    });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/pharmacies', pharmacyRoutes);
  app.use('/api/prescriptions', prescriptionRoutes);
  app.use('/api/broker', brokerRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/system', systemRoutes);

  // Serve built React frontend in production mode
  const distPath = path.join(__dirname, '../../dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }

  return app;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectRun) {
  const port = Number(process.env.PORT || 4000);
  createApp()
    .then((app) => {
      app.listen(port, () => {
        console.log(`\n[MediBridge API] Listening on http://localhost:${port}`);
        console.log(`[MediBridge API] Relational SQL + MongoDB Document Store + RabbitMQ Broker READY.\n`);
      });
    })
    .catch((err) => {
      console.error('[MediBridge API] Startup error:', err);
      process.exit(1);
    });
}
