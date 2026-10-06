import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCheck2,
  QrCode,
  ShieldCheck,
  Stethoscope,
  Send
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function PrescriptionsView() {
  const { user, authFetch, addToast } = useAuth();
  const [prescriptions, setPrescriptions] = useState([]);
  const [patients, setPatients] = useState([]);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);

  const canCreatePrescription = user?.role === 'DOCTOR' || user?.role === 'ADMIN';
  const canVerifyAndDispense = user?.role === 'PHARMACIST' || user?.role === 'ADMIN';

  // Pharmacist Verification State
  const [verifyCodeInput, setVerifyCodeInput] = useState('RX-2026-0914');
  const [verifiedData, setVerifiedData] = useState(null);
  const [verifying, setVerifying] = useState(false);

  // Doctor New E-Prescription Form State
  const [patientUserId, setPatientUserId] = useState('usr_patient_01');
  const [diagnosisSummary, setDiagnosisSummary] = useState('Acute bacterial bronchitis with fever');
  const [icd10Input, setIcd10Input] = useState('J20.9');
  const [allergiesInput, setAllergiesInput] = useState('Sulfonamides');
  const [selectedMedId, setSelectedMedId] = useState('med_01');
  const [dosageSchedule, setDosageSchedule] = useState('1 tablet every 12 hours after meals');
  const [durationDays, setDurationDays] = useState(7);
  const [quantityPrescribed, setQuantityPrescribed] = useState(2);
  const [submittingRx, setSubmittingRx] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rxRes, catRes, patRes] = await Promise.all([
        authFetch('/api/prescriptions'),
        fetch('/api/pharmacies/catalog').then((r) => r.json()),
        authFetch('/api/prescriptions/patients')
      ]);
      setPrescriptions(rxRes.prescriptions || []);
      setMedications(catRes.medications || []);
      setPatients(patRes.patients || []);
    } catch (err) {
      console.error('Error loading prescriptions:', err);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    setVerifiedData(null);
    loadData();
  }, [loadData, user]);

  const handleVerifyCode = async (codeToVerify = verifyCodeInput) => {
    if (!codeToVerify) return;
    setVerifying(true);
    try {
      const data = await authFetch(`/api/prescriptions/verify/${codeToVerify}`);
      setVerifiedData(data);
      addToast(
        `Verified ${codeToVerify}`,
        'Cryptographic SHA-256 signature & live SQL stock batches matched.',
        'success'
      );
    } catch (err) {
      setVerifiedData(null);
      addToast('Verification Failed', err.message, 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleDispense = async (code) => {
    try {
      const data = await authFetch(`/api/prescriptions/${code}/dispense`, {
        method: 'POST',
        body: JSON.stringify({
          pharmacyId: 'phm_01',
          verificationNote: `Verified & dispensed by ${user.fullName} (${user.role})`
        })
      });
      addToast('Medication Dispensed!', data.message, 'success');
      await loadData();
      await handleVerifyCode(code);
    } catch (err) {
      addToast('Dispense Blocked (RBAC)', err.message, 'error');
    }
  };

  const handleCreatePrescription = async (e) => {
    e.preventDefault();
    setSubmittingRx(true);
    try {
      const data = await authFetch('/api/prescriptions', {
        method: 'POST',
        body: JSON.stringify({
          patientUserId,
          diagnosisSummary,
          icd10Codes: [icd10Input],
          vitals: {
            bloodPressure: '122/78 mmHg',
            weightKg: 66,
            temperatureC: 37.8,
            knownAllergies: allergiesInput.split(',').map((s) => s.trim()).filter(Boolean)
          },
          items: [
            {
              medicationId: selectedMedId,
              dosageSchedule,
              durationDays: Number(durationDays),
              quantityPrescribed: Number(quantityPrescribed)
            }
          ]
        })
      });
      addToast(
        `E-Prescription ${data.prescription.prescriptionCode} Issued!`,
        'Stored in MongoDB & dispatched to patient via RabbitMQ SMS & Email.',
        'success'
      );
      setVerifyCodeInput(data.prescription.prescriptionCode);
      await loadData();
    } catch (err) {
      addToast('Cannot Issue E-Prescription (RBAC)', err.message, 'error');
    } finally {
      setSubmittingRx(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Info Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            {user?.role === 'PATIENT'
              ? `E-Prescriptions Issued to ${user.fullName}`
              : 'Digital E-Prescription Ledger & Anti-Counterfeit Verification'}
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            {user?.role === 'PATIENT'
              ? 'Present your RX-2026-XXXX code at any verified MediBridge pharmacy in Kigali to collect your prescribed medication.'
              : 'Doctors sign hierarchical E-Prescription documents. Pharmacists verify the SHA-256 token and dispense against live SQL inventory.'}
          </p>
        </div>

        {/* Pharmacist / Admin Quick Verification Search Bar */}
        {canVerifyAndDispense && (
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={verifyCodeInput}
              onChange={(e) => setVerifyCodeInput(e.target.value)}
              placeholder="Enter RX-2026-XXXX..."
              className="rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-mono font-bold uppercase w-44"
            />
            <button
              onClick={() => handleVerifyCode(verifyCodeInput)}
              disabled={verifying}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              {verifying ? 'Checking...' : 'Verify Token'}
            </button>
          </div>
        )}
      </div>

      {/* Verification Result Drawer (Pharmacist / Admin) */}
      {canVerifyAndDispense && verifiedData && verifiedData.prescription && (
        <div className="bg-slate-900 text-white rounded-2xl p-5 border border-indigo-500/40 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-6 h-6 text-teal-400" />
              <div>
                <div className="text-xs text-teal-400 font-bold uppercase">
                  Cryptographic Signature Verified (SHA-256 Valid)
                </div>
                <div className="text-base font-extrabold font-mono">
                  {verifiedData.prescription.prescriptionCode} — {verifiedData.prescription.patientName}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-teal-300">
                Status: {verifiedData.prescription.status}
              </span>
              {verifiedData.prescription.status !== 'DISPENSED' && (
                <button
                  onClick={() => handleDispense(verifiedData.prescription.prescriptionCode)}
                  className="px-4 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-xs cursor-pointer"
                >
                  Dispense Medication Now
                </button>
              )}
              <button
                onClick={() => setVerifiedData(null)}
                className="text-xs text-slate-400 hover:text-white px-2 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="text-slate-400 font-semibold">Prescribing Clinician &amp; Diagnosis</div>
              <div>Doctor: <span className="font-bold text-white">{verifiedData.prescription.doctorName}</span> ({verifiedData.prescription.doctorLicense})</div>
              <div>Facility: <span className="text-slate-300">{verifiedData.prescription.facilityName}</span></div>
              <div>Diagnosis: <span className="text-teal-300 font-medium">{verifiedData.prescription.diagnosisSummary}</span></div>
              <div className="font-mono text-[11px] text-slate-500 truncate">
                SHA-256: {verifiedData.prescription.digitalSignatureHash}
              </div>
            </div>

            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="text-slate-400 font-semibold">
                Cross-Database Check: Matching Relational SQL Stock Batches
              </div>
              {verifiedData.prescription.items.map((item, i) => (
                <div key={i} className="p-2 rounded bg-slate-900 border border-slate-800">
                  <div className="font-bold text-white">
                    {item.brandName} ({item.genericName}) — Qty: {item.quantityPrescribed}
                  </div>
                  <div className="text-slate-400 text-[11px]">{item.dosageSchedule}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {item.availableBatches?.length > 0 ? (
                      item.availableBatches.map((b) => (
                        <span
                          key={b.inventory_id}
                          className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono"
                        >
                          {b.pharmacy_name}: {b.stock_quantity} in stock ({b.unit_price_rwf} RWF)
                        </span>
                      ))
                    ) : (
                      <span className="text-rose-400 text-[11px]">Out of stock</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Doctor Composer shown ONLY to Doctor/Admin; Full-Width Ledger shown to Patient/Pharmacist */}
      <div className={`grid grid-cols-1 ${canCreatePrescription ? 'lg:grid-cols-3' : ''} gap-6`}>
        {canCreatePrescription && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <Stethoscope className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-sm">
                  Issue New E-Prescription
                </h2>
                <p className="text-[11px] text-slate-500">
                  Authorized Clinician: {user?.fullName}
                </p>
              </div>
            </div>

            <form onSubmit={handleCreatePrescription} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Patient</label>
                <select
                  value={patientUserId}
                  onChange={(e) => setPatientUserId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.phone}) — {p.organization}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Clinical Diagnosis</label>
                  <input
                    type="text"
                    required
                    value={diagnosisSummary}
                    onChange={(e) => setDiagnosisSummary(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ICD-10 Code</label>
                  <input
                    type="text"
                    value={icd10Input}
                    onChange={(e) => setIcd10Input(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Patient Known Allergies (Checked by AI Engine)
                </label>
                <input
                  type="text"
                  value={allergiesInput}
                  onChange={(e) => setAllergiesInput(e.target.value)}
                  placeholder="e.g. Penicillin, Sulfa, NSAID"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Medication to Prescribe</label>
                <select
                  value={selectedMedId}
                  onChange={(e) => setSelectedMedId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                >
                  {medications.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.brand_name} ({m.generic_name} {m.strength})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Dosage &amp; Administration Schedule</label>
                <input
                  type="text"
                  required
                  value={dosageSchedule}
                  onChange={(e) => setDosageSchedule(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Duration (Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Quantity (Packs)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={quantityPrescribed}
                    onChange={(e) => setQuantityPrescribed(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingRx}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-1.5 shadow cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                {submittingRx ? 'Signing & Publishing...' : 'Sign E-Prescription & Send RabbitMQ Alert'}
              </button>
            </form>
          </div>
        )}

        {/* MongoDB E-Prescription Documents List */}
        <div className={`${canCreatePrescription ? 'lg:col-span-2' : ''} space-y-4`}>
          {loading ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
              Loading E-Prescription documents...
            </div>
          ) : (
            prescriptions.map((rx) => (
              <div
                key={rx.prescriptionCode}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-sm px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {rx.prescriptionCode}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          rx.status === 'ACTIVE'
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {rx.status}
                      </span>
                      {rx.aiSafetyCheck && (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rx.aiSafetyCheck.riskLevel === 'LOW'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          AI Safety Risk: {rx.aiSafetyCheck.riskLevel}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 text-base mt-1">
                      Patient: {rx.patientName} <span className="text-xs font-normal text-slate-500">({rx.patientPhone})</span>
                    </h3>
                    <p className="text-xs text-slate-600">
                      Prescribed by <strong>{rx.doctorName}</strong> ({rx.facilityName}) • Diagnosis: <span className="text-slate-900 font-medium">{rx.diagnosisSummary}</span>
                    </p>
                  </div>

                  {canVerifyAndDispense && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setVerifyCodeInput(rx.prescriptionCode);
                          handleVerifyCode(rx.prescriptionCode);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        Verify &amp; Match Stock
                      </button>
                      {rx.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleDispense(rx.prescriptionCode)}
                          className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer"
                        >
                          Dispense
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Nested Medication Items Subdocuments */}
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {rx.items?.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1"
                    >
                      <div className="font-bold text-slate-900 flex items-center justify-between">
                        <span>{item.brandName} ({item.strength})</span>
                        <span className="text-teal-700 font-mono">
                          {item.dispensedQuantity}/{item.quantityPrescribed} packs
                        </span>
                      </div>
                      <div className="text-slate-600">{item.genericName}</div>
                      <div className="text-slate-800 font-medium bg-white px-2 py-1 rounded border border-slate-200">
                        {item.dosageSchedule} ({item.durationDays} days)
                      </div>
                    </div>
                  ))}
                </div>

                {/* Vitals & Cryptographic Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-slate-500">
                  <div>
                    Vitals Snapshot: BP <strong>{rx.patientVitalsSnapshot?.bloodPressure}</strong> | Weight <strong>{rx.patientVitalsSnapshot?.weightKg}kg</strong> | Allergies: <strong>{rx.patientVitalsSnapshot?.knownAllergies?.join(', ') || 'None'}</strong>
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">
                    Digital Signature: {rx.digitalSignatureHash?.slice(0, 16)}...
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
