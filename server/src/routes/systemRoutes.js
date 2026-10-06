import express from 'express';
import {
  queryAll,
  queryOne,
  execute,
  getRelationalEngineInfo
} from '../config/relationalDb.js';
import {
  getMongoStats,
  findPrescriptions,
  findAuditLogs,
  findAiTriageReports,
  insertAuditLog
} from '../config/mongoDb.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireRole, RBAC_ROLE_DEFINITIONS } from '../middleware/rbacMiddleware.js';
import { getPerformanceMetrics } from '../services/cacheService.js';
import { getBrokerDashboardState } from '../services/rabbitmq.js';

const router = express.Router();

// GET /api/system/overview — Comprehensive Hybrid Persistence, RBAC, Performance & Broker Telemetry (Admin Only)
router.get('/overview', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  const [
    usersCount,
    pharmaciesCount,
    medicationsCount,
    inventoryCount,
    reservationsCount,
    sampleUsers,
    sampleInventory,
    mongoStats,
    mongoPrescriptions,
    mongoAuditLogs,
    mongoAiReports
  ] = await Promise.all([
    queryOne('SELECT COUNT(*) AS cnt FROM users'),
    queryOne('SELECT COUNT(*) AS cnt FROM pharmacies'),
    queryOne('SELECT COUNT(*) AS cnt FROM medications'),
    queryOne('SELECT COUNT(*) AS cnt FROM pharmacy_inventory'),
    queryOne('SELECT COUNT(*) AS cnt FROM stock_reservations'),
    queryAll(`SELECT u.id, u.full_name, u.email, u.phone, u.oauth_provider, u.organization, r.name AS role_name
              FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.created_at DESC`),
    queryAll(`SELECT inv.id, inv.batch_number, inv.stock_quantity, inv.unit_price_rwf, inv.expiry_date,
                     m.brand_name, p.name AS pharmacy_name
              FROM pharmacy_inventory inv
              JOIN medications m ON inv.medication_id = m.id
              JOIN pharmacies p ON inv.pharmacy_id = p.id
              LIMIT 8`),
    getMongoStats(),
    findPrescriptions(),
    findAuditLogs(25),
    findAiTriageReports(10)
  ]);

  res.json({
    relationalDb: {
      ...getRelationalEngineInfo(),
      tableCounts: {
        roles: 4,
        users: Number(usersCount?.cnt || 0),
        pharmacies: Number(pharmaciesCount?.cnt || 0),
        medications: Number(medicationsCount?.cnt || 0),
        pharmacy_inventory: Number(inventoryCount?.cnt || 0),
        stock_reservations: Number(reservationsCount?.cnt || 0)
      },
      sampleUsers,
      sampleInventory
    },
    nonRelationalDb: {
      ...mongoStats,
      samplePrescriptions: mongoPrescriptions.slice(0, 5),
      sampleAuditLogs: mongoAuditLogs.slice(0, 12),
      sampleAiReports: mongoAiReports.slice(0, 5)
    },
    rbacModel: RBAC_ROLE_DEFINITIONS,
    performance: getPerformanceMetrics(),
    rabbitMqSummary: {
      brokerMode: getBrokerDashboardState().brokerMode,
      queues: getBrokerDashboardState().queues
    }
  });
});

// PATCH /api/system/users/:id/role — Admin updates a user's RBAC Role (Requirement 8)
router.patch('/users/:id/role', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  const { roleName } = req.body;
  if (!RBAC_ROLE_DEFINITIONS[roleName]) {
    return res.status(400).json({ error: 'Invalid role name' });
  }

  const roleRow = await queryOne('SELECT id FROM roles WHERE name = ?', [roleName]);
  await execute('UPDATE users SET role_id = ? WHERE id = ?', [roleRow.id, req.params.id]);

  await insertAuditLog({
    eventType: 'RBAC_ROLE_UPDATED',
    actorUserId: req.user.id,
    actorRole: req.user.role,
    actorName: req.user.fullName,
    resourceType: 'USER_ROLE',
    resourceId: req.params.id,
    severity: 'SECURITY',
    metadata: { assignedRole: roleName }
  });

  res.json({ message: `User role updated to ${roleName}` });
});

export default router;
