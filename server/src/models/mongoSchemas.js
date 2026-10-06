import mongoose from 'mongoose';

// ============================================================================
// MediBridge MongoDB Document Schemas (Mongoose ODM)
// Satisfies Requirement 2c & Requirement 5:
//   Stores rich hierarchical E-Prescription documents, AI clinical reports,
//   and immutable audit/event logs in non-relational collections.
// ============================================================================

const PrescriptionItemSubSchema = new mongoose.Schema({
  medicationId: { type: String, required: true },
  genericName: { type: String, required: true },
  brandName: { type: String },
  strength: { type: String, required: true },
  dosageSchedule: { type: String, required: true }, // e.g., "1 tablet every 8 hours after meals"
  durationDays: { type: Number, required: true },
  quantityPrescribed: { type: Number, required: true },
  dispensedQuantity: { type: Number, default: 0 },
  clinicalNotes: { type: String }
}, { _id: false });

const DispensingEventSubSchema = new mongoose.Schema({
  dispensedAt: { type: String, required: true },
  pharmacyId: { type: String, required: true },
  pharmacyName: { type: String, required: true },
  pharmacistName: { type: String, required: true },
  itemsDispensed: [{
    medicationId: String,
    quantity: Number,
    batchNumber: String
  }],
  verificationNote: String
}, { _id: false });

export const PrescriptionSchema = new mongoose.Schema({
  prescriptionCode: { type: String, required: true, unique: true, index: true },
  patientUserId: { type: String, required: true, index: true },
  patientName: { type: String, required: true },
  patientPhone: { type: String, required: true },
  doctorUserId: { type: String, required: true, index: true },
  doctorName: { type: String, required: true },
  doctorLicense: { type: String, required: true },
  facilityName: { type: String, required: true },
  diagnosisSummary: { type: String, required: true },
  icd10Codes: [{ type: String }],
  patientVitalsSnapshot: {
    bloodPressure: String,
    weightKg: Number,
    temperatureC: Number,
    knownAllergies: [String]
  },
  items: [PrescriptionItemSubSchema],
  aiSafetyCheck: {
    checkedAt: String,
    riskLevel: { type: String, enum: ['LOW', 'MODERATE', 'HIGH'], default: 'LOW' },
    interactionsDetected: [String],
    recommendations: [String]
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'PARTIALLY_DISPENSED', 'DISPENSED', 'EXPIRED', 'REVOKED'],
    default: 'ACTIVE',
    index: true
  },
  digitalSignatureHash: { type: String, required: true },
  dispensingHistory: [DispensingEventSubSchema],
  issuedAt: { type: String, required: true },
  expiresAt: { type: String, required: true }
}, { timestamps: true, collection: 'prescriptions' });

export const AuditEventDocumentSchema = new mongoose.Schema({
  eventType: { type: String, required: true, index: true },
  actorUserId: { type: String },
  actorRole: { type: String },
  actorName: { type: String },
  resourceType: { type: String, required: true },
  resourceId: { type: String },
  severity: { type: String, enum: ['INFO', 'WARN', 'SECURITY'], default: 'INFO' },
  metadata: { type: mongoose.Schema.Types.Mixed },
  ipAddress: { type: String },
  occurredAt: { type: String, required: true, index: true }
}, { collection: 'clinical_audit_logs' });

export const AiTriageDocumentSchema = new mongoose.Schema({
  sessionCode: { type: String, required: true, index: true },
  userId: { type: String },
  userRole: { type: String },
  queryType: { type: String, enum: ['DRUG_INTERACTION', 'SYMPTOM_TRIAGE', 'SUBSTITUTE_LOOKUP'] },
  inputMedications: [String],
  patientAllergies: [String],
  symptomsReported: String,
  analysisResult: {
    overallRisk: String,
    severityScore: Number,
    interactions: [{
      pair: String,
      severity: String,
      mechanism: String,
      clinicalAdvice: String
    }],
    suggestedGenericAlternatives: [String],
    triageRecommendation: String
  },
  createdAt: { type: String, required: true }
}, { collection: 'ai_triage_reports' });

export const PrescriptionModel = mongoose.models.Prescription || mongoose.model('Prescription', PrescriptionSchema);
export const AuditEventModel = mongoose.models.AuditEvent || mongoose.model('AuditEvent', AuditEventDocumentSchema);
export const AiTriageModel = mongoose.models.AiTriage || mongoose.model('AiTriage', AiTriageDocumentSchema);
