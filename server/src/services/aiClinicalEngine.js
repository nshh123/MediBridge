// ============================================================================
// MediBridge AI Clinical Drug-Interaction & Triage Assistant (Bonus Point 3)
//   - Analyzes multi-drug interactions, allergy cross-reactivity, and dosage risks
//   - Recommends in-stock generic substitutes across Kigali pharmacies
// ============================================================================

const INTERACTION_KNOWLEDGE_BASE = [
  {
    drugs: ['amoxicillin', 'methotrexate'],
    severity: 'HIGH',
    mechanism: 'Penicillins reduce renal tubular secretion of methotrexate, increasing toxicity risk.',
    clinicalAdvice: 'Monitor CBC and renal function closely or select an alternative macrolide antibiotic.'
  },
  {
    drugs: ['artemether', 'ciprofloxacin'],
    severity: 'MODERATE',
    mechanism: 'Additive QTc interval prolongation risk when combining artemether/lumefantrine with fluoroquinolones.',
    clinicalAdvice: 'Space administration or perform baseline ECG in patients with cardiac risk factors.'
  },
  {
    drugs: ['metformin', 'ciprofloxacin'],
    severity: 'MODERATE',
    mechanism: 'Fluoroquinolones can cause dysglycemia (hypo- or hyperglycemia) when co-administered with metformin.',
    clinicalAdvice: 'Advise patient to monitor blood glucose twice daily during antibiotic course.'
  },
  {
    drugs: ['amlodipine', 'ibuprofen'],
    severity: 'MODERATE',
    mechanism: 'NSAIDs attenuate the antihypertensive effect of calcium-channel blockers and increase renal strain.',
    clinicalAdvice: 'Use Paracetamol (Acetaminophen) for analgesia instead of Ibuprofen in hypertensive patients.'
  },
  {
    drugs: ['warfarin', 'amoxicillin'],
    severity: 'HIGH',
    mechanism: 'Alteration of gut flora reduces vitamin K synthesis, potentiating INR and bleeding risk.',
    clinicalAdvice: 'Check INR within 3-5 days of starting antibiotic therapy.'
  },
  {
    drugs: ['losartan', 'ibuprofen'],
    severity: 'HIGH',
    mechanism: 'Dual blockade of renal autoregulation (ARB + NSAID) significantly increases acute kidney injury risk and hyperkalemia.',
    clinicalAdvice: 'Avoid NSAID co-prescription; substitute with Paracetamol or topical analgesics.'
  },
  {
    drugs: ['omeprazole', 'clopidogrel'],
    severity: 'HIGH',
    mechanism: 'Omeprazole inhibits CYP2C19 bioactivation of clopidogrel, reducing antiplatelet efficacy.',
    clinicalAdvice: 'Switch proton-pump inhibitor to Pantoprazole or Famotidine.'
  }
];

const ALLERGY_CROSS_REACTIVITY = [
  {
    allergyKeyword: 'penicillin',
    flaggedDrugs: ['amoxicillin', 'augmentin', 'ampicillin', 'cloxacillin'],
    warning: 'CRITICAL ALLERGY CONFLICT: Patient reports Penicillin allergy. Beta-lactam cross-reactivity can trigger anaphylaxis.'
  },
  {
    allergyKeyword: 'sulfa',
    flaggedDrugs: ['cotrimoxazole', 'sulfamethoxazole', 'bactrim'],
    warning: 'CRITICAL ALLERGY CONFLICT: Patient reports Sulfonamide allergy. Avoid Cotrimoxazole.'
  },
  {
    allergyKeyword: 'nsaid',
    flaggedDrugs: ['ibuprofen', 'diclofenac', 'aspirin', 'naproxen'],
    warning: 'ALLERGY CONFLICT: Patient has NSAID hypersensitivity/asthma trigger. Use Paracetamol instead.'
  }
];

const SYMPTOM_TRIAGE_RULES = [
  {
    keywords: ['fever', 'chills', 'headache', 'sweating', 'malaria'],
    condition: 'Suspected Uncomplicated Malaria / Acute Febrile Illness',
    urgency: 'URGENT (Visit Clinic within 12-24h for RDT blood test)',
    suggestedCategories: ['Antimalarial', 'Analgesic'],
    suggestedGenericDrugs: ['Artemether + Lumefantrine (Coartem)', 'Paracetamol'],
    clinicalGuidance: 'Do not start antimalarials without a Rapid Diagnostic Test (RDT). Maintain oral hydration.'
  },
  {
    keywords: ['cough', 'throat', 'sputum', 'chest', 'breathing', 'sinus'],
    condition: 'Acute Upper/Lower Respiratory Tract Assessment',
    urgency: 'MODERATE (Clinical auscultation recommended if fever > 38.5C)',
    suggestedCategories: ['Antibiotic', 'Respiratory'],
    suggestedGenericDrugs: ['Amoxicillin + Clavulanic Acid', 'Salbutamol Inhaler', 'Cetirizine'],
    clinicalGuidance: 'Antibiotics require a physician E-Prescription. If shortness of breath occurs, seek emergency care.'
  },
  {
    keywords: ['blood pressure', 'hypertension', 'dizziness', 'palpitations'],
    condition: 'Cardiovascular / Hypertension Maintenance Check',
    urgency: 'PRIORITY (Ensure uninterrupted daily antihypertensive supply)',
    suggestedCategories: ['Cardiovascular'],
    suggestedGenericDrugs: ['Amlodipine', 'Losartan Potassium'],
    clinicalGuidance: 'Never abruptly stop antihypertensive therapy. Use MediBridge Stock Finder to locate continuous refills.'
  },
  {
    keywords: ['thirst', 'glucose', 'diabetes', 'sugar', 'neuropathy'],
    condition: 'Glycemic Control / Type-2 Diabetes Management',
    urgency: 'ROUTINE / PRIORITY REFILL',
    suggestedCategories: ['Endocrine / Antidiabetic'],
    suggestedGenericDrugs: ['Metformin HCl', 'Insulin Glargine'],
    clinicalGuidance: 'Verify cold-chain storage availability when reserving Insulin pens.'
  }
];

export function evaluateClinicalSafety({ medications = [], allergies = [], symptoms = '' }) {
  const normalizedMeds = medications.map((m) => m.toLowerCase().trim()).filter(Boolean);
  const normalizedAllergies = allergies.map((a) => a.toLowerCase().trim()).filter(Boolean);
  const normalizedSymptoms = (symptoms || '').toLowerCase();

  const detectedInteractions = [];
  let severityScore = 10;

  // 1. Check drug-drug interactions
  for (const rule of INTERACTION_KNOWLEDGE_BASE) {
    const [d1, d2] = rule.drugs;
    const hasD1 = normalizedMeds.some((m) => m.includes(d1));
    const hasD2 = normalizedMeds.some((m) => m.includes(d2));
    if (hasD1 && hasD2) {
      detectedInteractions.push({
        pair: `${d1.toUpperCase()} + ${d2.toUpperCase()}`,
        severity: rule.severity,
        mechanism: rule.mechanism,
        clinicalAdvice: rule.clinicalAdvice
      });
      severityScore += rule.severity === 'HIGH' ? 45 : 25;
    }
  }

  // 2. Check allergy cross-reactivity
  for (const rule of ALLERGY_CROSS_REACTIVITY) {
    const hasAllergy = normalizedAllergies.some((a) => a.includes(rule.allergyKeyword));
    if (hasAllergy) {
      for (const flagged of rule.flaggedDrugs) {
        if (normalizedMeds.some((m) => m.includes(flagged))) {
          detectedInteractions.push({
            pair: `ALLERGY (${rule.allergyKeyword.toUpperCase()}) vs ${flagged.toUpperCase()}`,
            severity: 'HIGH',
            mechanism: rule.warning,
            clinicalAdvice: 'Immediately substitute with a non-cross-reactive therapeutic class.'
          });
          severityScore += 60;
        }
      }
    }
  }

  // 3. Symptom triage
  let matchedTriage = null;
  for (const rule of SYMPTOM_TRIAGE_RULES) {
    if (rule.keywords.some((kw) => normalizedSymptoms.includes(kw))) {
      matchedTriage = rule;
      break;
    }
  }

  if (!matchedTriage && normalizedSymptoms.length > 2) {
    matchedTriage = {
      condition: 'General Outpatient Clinical Evaluation',
      urgency: 'ROUTINE (Consult licensed physician or pharmacist)',
      suggestedCategories: ['Analgesic', 'Gastrointestinal'],
      suggestedGenericDrugs: ['Paracetamol', 'Omeprazole'],
      clinicalGuidance: 'Ensure any chronic medications are cross-checked for interactions before adding OTC remedies.'
    };
  }

  severityScore = Math.min(100, severityScore);
  const overallRisk = severityScore >= 55 ? 'HIGH' : severityScore >= 30 ? 'MODERATE' : 'LOW';

  return {
    overallRisk,
    severityScore,
    interactions: detectedInteractions,
    triageAssessment: matchedTriage,
    recommendations: detectedInteractions.length > 0
      ? detectedInteractions.map((i) => i.clinicalAdvice)
      : [
          'No high-risk pharmacokinetic or allergy interactions detected among selected medications.',
          'Verify patient renal/hepatic baseline and counsel on adherence schedule.'
        ],
    evaluatedAt: new Date().toISOString()
  };
}
