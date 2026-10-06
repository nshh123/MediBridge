import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { queryOne, execute } from './relationalDb.js';
import {
  findPrescriptions,
  insertPrescription,
  insertAuditLog,
  insertAiTriageReport
} from './mongoDb.js';
import { RBAC_ROLE_DEFINITIONS } from '../middleware/rbacMiddleware.js';
import { publishBrokerEvent } from '../services/rabbitmq.js';

export async function seedDatabasesIfNeeded() {
  const existingRole = await queryOne('SELECT id FROM roles LIMIT 1');
  if (existingRole) {
    await execute(
      `UPDATE users SET full_name = ? WHERE id = 'usr_admin_01'`,
      ['Sam Musoni']
    );
    return;
  }

  console.log('[Seed] Populating Relational SQL Tables & MongoDB Document Collections...');
  const nowIso = new Date().toISOString();

  // 1. Seed RBAC Roles (Relational DB)
  for (const roleKey of Object.keys(RBAC_ROLE_DEFINITIONS)) {
    const r = RBAC_ROLE_DEFINITIONS[roleKey];
    await execute(
      `INSERT INTO roles (id, name, description, permissions_json) VALUES (?, ?, ?, ?)`,
      [r.id, r.name, r.description, JSON.stringify(r.permissions)]
    );
  }

  // 2. Seed Users across all 4 RBAC roles (Relational DB)
  const passwordHash = bcrypt.hashSync('Password123!', 10);

  const demoUsers = [
    {
      id: 'usr_patient_01',
      fullName: 'Aline Uwase',
      email: 'aline.patient@medibridge.rw',
      phone: '+250 788 412 091',
      roleId: 'role_patient',
      oauthProvider: 'google-oauth2',
      oauthSubject: 'google_sub_10928374',
      licenseNumber: null,
      organization: 'RSSB Member #RW-88412'
    },
    {
      id: 'usr_patient_02',
      fullName: 'Jean-Paul Habimana',
      email: 'jp.patient@medibridge.rw',
      phone: '+250 785 209 334',
      roleId: 'role_patient',
      oauthProvider: 'local',
      oauthSubject: null,
      licenseNumber: null,
      organization: 'MMI Insured #MMI-4429'
    },
    {
      id: 'usr_doctor_01',
      fullName: 'Dr. Eric Mugisha',
      email: 'dr.mugisha@medibridge.rw',
      phone: '+250 788 301 552',
      roleId: 'role_doctor',
      oauthProvider: 'google-oauth2',
      oauthSubject: 'google_sub_99281726',
      licenseNumber: 'RMDC-2026-0842',
      organization: 'King Faisal Hospital Kigali'
    },
    {
      id: 'usr_pharmacist_01',
      fullName: 'Chantal Mukamana, BPharm',
      email: 'chantal.pharma@medibridge.rw',
      phone: '+250 788 619 820',
      roleId: 'role_pharmacist',
      oauthProvider: 'local',
      oauthSubject: null,
      licenseNumber: 'NPC-RW-1194',
      organization: 'Goodlife Pharmacy Kimironko'
    },
    {
      id: 'usr_admin_01',
      fullName: 'Sam Musoni',
      email: 'admin@medibridge.rw',
      phone: '+250 788 100 001',
      roleId: 'role_admin',
      oauthProvider: 'github-oauth2',
      oauthSubject: 'gh_sub_551920',
      licenseNumber: 'SYS-ROOT-01',
      organization: 'Rwanda FDA / MediBridge Core'
    }
  ];

  for (const u of demoUsers) {
    await execute(
      `INSERT INTO users (id, full_name, email, phone, password_hash, role_id, oauth_provider, oauth_subject, license_number, organization, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        u.id,
        u.fullName,
        u.email,
        u.phone,
        passwordHash,
        u.roleId,
        u.oauthProvider,
        u.oauthSubject,
        u.licenseNumber,
        u.organization,
        nowIso
      ]
    );
  }

  // 3. Seed Pharmacies across Kigali Districts (Relational DB)
  const pharmacies = [
    {
      id: 'phm_01',
      name: 'Goodlife Pharmacy Kimironko',
      district: 'Gasabo',
      sector: 'Kimironko',
      address: 'KG 11 Ave, Opposite Kimironko Market',
      latitude: -1.9487,
      longitude: 30.1262,
      phone: '+250 788 619 820',
      email: 'kimironko@goodlife.rw',
      operatingHours: '24 Hours / 7 Days',
      acceptsRssb: 1,
      acceptsMmi: 1,
      acceptsRadiant: 1,
      verified: 1,
      managerUserId: 'usr_pharmacist_01'
    },
    {
      id: 'phm_02',
      name: 'Kipharma Central Pharmacy',
      district: 'Nyarugenge',
      sector: 'Nyarugenge',
      address: 'KN 4 Ave, Downtown Kigali CBD',
      latitude: -1.9501,
      longitude: 30.0588,
      phone: '+250 788 304 111',
      email: 'dispensary@kipharma.rw',
      operatingHours: '07:30 - 22:00',
      acceptsRssb: 1,
      acceptsMmi: 1,
      acceptsRadiant: 1,
      verified: 1,
      managerUserId: 'usr_pharmacist_01'
    },
    {
      id: 'phm_03',
      name: 'Vine Pharmacy Remera Giporoso',
      district: 'Gasabo',
      sector: 'Remera',
      address: 'KK 15 Rd, Remera Corner',
      latitude: -1.9592,
      longitude: 30.1124,
      phone: '+250 788 511 904',
      email: 'remera@vinepharmacy.rw',
      operatingHours: '24 Hours / 7 Days',
      acceptsRssb: 1,
      acceptsMmi: 0,
      acceptsRadiant: 1,
      verified: 1,
      managerUserId: 'usr_pharmacist_01'
    },
    {
      id: 'phm_04',
      name: 'CarePlus Pharmacy Kicukiro Centre',
      district: 'Kicukiro',
      sector: 'Niboye',
      address: 'KK 19 Ave, Near Kicukiro District HQ',
      latitude: -1.9854,
      longitude: 30.1037,
      phone: '+250 788 772 310',
      email: 'kicukiro@careplus.rw',
      operatingHours: '08:00 - 23:00',
      acceptsRssb: 1,
      acceptsMmi: 1,
      acceptsRadiant: 0,
      verified: 1,
      managerUserId: 'usr_pharmacist_01'
    }
  ];

  for (const p of pharmacies) {
    await execute(
      `INSERT INTO pharmacies (id, name, district, sector, address, latitude, longitude, phone, email, operating_hours, accepts_rssb, accepts_mmi, accepts_radiant, verified, manager_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id, p.name, p.district, p.sector, p.address, p.latitude, p.longitude,
        p.phone, p.email, p.operatingHours, p.acceptsRssb, p.acceptsMmi,
        p.acceptsRadiant, p.verified, p.managerUserId, nowIso
      ]
    );
  }

  // 4. Seed Essential Medications Catalog (Relational DB)
  const medications = [
    {
      id: 'med_01',
      genericName: 'Amoxicillin + Clavulanic Acid',
      brandName: 'Augmentin 625mg',
      category: 'Antibiotic',
      dosageForm: 'Film-Coated Tablet',
      strength: '500mg / 125mg',
      requiresPrescription: 1,
      essentialMedicine: 1,
      activeIngredients: 'Amoxicillin Trihydrate, Potassium Clavulanate',
      description: 'Broad-spectrum beta-lactam antibiotic with beta-lactamase inhibitor for respiratory, ENT, and urinary tract infections.'
    },
    {
      id: 'med_02',
      genericName: 'Artemether + Lumefantrine',
      brandName: 'Coartem 80/480mg',
      category: 'Antimalarial',
      dosageForm: 'Dispersible Tablet (6-Dose Pack)',
      strength: '80mg / 480mg',
      requiresPrescription: 1,
      essentialMedicine: 1,
      activeIngredients: 'Artemether, Lumefantrine',
      description: 'First-line ACT therapy for uncomplicated Plasmodium falciparum malaria.'
    },
    {
      id: 'med_03',
      genericName: 'Insulin Glargine rDNA',
      brandName: 'Lantus SoloStar Pen',
      category: 'Endocrine / Antidiabetic',
      dosageForm: 'Subcutaneous Pre-filled Pen (3mL)',
      strength: '100 IU/mL',
      requiresPrescription: 1,
      essentialMedicine: 1,
      activeIngredients: 'Insulin Glargine',
      description: 'Long-acting basal insulin analogue requiring strict 2C-8C cold-chain storage.'
    },
    {
      id: 'med_04',
      genericName: 'Amlodipine Besylate',
      brandName: 'Norvasc 10mg',
      category: 'Cardiovascular',
      dosageForm: 'Oral Tablet (30 Pack)',
      strength: '10mg',
      requiresPrescription: 1,
      essentialMedicine: 1,
      activeIngredients: 'Amlodipine Besylate',
      description: 'Calcium channel blocker for first-line management of essential hypertension and chronic stable angina.'
    },
    {
      id: 'med_05',
      genericName: 'Salbutamol Sulfate',
      brandName: 'Ventolin Evohaler',
      category: 'Respiratory',
      dosageForm: 'Metered-Dose Inhaler (200 Doses)',
      strength: '100mcg / puff',
      requiresPrescription: 1,
      essentialMedicine: 1,
      activeIngredients: 'Salbutamol Sulfate',
      description: 'Fast-acting bronchodilator reliever for acute asthma bronchospasm and COPD.'
    },
    {
      id: 'med_06',
      genericName: 'Metformin Hydrochloride',
      brandName: 'Glucophage XR 850mg',
      category: 'Endocrine / Antidiabetic',
      dosageForm: 'Extended-Release Tablet',
      strength: '850mg',
      requiresPrescription: 1,
      essentialMedicine: 1,
      activeIngredients: 'Metformin HCl',
      description: 'First-line oral biguanide antihyperglycemic for Type-2 Diabetes Mellitus.'
    },
    {
      id: 'med_07',
      genericName: 'Paracetamol (Acetaminophen)',
      brandName: 'Panadol Advance 500mg',
      category: 'Analgesic / Antipyretic',
      dosageForm: 'Oral Caplet (24 Pack)',
      strength: '500mg',
      requiresPrescription: 0,
      essentialMedicine: 1,
      activeIngredients: 'Paracetamol',
      description: 'Safe OTC analgesic and antipyretic suitable for patients with hypertension or peptic ulcer history.'
    },
    {
      id: 'med_08',
      genericName: 'Losartan Potassium',
      brandName: 'Cozaar 50mg',
      category: 'Cardiovascular',
      dosageForm: 'Film-Coated Tablet (30 Pack)',
      strength: '50mg',
      requiresPrescription: 1,
      essentialMedicine: 1,
      activeIngredients: 'Losartan Potassium',
      description: 'Angiotensin II Receptor Blocker (ARB) for hypertension and diabetic nephropathy protection.'
    }
  ];

  for (const m of medications) {
    await execute(
      `INSERT INTO medications (id, generic_name, brand_name, category, dosage_form, strength, requires_prescription, essential_medicine, active_ingredients, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.id, m.genericName, m.brandName, m.category, m.dosageForm,
        m.strength, m.requiresPrescription, m.essentialMedicine,
        m.activeIngredients, m.description
      ]
    );
  }

  // 5. Seed Pharmacy Inventory Batches with varied stock & near-expiry alerts (Relational DB)
  const inventoryBatches = [
    { id: 'inv_01', pharmacyId: 'phm_01', medicationId: 'med_01', batchNumber: 'AUG-2609A', stockQuantity: 48, reorderLevel: 15, unitPriceRwf: 8500, expiryDate: '2027-08-15', discountPercent: 0 },
    { id: 'inv_02', pharmacyId: 'phm_01', medicationId: 'med_02', batchNumber: 'COA-2611B', stockQuantity: 62, reorderLevel: 20, unitPriceRwf: 4200, expiryDate: '2027-05-20', discountPercent: 0 },
    { id: 'inv_03', pharmacyId: 'phm_01', medicationId: 'med_03', batchNumber: 'LAN-2602C', stockQuantity: 9, reorderLevel: 12, unitPriceRwf: 18500, expiryDate: '2026-11-18', discountPercent: 25 },
    { id: 'inv_04', pharmacyId: 'phm_01', medicationId: 'med_04', batchNumber: 'NOR-2608D', stockQuantity: 85, reorderLevel: 20, unitPriceRwf: 5400, expiryDate: '2028-01-10', discountPercent: 0 },
    { id: 'inv_05', pharmacyId: 'phm_01', medicationId: 'med_05', batchNumber: 'VEN-2604E', stockQuantity: 14, reorderLevel: 15, unitPriceRwf: 6800, expiryDate: '2027-09-30', discountPercent: 0 },
    { id: 'inv_06', pharmacyId: 'phm_02', medicationId: 'med_01', batchNumber: 'AUG-2607K', stockQuantity: 110, reorderLevel: 25, unitPriceRwf: 8200, expiryDate: '2027-11-01', discountPercent: 0 },
    { id: 'inv_07', pharmacyId: 'phm_02', medicationId: 'med_03', batchNumber: 'LAN-2605K', stockQuantity: 34, reorderLevel: 10, unitPriceRwf: 17900, expiryDate: '2027-06-12', discountPercent: 0 },
    { id: 'inv_08', pharmacyId: 'phm_02', medicationId: 'med_06', batchNumber: 'GLU-2603K', stockQuantity: 95, reorderLevel: 25, unitPriceRwf: 4900, expiryDate: '2027-10-14', discountPercent: 0 },
    { id: 'inv_09', pharmacyId: 'phm_03', medicationId: 'med_02', batchNumber: 'COA-2610V', stockQuantity: 7, reorderLevel: 15, unitPriceRwf: 4000, expiryDate: '2026-11-05', discountPercent: 30 },
    { id: 'inv_10', pharmacyId: 'phm_03', medicationId: 'med_05', batchNumber: 'VEN-2609V', stockQuantity: 42, reorderLevel: 12, unitPriceRwf: 6500, expiryDate: '2027-12-01', discountPercent: 0 },
    { id: 'inv_11', pharmacyId: 'phm_03', medicationId: 'med_07', batchNumber: 'PAN-2612V', stockQuantity: 160, reorderLevel: 30, unitPriceRwf: 1500, expiryDate: '2028-04-01', discountPercent: 0 },
    { id: 'inv_12', pharmacyId: 'phm_04', medicationId: 'med_04', batchNumber: 'NOR-2606C', stockQuantity: 52, reorderLevel: 15, unitPriceRwf: 5100, expiryDate: '2027-07-22', discountPercent: 0 },
    { id: 'inv_13', pharmacyId: 'phm_04', medicationId: 'med_08', batchNumber: 'COZ-2601C', stockQuantity: 11, reorderLevel: 15, unitPriceRwf: 7600, expiryDate: '2026-11-12', discountPercent: 20 }
  ];

  for (const inv of inventoryBatches) {
    await execute(
      `INSERT INTO pharmacy_inventory (id, pharmacy_id, medication_id, batch_number, stock_quantity, reorder_level, unit_price_rwf, expiry_date, discount_percent, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        inv.id, inv.pharmacyId, inv.medicationId, inv.batchNumber,
        inv.stockQuantity, inv.reorderLevel, inv.unitPriceRwf,
        inv.expiryDate, inv.discountPercent, nowIso
      ]
    );
  }

  // 6. Seed Sample Stock Reservation (Relational DB)
  await execute(
    `INSERT INTO stock_reservations (id, reservation_code, patient_user_id, pharmacy_id, inventory_id, prescription_doc_id, quantity, total_price_rwf, status, pickup_deadline, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'res_01',
      'RSV-8941',
      'usr_patient_01',
      'phm_01',
      'inv_01',
      'RX-2026-0914',
      2,
      17000,
      'RESERVED',
      new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
      nowIso
    ]
  );

  // 7. Seed MongoDB E-Prescription Documents (Non-Relational Document DB)
  const existingRx = await findPrescriptions();
  if (existingRx.length === 0) {
    const rx1 = {
      prescriptionCode: 'RX-2026-0914',
      patientUserId: 'usr_patient_01',
      patientName: 'Aline Uwase',
      patientPhone: '+250 788 412 091',
      doctorUserId: 'usr_doctor_01',
      doctorName: 'Dr. Eric Mugisha',
      doctorLicense: 'RMDC-2026-0842',
      facilityName: 'King Faisal Hospital Kigali',
      diagnosisSummary: 'Acute bacterial rhinosinusitis with secondary pharyngitis',
      icd10Codes: ['J01.90', 'J02.9'],
      patientVitalsSnapshot: {
        bloodPressure: '118/76 mmHg',
        weightKg: 64,
        temperatureC: 38.2,
        knownAllergies: ['Sulfonamides']
      },
      items: [
        {
          medicationId: 'med_01',
          genericName: 'Amoxicillin + Clavulanic Acid',
          brandName: 'Augmentin 625mg',
          strength: '500mg / 125mg',
          dosageSchedule: '1 tablet every 12 hours after meals',
          durationDays: 7,
          quantityPrescribed: 2,
          dispensedQuantity: 0,
          clinicalNotes: 'Complete full 7-day antibiotic course. Avoid alcohol.'
        },
        {
          medicationId: 'med_07',
          genericName: 'Paracetamol (Acetaminophen)',
          brandName: 'Panadol Advance 500mg',
          strength: '500mg',
          dosageSchedule: '1-2 tablets every 6 hours as needed for fever > 38C',
          durationDays: 5,
          quantityPrescribed: 1,
          dispensedQuantity: 0,
          clinicalNotes: 'Do not exceed 4,000mg in 24 hours.'
        }
      ],
      aiSafetyCheck: {
        checkedAt: nowIso,
        riskLevel: 'LOW',
        interactionsDetected: [],
        recommendations: [
          'Verified safe against patient Sulfonamide allergy (Beta-lactam class has no cross-reactivity).',
          'Take Augmentin with food to minimize GI upset.'
        ]
      },
      status: 'ACTIVE',
      digitalSignatureHash: crypto.createHash('sha256').update('RX-2026-0914:usr_doctor_01:usr_patient_01').digest('hex'),
      dispensingHistory: [],
      issuedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString()
    };

    const rx2 = {
      prescriptionCode: 'RX-2026-0882',
      patientUserId: 'usr_patient_02',
      patientName: 'Jean-Paul Habimana',
      patientPhone: '+250 785 209 334',
      doctorUserId: 'usr_doctor_01',
      doctorName: 'Dr. Eric Mugisha',
      doctorLicense: 'RMDC-2026-0842',
      facilityName: 'King Faisal Hospital Kigali',
      diagnosisSummary: 'Essential Hypertension & Type-2 Diabetes Mellitus Maintenance',
      icd10Codes: ['I10', 'E11.9'],
      patientVitalsSnapshot: {
        bloodPressure: '142/88 mmHg',
        weightKg: 79,
        temperatureC: 36.6,
        knownAllergies: ['NSAIDs']
      },
      items: [
        {
          medicationId: 'med_04',
          genericName: 'Amlodipine Besylate',
          brandName: 'Norvasc 10mg',
          strength: '10mg',
          dosageSchedule: '1 tablet once daily every morning',
          durationDays: 30,
          quantityPrescribed: 1,
          dispensedQuantity: 1,
          clinicalNotes: 'Monitor home blood pressure weekly.'
        },
        {
          medicationId: 'med_06',
          genericName: 'Metformin Hydrochloride',
          brandName: 'Glucophage XR 850mg',
          strength: '850mg',
          dosageSchedule: '1 tablet twice daily with morning and evening meals',
          durationDays: 30,
          quantityPrescribed: 2,
          dispensedQuantity: 2,
          clinicalNotes: 'Maintain low-glycemic diet.'
        }
      ],
      aiSafetyCheck: {
        checkedAt: nowIso,
        riskLevel: 'LOW',
        interactionsDetected: [],
        recommendations: [
          'Avoid Ibuprofen/Diclofenac OTC painkillers due to NSAID allergy and Amlodipine interaction.'
        ]
      },
      status: 'DISPENSED',
      digitalSignatureHash: crypto.createHash('sha256').update('RX-2026-0882:usr_doctor_01:usr_patient_02').digest('hex'),
      dispensingHistory: [
        {
          dispensedAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
          pharmacyId: 'phm_02',
          pharmacyName: 'Kipharma Central Pharmacy',
          pharmacistName: 'Chantal Mukamana, BPharm',
          itemsDispensed: [
            { medicationId: 'med_04', quantity: 1, batchNumber: 'NOR-2608D' },
            { medicationId: 'med_06', quantity: 2, batchNumber: 'GLU-2603K' }
          ],
          verificationNote: 'Verified RMDC digital signature & MMI insurance co-pay.'
        }
      ],
      issuedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 29 * 24 * 3600 * 1000).toISOString()
    };

    await insertPrescription(rx1);
    await insertPrescription(rx2);

    await insertAiTriageReport({
      sessionCode: 'TRIAGE-901',
      userId: 'usr_doctor_01',
      userRole: 'DOCTOR',
      queryType: 'DRUG_INTERACTION',
      inputMedications: ['Amlodipine', 'Ibuprofen'],
      patientAllergies: ['NSAID'],
      symptomsReported: 'Hypertension patient requesting joint pain relief',
      analysisResult: {
        overallRisk: 'HIGH',
        severityScore: 85,
        interactions: [
          {
            pair: 'AMLODIPINE + IBUPROFEN',
            severity: 'MODERATE',
            mechanism: 'NSAIDs attenuate antihypertensive efficacy and increase renal strain.',
            clinicalAdvice: 'Substitute Ibuprofen with Paracetamol 500mg.'
          }
        ],
        suggestedGenericAlternatives: ['Paracetamol (Acetaminophen)'],
        triageRecommendation: 'Prescribe Paracetamol instead of NSAIDs.'
      }
    });

    await insertAuditLog({
      eventType: 'SYSTEM_HYBRID_DB_INITIALIZED',
      actorUserId: 'usr_admin_01',
      actorRole: 'ADMIN',
      actorName: 'System Bootstrapper',
      resourceType: 'POLYGLOT_PERSISTENCE',
      resourceId: 'seed_v1',
      severity: 'INFO',
      metadata: {
        relationalTablesSeeded: 6,
        mongoDocumentsSeeded: 4
      }
    });
  }

  // 8. Publish initial RabbitMQ events so the Broker Dashboard has live history immediately
  await publishBrokerEvent(
    'notification.sms.prescription_issued',
    {
      phone: '+250 788 412 091',
      recipient: 'Aline Uwase (+250 788 412 091)',
      subject: 'SMS E-Prescription Token RX-2026-0914',
      message: '[MediBridge RW] Dr. Eric Mugisha (King Faisal Hospital) issued E-Prescription RX-2026-0914. In stock at Goodlife Pharmacy Kimironko (8,500 RWF).',
      actorName: 'Dr. Eric Mugisha',
      actorRole: 'DOCTOR'
    },
    { sync: true }
  );

  await publishBrokerEvent(
    'notification.email.reservation_confirmed',
    {
      email: 'aline.patient@medibridge.rw',
      recipient: 'Aline Uwase <aline.patient@medibridge.rw>',
      subject: 'Medication Reservation Confirmed — RSV-8941 (Goodlife Pharmacy)',
      message: 'Your reservation RSV-8941 for Augmentin 625mg (x2 packs) is held at Goodlife Pharmacy Kimironko until 18:30 today.',
      actorName: 'Aline Uwase',
      actorRole: 'PATIENT'
    },
    { sync: true }
  );

  await publishBrokerEvent(
    'inventory.expiry_alert',
    {
      recipient: 'Kigali Hospital & Clinic Redistribution Network',
      subject: 'Near-Expiry Cold-Chain Alert: Lantus SoloStar Pen (25% Discount)',
      message: 'Batch LAN-2602C (9 pens remaining at Goodlife Pharmacy Kimironko) expires 2026-11-18. 25% redistribution discount activated.',
      actorName: 'Chantal Mukamana, BPharm',
      actorRole: 'PHARMACIST'
    },
    { sync: true }
  );

  console.log('[Seed] Database & RabbitMQ initial state ready.');
}
