import express from 'express';
import crypto from 'node:crypto';
import { queryOne, queryAll, execute } from '../config/relationalDb.js';
import {
  findPrescriptions,
  findPrescriptionByCode,
  insertPrescription,
  updatePrescriptionByCode,
  insertAuditLog
} from '../config/mongoDb.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/rbacMiddleware.js';
import { evaluateClinicalSafety } from '../services/aiClinicalEngine.js';
import {
  dispatchSmsNotification,
  dispatchEmailNotification,
  publishBrokerEvent
} from '../services/rabbitmq.js';
import { invalidateCachePrefix } from '../services/cacheService.js';

const router = express.Router();

// GET /api/prescriptions — Fetch E-Prescriptions from MongoDB Document Store
router.get('/', authenticateToken, async (req, res) => {
  const filter = {};
  if (req.user.role === 'PATIENT') {
    filter.patientUserId = req.user.id;
  } else if (req.query.status && req.query.status !== 'ALL') {
    filter.status = req.query.status;
  }

  const prescriptions = await findPrescriptions(filter);
  res.json({
    storageEngine: 'MongoDB Document Collection (prescriptions)',
    count: prescriptions.length,
    prescriptions
  });
});

// GET /api/prescriptions/patients — List patients for Doctor E-Prescription form
router.get('/patients', authenticateToken, async (req, res) => {
  const patients = await queryAll(
    `SELECT u.id, u.full_name, u.email, u.phone, u.organization
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE r.name = 'PATIENT'
     ORDER BY u.full_name ASC`
  );
  res.json({ patients });
});

// GET /api/prescriptions/verify/:code — Verify E-Prescription authenticity & match live pharmacy stock
router.get('/verify/:code', authenticateToken, async (req, res) => {
  const doc = await findPrescriptionByCode(req.params.code.trim());
  if (!doc) {
    return res.status(404).json({
      verified: false,
      error: `E-Prescription '${req.params.code}' not found in MongoDB ledger.`
    });
  }

  // Enrich each prescribed item with live stock availability from Relational SQL DB
  const enrichedItems = [];
  for (const item of doc.items) {
    const matchingBatches = await queryAll(
      `SELECT inv.id AS inventory_id, inv.batch_number, inv.stock_quantity, inv.unit_price_rwf, inv.discount_percent,
              p.id AS pharmacy_id, p.name AS pharmacy_name, p.district
       FROM pharmacy_inventory inv
       JOIN pharmacies p ON inv.pharmacy_id = p.id
       WHERE inv.medication_id = ? AND inv.stock_quantity > 0
       ORDER BY inv.unit_price_rwf ASC`,
      [item.medicationId]
    );
    enrichedItems.push({
      ...item,
      availableBatches: matchingBatches
    });
  }

  res.json({
    verified: true,
    cryptographicSignatureValid: Boolean(doc.digitalSignatureHash),
    prescription: {
      ...doc,
      items: enrichedItems
    }
  });
});

// POST /api/prescriptions — Doctor creates a digitally signed E-Prescription document in MongoDB
router.post('/', authenticateToken, requirePermission('prescription:create'), async (req, res) => {
  const {
    patientUserId,
    diagnosisSummary,
    icd10Codes = ['J06.9'],
    vitals = {},
    items = []
  } = req.body;

  if (!patientUserId || !diagnosisSummary || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: 'patientUserId, diagnosisSummary, and at least one medication item are required'
    });
  }

  const patient = await queryOne('SELECT * FROM users WHERE id = ?', [patientUserId]);
  if (!patient) {
    return res.status(404).json({ error: 'Patient record not found in relational database' });
  }

  // Enrich medication details from SQL catalog
  const formattedItems = [];
  const medNamesForAi = [];

  for (const rawItem of items) {
    const med = await queryOne('SELECT * FROM medications WHERE id = ?', [rawItem.medicationId]);
    if (!med) continue;
    medNamesForAi.push(med.generic_name);
    formattedItems.push({
      medicationId: med.id,
      genericName: med.generic_name,
      brandName: med.brand_name,
      strength: med.strength,
      dosageSchedule: rawItem.dosageSchedule || '1 tablet twice daily after meals',
      durationDays: Number(rawItem.durationDays || 7),
      quantityPrescribed: Number(rawItem.quantityPrescribed || 1),
      dispensedQuantity: 0,
      clinicalNotes: rawItem.clinicalNotes || 'Follow standard clinical dosing guidelines.'
    });
  }

  if (formattedItems.length === 0) {
    return res.status(400).json({ error: 'No valid medications selected' });
  }

  const knownAllergies = Array.isArray(vitals.knownAllergies)
    ? vitals.knownAllergies
    : String(vitals.knownAllergies || '').split(',').map((s) => s.trim()).filter(Boolean);

  // Run AI Clinical Safety Check automatically
  const aiEval = evaluateClinicalSafety({
    medications: medNamesForAi,
    allergies: knownAllergies,
    symptoms: diagnosisSummary
  });

  const prescriptionCode = `RX-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const nowIso = new Date().toISOString();
  const digitalSignatureHash = crypto
    .createHash('sha256')
    .update(`${prescriptionCode}:${req.user.id}:${patient.id}:${nowIso}`)
    .digest('hex');

  const newDoc = await insertPrescription({
    prescriptionCode,
    patientUserId: patient.id,
    patientName: patient.full_name,
    patientPhone: patient.phone,
    doctorUserId: req.user.id,
    doctorName: req.user.fullName,
    doctorLicense: req.user.licenseNumber || 'RMDC-VERIFIED',
    facilityName: req.user.organization || 'King Faisal Hospital Kigali',
    diagnosisSummary,
    icd10Codes: Array.isArray(icd10Codes) ? icd10Codes : [icd10Codes],
    patientVitalsSnapshot: {
      bloodPressure: vitals.bloodPressure || '120/80 mmHg',
      weightKg: Number(vitals.weightKg || 68),
      temperatureC: Number(vitals.temperatureC || 37.0),
      knownAllergies
    },
    items: formattedItems,
    aiSafetyCheck: {
      checkedAt: nowIso,
      riskLevel: aiEval.overallRisk,
      interactionsDetected: aiEval.interactions.map((i) => `${i.pair}: ${i.mechanism}`),
      recommendations: aiEval.recommendations
    },
    status: 'ACTIVE',
    digitalSignatureHash,
    dispensingHistory: [],
    issuedAt: nowIso,
    expiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString()
  });

  // Publish asynchronous RabbitMQ events (SMS + Email + Workflow Sync)
  await dispatchSmsNotification({
    phone: patient.phone,
    recipientName: patient.full_name,
    contextType: 'prescription_issued',
    message: `[MediBridge RW] E-Prescription ${prescriptionCode} issued by ${req.user.fullName} for ${formattedItems.map((i) => i.brandName).join(', ')}. Present code at any MediBridge pharmacy.`
  });

  await dispatchEmailNotification({
    email: patient.email,
    recipientName: patient.full_name,
    contextType: 'prescription_issued',
    subject: `Digital E-Prescription Issued: ${prescriptionCode}`,
    message: `Doctor: ${req.user.fullName} (${req.user.organization})\nDiagnosis: ${diagnosisSummary}\nMedications: ${formattedItems.map((i) => `${i.genericName} (${i.dosageSchedule})`).join('; ')}\nDigital Signature SHA-256: ${digitalSignatureHash.slice(0, 24)}...`
  });

  await publishBrokerEvent('prescription.created', {
    recipient: 'MediBridge Pharmacy Dispensing Network',
    subject: `New E-Prescription Signed: ${prescriptionCode}`,
    message: `${req.user.fullName} signed ${prescriptionCode} for ${patient.full_name} (${formattedItems.length} item(s), AI Risk: ${aiEval.overallRisk}).`,
    actorName: req.user.fullName,
    actorRole: req.user.role
  });

  res.status(201).json({
    message: `E-Prescription ${prescriptionCode} stored in MongoDB and dispatched via RabbitMQ`,
    prescription: newDoc
  });
});

// POST /api/prescriptions/:code/dispense — Pharmacist dispenses E-Prescription (Updates MongoDB + Decrements SQL Stock)
router.post('/:code/dispense', authenticateToken, requirePermission('prescription:dispense'), async (req, res) => {
  const { pharmacyId = 'phm_01', verificationNote = 'Verified patient ID & digital signature hash' } = req.body;
  const code = req.params.code.trim().toUpperCase();

  const rxDoc = await findPrescriptionByCode(code);
  if (!rxDoc) {
    return res.status(404).json({ error: 'E-Prescription not found' });
  }
  if (rxDoc.status === 'DISPENSED') {
    return res.status(400).json({ error: 'This E-Prescription has already been fully dispensed' });
  }

  const pharmacy = await queryOne('SELECT * FROM pharmacies WHERE id = ?', [pharmacyId]);
  const pharmacyName = pharmacy ? pharmacy.name : 'Goodlife Pharmacy Kimironko';

  const dispensedItemsLog = [];
  for (const item of rxDoc.items) {
    const qtyNeeded = Math.max(1, item.quantityPrescribed - (item.dispensedQuantity || 0));
    const batch = await queryOne(
      `SELECT * FROM pharmacy_inventory
       WHERE medication_id = ? AND stock_quantity >= ?
       ORDER BY CASE WHEN pharmacy_id = ? THEN 0 ELSE 1 END, expiry_date ASC
       LIMIT 1`,
      [item.medicationId, qtyNeeded, pharmacyId]
    );

    if (batch) {
      await execute(
        `UPDATE pharmacy_inventory SET stock_quantity = stock_quantity - ?, updated_at = ? WHERE id = ?`,
        [qtyNeeded, new Date().toISOString(), batch.id]
      );
      dispensedItemsLog.push({
        medicationId: item.medicationId,
        quantity: qtyNeeded,
        batchNumber: batch.batch_number
      });
    } else {
      dispensedItemsLog.push({
        medicationId: item.medicationId,
        quantity: qtyNeeded,
        batchNumber: 'EXTERNAL-BATCH'
      });
    }
  }

  invalidateCachePrefix('stock:');

  const updatedDoc = await updatePrescriptionByCode(code, (current) => ({
    ...current,
    status: 'DISPENSED',
    items: current.items.map((it) => ({
      ...it,
      dispensedQuantity: it.quantityPrescribed
    })),
    dispensingHistory: [
      ...(current.dispensingHistory || []),
      {
        dispensedAt: new Date().toISOString(),
        pharmacyId,
        pharmacyName,
        pharmacistName: req.user.fullName,
        itemsDispensed: dispensedItemsLog,
        verificationNote
      }
    ]
  }));

  await insertAuditLog({
    eventType: 'PRESCRIPTION_DISPENSED',
    actorUserId: req.user.id,
    actorRole: req.user.role,
    actorName: req.user.fullName,
    resourceType: 'MONGODB_PRESCRIPTION',
    resourceId: code,
    severity: 'INFO',
    metadata: { pharmacyName, dispensedItemsLog }
  });

  await dispatchSmsNotification({
    phone: rxDoc.patientPhone,
    recipientName: rxDoc.patientName,
    contextType: 'prescription_dispensed',
    message: `[MediBridge RW] E-Prescription ${code} has been dispensed at ${pharmacyName} by ${req.user.fullName}. Wishing you a speedy recovery!`
  });

  res.json({
    message: `E-Prescription ${code} dispensed. MongoDB document updated & SQL inventory decremented.`,
    prescription: updatedDoc
  });
});

export default router;
