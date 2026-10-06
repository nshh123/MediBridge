import express from 'express';
import crypto from 'node:crypto';
import { queryAll } from '../config/relationalDb.js';
import {
  insertAiTriageReport,
  findAiTriageReports
} from '../config/mongoDb.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { evaluateClinicalSafety } from '../services/aiClinicalEngine.js';

const router = express.Router();

// POST /api/ai/evaluate — Bonus 3: AI Clinical Drug Interaction & Symptom Triage Assistant
router.post('/evaluate', authenticateToken, async (req, res) => {
  const {
    medications = [],
    allergies = [],
    symptoms = ''
  } = req.body;

  const evaluation = evaluateClinicalSafety({
    medications,
    allergies,
    symptoms
  });

  // Cross-reference safe / recommended medicines against live SQL pharmacy stock
  const inStockMatches = await queryAll(
    `SELECT inv.id AS inventory_id, inv.stock_quantity, inv.unit_price_rwf, inv.discount_percent,
            m.generic_name, m.brand_name, m.category,
            p.name AS pharmacy_name, p.district
     FROM pharmacy_inventory inv
     JOIN medications m ON inv.medication_id = m.id
     JOIN pharmacies p ON inv.pharmacy_id = p.id
     WHERE inv.stock_quantity > 0
     ORDER BY inv.unit_price_rwf ASC
     LIMIT 6`
  );

  const sessionCode = `TRIAGE-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const savedDoc = await insertAiTriageReport({
    sessionCode,
    userId: req.user.id,
    userRole: req.user.role,
    queryType: medications.length > 0 ? 'DRUG_INTERACTION' : 'SYMPTOM_TRIAGE',
    inputMedications: medications,
    patientAllergies: allergies,
    symptomsReported: symptoms,
    analysisResult: {
      overallRisk: evaluation.overallRisk,
      severityScore: evaluation.severityScore,
      interactions: evaluation.interactions,
      suggestedGenericAlternatives: evaluation.triageAssessment?.suggestedGenericDrugs || ['Paracetamol (Acetaminophen)'],
      triageRecommendation: evaluation.triageAssessment?.clinicalGuidance || evaluation.recommendations[0]
    }
  });

  res.json({
    sessionCode,
    evaluation,
    inStockMatches,
    mongoDocumentId: savedDoc._id
  });
});

// GET /api/ai/history — Retrieve past AI Triage & Interaction documents from MongoDB
router.get('/history', authenticateToken, async (req, res) => {
  const reports = await findAiTriageReports(20);
  res.json({ reports });
});

export default router;
