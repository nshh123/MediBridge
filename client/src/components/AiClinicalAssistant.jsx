import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
  Pill,
  Activity
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const PRESET_SCENARIOS = [
  {
    label: 'High-Risk Warfarin + Amoxicillin + Penicillin Allergy',
    medications: 'Amoxicillin, Warfarin',
    allergies: 'Penicillin',
    symptoms: 'Patient with atrial fibrillation presenting with acute sore throat and fever'
  },
  {
    label: 'Hypertension + NSAID Conflict (Amlodipine + Ibuprofen)',
    medications: 'Amlodipine, Ibuprofen',
    allergies: 'NSAID',
    symptoms: 'Hypertension patient requesting pain relief for headache and joint ache'
  },
  {
    label: 'Suspected Malaria Febrile Triage',
    medications: 'Artemether, Paracetamol',
    allergies: 'None',
    symptoms: 'High fever, chills, sweating, and headache for 2 days'
  }
];

export default function AiClinicalAssistant() {
  const { authFetch, addToast } = useAuth();
  const [medicationsInput, setMedicationsInput] = useState('Amoxicillin, Warfarin');
  const [allergiesInput, setAllergiesInput] = useState('Penicillin');
  const [symptomsInput, setSymptomsInput] = useState('Fever, sore throat, and cough');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    try {
      const data = await authFetch('/api/ai/history');
      setHistory(data.reports || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleEvaluate = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const data = await authFetch('/api/ai/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          medications: medicationsInput.split(',').map((s) => s.trim()).filter(Boolean),
          allergies: allergiesInput.split(',').map((s) => s.trim()).filter(Boolean),
          symptoms: symptomsInput
        })
      });
      setResult(data);
      addToast(
        `AI Clinical Assessment Complete (${data.sessionCode})`,
        `Overall Risk: ${data.evaluation.overallRisk} — Report saved to MongoDB collection ai_triage_reports.`,
        data.evaluation.overallRisk === 'HIGH' ? 'error' : 'success'
      );
      await loadHistory();
    } catch (err) {
      addToast('AI Evaluation Failed', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-teal-950 text-white rounded-2xl p-6 shadow-xl border border-indigo-500/30">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 mb-2">
          <BrainCircuit className="w-3.5 h-3.5" />
          Bonus Point 3: New Technology Exploration — Clinical AI Decision Support
        </span>
        <h1 className="text-2xl font-extrabold">
          AI Drug-Interaction, Allergy Cross-Reactivity & Symptom Triage Engine
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
          Prevents adverse drug events (ADEs) by evaluating pharmacokinetic interactions and beta-lactam/sulfonamide/NSAID cross-allergies before dispensing, while matching safe generic alternatives against live Kigali pharmacy stock.
        </p>

        {/* 1-Click Clinical Test Scenarios */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold">1-Click Clinical Scenarios:</span>
          {PRESET_SCENARIOS.map((sc, i) => (
            <button
              key={i}
              onClick={() => {
                setMedicationsInput(sc.medications);
                setAllergiesInput(sc.allergies);
                setSymptomsInput(sc.symptoms);
              }}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 text-xs font-semibold text-slate-200 hover:text-white transition cursor-pointer"
            >
              {sc.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Input Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            Clinical Safety Parameters
          </h2>

          <form onSubmit={handleEvaluate} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Medications to Co-Administer (comma-separated)
              </label>
              <input
                type="text"
                value={medicationsInput}
                onChange={(e) => setMedicationsInput(e.target.value)}
                placeholder="e.g. Amoxicillin, Warfarin, Ibuprofen"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Patient Known Drug Allergies
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
              <label className="block font-bold text-slate-700 mb-1">
                Presenting Symptoms / Clinical Context
              </label>
              <textarea
                rows={3}
                value={symptomsInput}
                onChange={(e) => setSymptomsInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center gap-2 shadow cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {loading ? 'Analyzing Interactions...' : 'Run AI Pharmacokinetic & Triage Analysis'}
            </button>
          </form>
        </div>

        {/* Right 2/3: AI Report Output + MongoDB History */}
        <div className="lg:col-span-2 space-y-4">
          {result ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <span className="font-mono text-xs font-bold text-indigo-600">
                    Session: {result.sessionCode} (MongoDB _id: {String(result.mongoDocumentId).slice(0, 10)})
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Clinical Safety & Interaction Report
                  </h3>
                </div>

                <div
                  className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 ${
                    result.evaluation.overallRisk === 'HIGH'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : result.evaluation.overallRisk === 'MODERATE'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  Risk Level: {result.evaluation.overallRisk} (Score: {result.evaluation.severityScore}/100)
                </div>
              </div>

              {/* Interactions List */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Detected Drug-Drug & Allergy Conflicts ({result.evaluation.interactions.length})
                </div>
                {result.evaluation.interactions.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    No severe pharmacokinetic or allergy cross-reactivity conflicts detected.
                  </div>
                ) : (
                  result.evaluation.interactions.map((inter, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-bold text-rose-900">
                        <span>{inter.pair}</span>
                        <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-900 text-[10px]">
                          {inter.severity} SEVERITY
                        </span>
                      </div>
                      <p className="text-rose-800">{inter.mechanism}</p>
                      <p className="text-slate-800 font-semibold pt-1">
                        Clinical Recommendation: {inter.clinicalAdvice}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Symptom Triage Box */}
              {result.evaluation.triageAssessment && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <div className="font-bold text-slate-900">
                    Triage Classification: {result.evaluation.triageAssessment.condition}
                  </div>
                  <div className="text-indigo-700 font-semibold">
                    Urgency: {result.evaluation.triageAssessment.urgency}
                  </div>
                  <div className="text-slate-600">
                    Guidance: {result.evaluation.triageAssessment.clinicalGuidance}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
              Click <strong>"Run AI Pharmacokinetic & Triage Analysis"</strong> on the left to evaluate drug interactions and allergy safety.
            </div>
          )}

          {/* MongoDB Saved Triage Documents */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-3">
              Recent AI Triage Documents Stored in MongoDB (<code className="text-indigo-600">ai_triage_reports</code>)
            </h3>
            <div className="space-y-2.5">
              {history.map((h) => (
                <div
                  key={h._id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <span className="font-mono font-bold text-indigo-700 mr-2">{h.sessionCode}</span>
                    <span className="font-semibold text-slate-800">
                      Inputs: {h.inputMedications?.join(' + ') || 'Symptom Triage'}
                    </span>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      {h.analysisResult?.triageRecommendation}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      h.analysisResult?.overallRisk === 'HIGH'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    Risk: {h.analysisResult?.overallRisk}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
