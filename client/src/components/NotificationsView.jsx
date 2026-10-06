import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Mail,
  MessageSquare,
  BellRing,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function NotificationsView() {
  const { user, authFetch } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authFetch('/api/broker/my-notifications');
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadNotifications();
    const evtSource = new EventSource('/api/broker/stream');
    evtSource.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        if (parsed.type?.startsWith('RABBITMQ_')) {
          loadNotifications();
        }
      } catch {
        // ignore
      }
    };
    return () => evtSource.close();
  }, [loadNotifications, user]);

  const filteredNotifications = notifications.filter((item) => {
    if (channelFilter === 'ALL') return true;
    return item.channelType === channelFilter;
  });

  const smsCount = notifications.filter((n) => n.channelType === 'SMS').length;
  const emailCount = notifications.filter((n) => n.channelType === 'EMAIL').length;
  const alertCount = notifications.filter((n) => n.channelType === 'DOMAIN_EVENT').length;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            Notifications &amp; Message Inbox — {user?.fullName}
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            {user?.role === 'PATIENT' &&
              'Real-time SMS tokens, Email receipts, and E-Prescription alerts delivered to your account via RabbitMQ.'}
            {user?.role === 'DOCTOR' &&
              'E-Prescription confirmations, pharmacy dispensing updates, and near-expiry clinic redistribution alerts.'}
            {user?.role === 'PHARMACIST' &&
              'Incoming E-Prescription issuances, patient stock reservations, low-stock warnings, and expiry broadcasts.'}
            {user?.role === 'ADMIN' &&
              'Complete system-wide feed of all SMS, Email, and clinical domain notifications dispatched through RabbitMQ.'}
          </p>
        </div>

        <button
          onClick={loadNotifications}
          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 self-start cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Inbox
        </button>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { id: 'ALL', label: `All (${notifications.length})` },
          { id: 'SMS', label: `SMS Messages (${smsCount})` },
          { id: 'EMAIL', label: `Emails (${emailCount})` },
          { id: 'DOMAIN_EVENT', label: `Clinical & Stock Alerts (${alertCount})` }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setChannelFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              channelFilter === tab.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
            Loading your notifications...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
            No notifications found in this category yet. Issue an E-Prescription or reserve a medication to see instant RabbitMQ delivery!
          </div>
        ) : (
          filteredNotifications.map((msg) => (
            <div
              key={msg.messageId}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] inline-flex items-center gap-1.5 ${
                      msg.channelType === 'SMS'
                        ? 'bg-teal-100 text-teal-800'
                        : msg.channelType === 'EMAIL'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {msg.channelType === 'SMS' ? (
                      <MessageSquare className="w-3.5 h-3.5" />
                    ) : msg.channelType === 'EMAIL' ? (
                      <Mail className="w-3.5 h-3.5" />
                    ) : (
                      <BellRing className="w-3.5 h-3.5" />
                    )}
                    {msg.channelType === 'DOMAIN_EVENT' ? 'CLINICAL ALERT' : msg.channelType}
                  </span>

                  <h3 className="font-bold text-slate-900 text-sm">
                    {msg.subject}
                  </h3>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[11px] inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Delivered via RabbitMQ
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {new Date(msg.publishedAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-500">
                Recipient: <span className="font-semibold text-slate-700">{msg.recipient}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                {msg.bodyPreview}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
