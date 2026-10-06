import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.SQLITE_MEMORY = 'true';

import { createApp } from '../src/index.js';

let server;
let baseUrl;
let patientToken;
let doctorToken;
let pharmacistToken;
let adminToken;

async function apiRequest(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, body };
}

describe('MediBridge WebTech Full-Stack API & Hybrid Persistence Test Suite (Bonus 2 QA)', () => {
  before(async () => {
    const app = await createApp();
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('1. Healthcheck endpoint returns UP status', async () => {
    const res = await apiRequest('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'UP');
  });

  it('2. Requirement 6: Local JWT login & OAuth2 Authorization Code + PKCE token exchange work for all 4 RBAC roles', async () => {
    // Patient via OAuth2 Authorization Code Flow
    const authCodeRes = await apiRequest('/api/auth/oauth/authorize', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'google-oauth2',
        email: 'aline.patient@medibridge.rw',
        clientId: 'medibridge-test-client'
      })
    });
    assert.equal(authCodeRes.status, 200);
    assert.ok(authCodeRes.body.authorizationCode.startsWith('oauth2_code_'));

    const tokenRes = await apiRequest('/api/auth/oauth/token', {
      method: 'POST',
      body: JSON.stringify({
        grantType: 'authorization_code',
        code: authCodeRes.body.authorizationCode,
        provider: 'google-oauth2'
      })
    });
    assert.equal(tokenRes.status, 200);
    assert.equal(tokenRes.body.user.role, 'PATIENT');
    patientToken = tokenRes.body.token;

    // Doctor login
    const docRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'dr.mugisha@medibridge.rw', password: 'Password123!' })
    });
    assert.equal(docRes.status, 200);
    assert.equal(docRes.body.user.role, 'DOCTOR');
    doctorToken = docRes.body.token;

    // Pharmacist login
    const pharmRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'chantal.pharma@medibridge.rw', password: 'Password123!' })
    });
    assert.equal(pharmRes.status, 200);
    assert.equal(pharmRes.body.user.role, 'PHARMACIST');
    pharmacistToken = pharmRes.body.token;

    // Admin login
    const adminRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@medibridge.rw', password: 'Password123!' })
    });
    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.body.user.role, 'ADMIN');
    adminToken = adminRes.body.token;
  });

  it('3. Requirement 5 & 6: Relational Stock Search executes SQL JOINs and LRU Caching (MISS -> HIT)', async () => {
    const first = await apiRequest('/api/pharmacies/stock?q=Augmentin');
    assert.equal(first.status, 200);
    assert.equal(first.body.cacheStatus, 'MISS');
    assert.ok(first.body.items.length >= 1);

    const second = await apiRequest('/api/pharmacies/stock?q=Augmentin');
    assert.equal(second.status, 200);
    assert.equal(second.body.cacheStatus, 'HIT');
  });

  it('4. Requirement 8: RBAC blocks Patient from issuing E-Prescriptions or adding Pharmacy Inventory', async () => {
    const rxAttempt = await apiRequest('/api/prescriptions', {
      method: 'POST',
      token: patientToken,
      body: JSON.stringify({
        patientUserId: 'usr_patient_01',
        diagnosisSummary: 'Unauthorized attempt',
        items: [{ medicationId: 'med_01', quantityPrescribed: 1 }]
      })
    });
    assert.equal(rxAttempt.status, 403);
    assert.equal(rxAttempt.body.error, 'RBAC Permission Denied');

    const invAttempt = await apiRequest('/api/pharmacies/inventory', {
      method: 'POST',
      token: patientToken,
      body: JSON.stringify({
        pharmacyId: 'phm_01',
        medicationId: 'med_01',
        batchNumber: 'HACK-01',
        stockQuantity: 10,
        unitPriceRwf: 5000,
        expiryDate: '2027-12-01'
      })
    });
    assert.equal(invAttempt.status, 403);
  });

  it('5. Requirement 5 & 7: Doctor creates E-Prescription in MongoDB and triggers RabbitMQ SMS/Email notifications', async () => {
    const createRes = await apiRequest('/api/prescriptions', {
      method: 'POST',
      token: doctorToken,
      body: JSON.stringify({
        patientUserId: 'usr_patient_01',
        diagnosisSummary: 'Acute Bronchospasm & Seasonal Allergic Rhinitis',
        icd10Codes: ['J45.901'],
        vitals: {
          bloodPressure: '120/78 mmHg',
          weightKg: 64,
          temperatureC: 37.1,
          knownAllergies: ['Penicillin']
        },
        items: [
          {
            medicationId: 'med_05',
            dosageSchedule: '2 puffs every 6 hours as needed for wheezing',
            durationDays: 14,
            quantityPrescribed: 1
          }
        ]
      })
    });

    assert.equal(createRes.status, 201);
    const createdCode = createRes.body.prescription.prescriptionCode;
    assert.ok(createdCode.startsWith('RX-2026-'));
    assert.ok(createRes.body.prescription.digitalSignatureHash.length === 64);

    // Pharmacist verifies the E-Prescription and dispenses it
    const verifyRes = await apiRequest(`/api/prescriptions/verify/${createdCode}`, {
      token: pharmacistToken
    });
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.verified, true);

    const dispenseRes = await apiRequest(`/api/prescriptions/${createdCode}/dispense`, {
      method: 'POST',
      token: pharmacistToken,
      body: JSON.stringify({
        pharmacyId: 'phm_01',
        verificationNote: 'Dispensed in automated QA test'
      })
    });
    assert.equal(dispenseRes.status, 200);
    assert.equal(dispenseRes.body.prescription.status, 'DISPENSED');
  });

  it('6. Bonus 3: AI Clinical Drug Interaction Engine flags high-risk pairs and allergy conflicts', async () => {
    const aiRes = await apiRequest('/api/ai/evaluate', {
      method: 'POST',
      token: doctorToken,
      body: JSON.stringify({
        medications: ['Amoxicillin', 'Warfarin'],
        allergies: ['Penicillin'],
        symptoms: 'Fever and sore throat'
      })
    });

    assert.equal(aiRes.status, 200);
    assert.equal(aiRes.body.evaluation.overallRisk, 'HIGH');
    assert.ok(aiRes.body.evaluation.interactions.length >= 2);
  });

  it('7. Requirement 7 & System Overview: RabbitMQ queue metrics and Hybrid DB telemetry are reported accurately', async () => {
    const sysRes = await apiRequest('/api/system/overview', {
      token: adminToken
    });
    assert.equal(sysRes.status, 200);
    assert.ok(sysRes.body.relationalDb.tableCounts.users >= 5);
    assert.ok(sysRes.body.nonRelationalDb.collections.length === 3);
    assert.ok(sysRes.body.rabbitMqSummary.queues.length === 4);
  });
});
