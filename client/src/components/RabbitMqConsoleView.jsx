import React, { useState, useEffect, useCallback } from 'react';
import {
  Radio,
  Mail,
  MessageSquare,
  Send,
  CheckCircle2,
  Activity,
  RefreshCw,
  BellRing
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function RabbitMqConsoleView() {
  const { user, authFetch, addToast } = useAuth();
  const [brokerState, setBrokerState] = useState(null);
  const [channelType, setChannelType] = useState('SMS');
  const [recipient, setRecipient] = useState('+250 788 412 091');
  const [subject, setSubject] = useState('Urgent Medication Ready for Pickup');
  const [message, setMessage] = useState(
    '[MediBridge RW] Your E-Prescription RX-2026-0914 is ready for collection at Goodlife Pharmacy Kimironko.'
  );
  const [publishing, setPublishing] = useState(false);

  const loadBrokerState = useCallback(async () => {
    try {
      const data = await authFetch('/api/broker/state');
      setBrokerState(data);
    } catch (err) {
      console.error('Failed to fetch broker state:', err);
    }
  }, [authFetch]);

  useEffect(() => {
    loadBrokerState();
    const evtSource = new EventSource('/api/broker/stream');
    evtSource.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        if (parsed.type?.startsWith('RABBITMQ_')) {
          loadBrokerState();
        }
      } catch {
        // ignore
      }
    };
    return () => evtSource.close();
  }, [loadBrokerState]);

  const handlePublishTest = async (e) => {
    e.preventDefault();
    setPublishing(true);
    try {
      const res = await authFetch('/api/broker/publish-test', {
        method: 'POST',
        body: JSON.stringify({
          channelType,
          recipient,
          subject,
          message
        })
      });
      addToast(
        `RabbitMQ Message Published (${channelType})`,
        `Routed via ${res.envelope.routingKey} -> ${res.envelope.queue}`,
        'success'
      );
      await loadBrokerState();
    } catch (err) {
      addToast('Publish Failed', err.message, 'error');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">
            RabbitMQ Exchange, Consumer Queues & SMS/Email Dispatch Monitor
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
            Every E-Prescription signature, medication reservation, and near-expiry alert publishes an asynchronous event to topic exchange <code className="text-amber-300">medibridge.events</code>, routing to dedicated SMS, Email, and workflow queues.
          </p>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs shrink-0 space-y-1">
          <div className="text-slate-400 font-semibold">Active Broker Mode:</div>
          <div className="font-mono font-bold text-teal-400">
            {brokerState?.brokerMode || 'Connecting...'}
          </div>
          <div className="text-[11px] text-slate-400">
            Exchange: <code className="text-white">{brokerState?.exchange?.name || 'medibridge.events'}</code> (topic, durable)
          </div>
        </div>
      </div>

      {/* 4 Bound RabbitMQ Queues Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {brokerState?.queues?.map((q) => (
          <div
            key={q.name}
            className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-mono text-xs font-extrabold text-slate-900 truncate">
                  {q.name}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  ACTIVE
                </span>
              </div>
              <div className="text-[11px] font-mono text-indigo-600 mb-1.5">
                Binding: {q.bindingKey}
              </div>
              <p className="text-xs text-slate-500">{q.description}</p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 text-center text-xs">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Published</div>
                <div className="font-mono font-extrabold text-slate-900 text-sm">
                  {q.metrics?.published || 0}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Consumed</div>
                <div className="font-mono font-extrabold text-teal-700 text-sm">
                  {q.metrics?.consumed || 0}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">ACKed</div>
                <div className="font-mono font-extrabold text-emerald-700 text-sm">
                  {q.metrics?.acked || 0}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid: Test Message Publisher (Left) + Real-Time Message Stream (Right 2/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
            <Send className="w-4 h-4 text-teal-600" />
            Publish Live Test Event to RabbitMQ
          </h2>

          <form onSubmit={handlePublishTest} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Target Queue / Channel</label>
              <select
                value={channelType}
                onChange={(e) => {
                  const val = e.target.value;
                  setChannelType(val);
                  if (val === 'SMS') {
                    setRecipient(user?.phone || '+250 788 412 091');
                    setSubject('SMS Gateway Dispatch');
                  } else if (val === 'EMAIL') {
                    setRecipient(user?.email || 'aline.patient@medibridge.rw');
                    setSubject('MediBridge E-Prescription Notification');
                  } else {
                    setRecipient('All Kigali Pharmacy Nodes');
                    setSubject('Inventory Sync Broadcast');
                  }
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white font-semibold"
              >
                <option value="SMS">SMS Gateway (queue.notifications.sms)</option>
                <option value="EMAIL">Transactional Email (queue.notifications.email)</option>
                <option value="DOMAIN_EVENT">Inventory Alert (queue.inventory.alerts)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Recipient (Phone / Email / Node)</label>
              <input
                type="text"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Subject / Routing Context</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Payload Message Content</label>
              <textarea
                rows={3}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <button
              type="submit"
              disabled={publishing}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-teal-600 text-white font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {publishing ? 'Publishing to Exchange...' : 'Publish to RabbitMQ Exchange'}
            </button>
          </form>
        </div>

        {/* Right 2/3: Live Message Stream */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <span>Live RabbitMQ Dispatched Messages (SMS, Email & Domain Events)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Real-time Server-Sent Events (SSE) stream of messages routed through <code className="text-teal-700">medibridge.events</code>
              </p>
            </div>
            <button
              onClick={loadBrokerState}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              title="Refresh Broker State"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {brokerState?.recentMessages?.map((msg) => (
              <div
                key={msg.messageId}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] inline-flex items-center gap-1 ${
                        msg.channelType === 'SMS'
                          ? 'bg-teal-100 text-teal-800'
                          : msg.channelType === 'EMAIL'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {msg.channelType === 'SMS' ? (
                        <MessageSquare className="w-3 h-3" />
                      ) : msg.channelType === 'EMAIL' ? (
                        <Mail className="w-3 h-3" />
                      ) : (
                        <BellRing className="w-3 h-3" />
                      )}
                      {msg.channelType}
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {msg.routingKey}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      → {msg.queue}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {msg.status} ({msg.processingLatencyMs || 5}ms)
                    </span>
                  </div>
                </div>

                <div className="font-semibold text-slate-900">
                  To: {msg.recipient} — <span className="text-slate-600">{msg.subject}</span>
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-mono text-[11px] whitespace-pre-wrap">
                  {msg.bodyPreview}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
