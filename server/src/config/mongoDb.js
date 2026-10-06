import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import {
  PrescriptionModel,
  AuditEventModel,
  AiTriageModel
} from '../models/mongoSchemas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isNativeMongoConnected = false;
let activeMongoEngine = 'MongoDB Document Store (Embedded BSON/JSON Collection Engine)';
let collectionsPath = null;

let memCollections = {
  prescriptions: [],
  clinical_audit_logs: [],
  ai_triage_reports: []
};

function generateObjectId() {
  return crypto.randomBytes(12).toString('hex');
}

function saveLocalCollections() {
  if (!collectionsPath || process.env.SQLITE_MEMORY === 'true') return;
  try {
    fs.writeFileSync(collectionsPath, JSON.stringify(memCollections, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[MongoDB] Failed to persist local collections:', err.message);
  }
}

export async function initMongoDb() {
  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  collectionsPath = path.join(dataDir, 'runtime_mongodb_collections.json');

  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 2500
      });
      isNativeMongoConnected = true;
      activeMongoEngine = 'MongoDB Native Server (Mongoose ODM Connected)';
      console.log('[MongoDB] Connected to MongoDB server successfully.');
      return;
    } catch (err) {
      console.warn(`[MongoDB] MongoDB server unreachable (${err.message}). Using embedded MongoDB document engine.`);
    }
  }

  if (process.env.SQLITE_MEMORY !== 'true' && fs.existsSync(collectionsPath)) {
    try {
      const raw = fs.readFileSync(collectionsPath, 'utf-8');
      const parsed = JSON.parse(raw);
      memCollections = {
        prescriptions: parsed.prescriptions || [],
        clinical_audit_logs: parsed.clinical_audit_logs || [],
        ai_triage_reports: parsed.ai_triage_reports || []
      };
    } catch {
      // reset if corrupt
    }
  }
  activeMongoEngine = process.env.SQLITE_MEMORY === 'true'
    ? 'MongoDB Document Engine (In-Memory Test Mode)'
    : 'MongoDB Document Engine (Mongoose Schema Validated + JSON-BSON Persistence)';
}

// ============================================================================
// Prescriptions Collection Operations
// ============================================================================

export async function findPrescriptions(filter = {}) {
  if (isNativeMongoConnected) {
    return await PrescriptionModel.find(filter).sort({ issuedAt: -1 }).lean();
  }
  return memCollections.prescriptions
    .filter((doc) => {
      if (filter.patientUserId && doc.patientUserId !== filter.patientUserId) return false;
      if (filter.doctorUserId && doc.doctorUserId !== filter.doctorUserId) return false;
      if (filter.status && doc.status !== filter.status) return false;
      if (filter.prescriptionCode && doc.prescriptionCode.toUpperCase() !== filter.prescriptionCode.toUpperCase()) return false;
      return true;
    })
    .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
}

export async function findPrescriptionByCode(code) {
  if (isNativeMongoConnected) {
    return await PrescriptionModel.findOne({ prescriptionCode: code.toUpperCase() }).lean();
  }
  return memCollections.prescriptions.find(
    (doc) => doc.prescriptionCode.toUpperCase() === code.toUpperCase()
  ) || null;
}

export async function insertPrescription(docData) {
  const docWithId = {
    _id: docData._id || generateObjectId(),
    ...docData,
    dispensingHistory: docData.dispensingHistory || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (isNativeMongoConnected) {
    const created = await PrescriptionModel.create(docWithId);
    return created.toObject();
  }

  memCollections.prescriptions.unshift(docWithId);
  saveLocalCollections();
  return docWithId;
}

export async function updatePrescriptionByCode(code, updateFnOrPatch) {
  if (isNativeMongoConnected) {
    const existing = await PrescriptionModel.findOne({ prescriptionCode: code.toUpperCase() });
    if (!existing) return null;
    const updatedObj = typeof updateFnOrPatch === 'function'
      ? updateFnOrPatch(existing.toObject())
      : { ...existing.toObject(), ...updateFnOrPatch };
    Object.assign(existing, updatedObj);
    await existing.save();
    return existing.toObject();
  }

  const idx = memCollections.prescriptions.findIndex(
    (d) => d.prescriptionCode.toUpperCase() === code.toUpperCase()
  );
  if (idx === -1) return null;

  const current = memCollections.prescriptions[idx];
  const updated = typeof updateFnOrPatch === 'function'
    ? updateFnOrPatch({ ...current })
    : { ...current, ...updateFnOrPatch };
  updated.updatedAt = new Date().toISOString();
  memCollections.prescriptions[idx] = updated;
  saveLocalCollections();
  return updated;
}

// ============================================================================
// Clinical Audit Logs Collection Operations
// ============================================================================

export async function insertAuditLog(logData) {
  const doc = {
    _id: generateObjectId(),
    severity: 'INFO',
    ...logData,
    occurredAt: logData.occurredAt || new Date().toISOString()
  };

  if (isNativeMongoConnected) {
    const created = await AuditEventModel.create(doc);
    return created.toObject();
  }

  memCollections.clinical_audit_logs.unshift(doc);
  if (memCollections.clinical_audit_logs.length > 250) {
    memCollections.clinical_audit_logs.length = 250;
  }
  saveLocalCollections();
  return doc;
}

export async function findAuditLogs(limit = 50) {
  if (isNativeMongoConnected) {
    return await AuditEventModel.find({}).sort({ occurredAt: -1 }).limit(limit).lean();
  }
  return memCollections.clinical_audit_logs.slice(0, limit);
}

// ============================================================================
// AI Triage Reports Collection Operations
// ============================================================================

export async function insertAiTriageReport(reportData) {
  const doc = {
    _id: generateObjectId(),
    ...reportData,
    createdAt: reportData.createdAt || new Date().toISOString()
  };

  if (isNativeMongoConnected) {
    const created = await AiTriageModel.create(doc);
    return created.toObject();
  }

  memCollections.ai_triage_reports.unshift(doc);
  saveLocalCollections();
  return doc;
}

export async function findAiTriageReports(limit = 25) {
  if (isNativeMongoConnected) {
    return await AiTriageModel.find({}).sort({ createdAt: -1 }).limit(limit).lean();
  }
  return memCollections.ai_triage_reports.slice(0, limit);
}

export async function getMongoStats() {
  if (isNativeMongoConnected) {
    const [rxCount, auditCount, aiCount] = await Promise.all([
      PrescriptionModel.countDocuments(),
      AuditEventModel.countDocuments(),
      AiTriageModel.countDocuments()
    ]);
    return {
      type: 'Non-Relational (NoSQL Document Store)',
      engine: activeMongoEngine,
      collections: [
        { name: 'prescriptions', count: rxCount, indexedFields: ['prescriptionCode', 'patientUserId', 'doctorUserId', 'status'] },
        { name: 'clinical_audit_logs', count: auditCount, indexedFields: ['eventType', 'occurredAt'] },
        { name: 'ai_triage_reports', count: aiCount, indexedFields: ['sessionCode'] }
      ]
    };
  }

  return {
    type: 'Non-Relational (NoSQL Document Store)',
    engine: activeMongoEngine,
    collections: [
      { name: 'prescriptions', count: memCollections.prescriptions.length, indexedFields: ['prescriptionCode', 'patientUserId', 'doctorUserId', 'status'] },
      { name: 'clinical_audit_logs', count: memCollections.clinical_audit_logs.length, indexedFields: ['eventType', 'occurredAt'] },
      { name: 'ai_triage_reports', count: memCollections.ai_triage_reports.length, indexedFields: ['sessionCode'] }
    ]
  };
}
