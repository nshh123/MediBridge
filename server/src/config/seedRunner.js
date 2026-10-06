import { initRelationalDb } from './relationalDb.js';
import { initMongoDb } from './mongoDb.js';
import { initRabbitMq } from '../services/rabbitmq.js';
import { seedDatabasesIfNeeded } from './seed.js';

async function run() {
  await initRelationalDb();
  await initMongoDb();
  await initRabbitMq();
  await seedDatabasesIfNeeded();
  console.log('[SeedRunner] Completed database seeding successfully.');
  process.exit(0);
}

run();
