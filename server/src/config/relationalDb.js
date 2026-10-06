import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pgPool = null;
let sqliteDb = null;
let activeEngine = 'SQLite (Node Native Relational SQL Engine)';

function convertPlaceholdersForPg(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

export async function initRelationalDb() {
  const schemaPath = path.join(__dirname, '../models/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  if (process.env.POSTGRES_URI) {
    try {
      const pool = new pg.Pool({
        connectionString: process.env.POSTGRES_URI,
        connectionTimeoutMillis: 2500
      });
      await pool.query('SELECT 1');
      await pool.query(schemaSql);
      pgPool = pool;
      activeEngine = 'PostgreSQL (Connection Pool Active)';
      console.log('[RelationalDB] Connected to PostgreSQL server successfully.');
      return;
    } catch (err) {
      console.warn(`[RelationalDB] PostgreSQL unreachable (${err.message}). Falling back to embedded SQL engine.`);
    }
  }

  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = process.env.SQLITE_MEMORY === 'true'
    ? ':memory:'
    : path.join(dataDir, 'medibridge_relational.sqlite');

  sqliteDb = new DatabaseSync(dbPath);
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
  sqliteDb.exec('PRAGMA journal_mode = WAL;');
  sqliteDb.exec(schemaSql);
  activeEngine = process.env.SQLITE_MEMORY === 'true'
    ? 'SQLite In-Memory Relational Engine (Test Mode)'
    : 'SQLite / PostgreSQL Compatible Relational Engine (WAL + Foreign Keys Enforced)';
}

export async function queryAll(sql, params = []) {
  if (pgPool) {
    const res = await pgPool.query(convertPlaceholdersForPg(sql), params);
    return res.rows;
  }
  const stmt = sqliteDb.prepare(sql);
  return stmt.all(...params);
}

export async function queryOne(sql, params = []) {
  if (pgPool) {
    const res = await pgPool.query(convertPlaceholdersForPg(sql), params);
    return res.rows[0] || null;
  }
  const stmt = sqliteDb.prepare(sql);
  return stmt.get(...params) || null;
}

export async function execute(sql, params = []) {
  if (pgPool) {
    const res = await pgPool.query(convertPlaceholdersForPg(sql), params);
    return { changes: res.rowCount };
  }
  const stmt = sqliteDb.prepare(sql);
  return stmt.run(...params);
}

export function getRelationalEngineInfo() {
  return {
    type: 'Relational (SQL)',
    engine: activeEngine,
    foreignKeysEnforced: true,
    indexesActive: [
      'idx_users_email',
      'idx_users_role',
      'idx_pharmacies_district',
      'idx_medications_search',
      'idx_inventory_lookup',
      'idx_inventory_expiry',
      'idx_reservations_patient',
      'idx_reservations_pharmacy'
    ],
    tables: [
      'roles',
      'users',
      'pharmacies',
      'medications',
      'pharmacy_inventory',
      'stock_reservations'
    ]
  };
}
