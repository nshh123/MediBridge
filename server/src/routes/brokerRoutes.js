import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
  getBrokerDashboardState,
  registerSseClient,
  dispatchSmsNotification,
  dispatchEmailNotification,
  publishBrokerEvent
} from '../services/rabbitmq.js';

const router = express.Router();

// GET /api/broker/state — Returns RabbitMQ exchanges, queues, metrics, and message log
router.get('/state', authenticateToken, (req, res) => {
  res.json(getBrokerDashboardState());
});

// GET /api/broker/stream — Server-Sent Events (SSE) stream for live RabbitMQ queue telemetry
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);
  registerSseClient(res);
});

// POST /api/broker/publish-test — Dispatch a live test SMS, Email, or Event through RabbitMQ
router.post('/publish-test', authenticateToken, async (req, res) => {
  const { channelType = 'SMS', recipient, subject, message } = req.body;

  let envelope;
  if (channelType === 'SMS') {
    envelope = await dispatchSmsNotification({
      phone: recipient || req.user.phone || '+250 788 412 091',
      recipientName: req.user.fullName,
      contextType: 'manual_test',
      message: message || `[MediBridge RW] Test SMS alert triggered by ${req.user.fullName} (${req.user.role}) via RabbitMQ queue.notifications.sms.`
    });
  } else if (channelType === 'EMAIL') {
    envelope = await dispatchEmailNotification({
      email: recipient || req.user.email,
      recipientName: req.user.fullName,
      contextType: 'manual_test',
      subject: subject || 'MediBridge RabbitMQ Transactional Email Test',
      message: message || `This transactional email was published to exchange 'medibridge.events' and consumed by worker-email-smtp.`
    });
  } else {
    envelope = await publishBrokerEvent('inventory.system_health_ping', {
      recipient: recipient || 'All Pharmacy Nodes',
      subject: subject || 'Domain Event Broadcast Ping',
      message: message || `Event broadcast initiated by ${req.user.fullName} at ${new Date().toLocaleTimeString()}.`,
      actorName: req.user.fullName,
      actorRole: req.user.role
    });
  }

  res.status(201).json({
    message: `Message published to RabbitMQ exchange '${envelope.exchange}' with routing key '${envelope.routingKey}'`,
    envelope
  });
});

export default router;
