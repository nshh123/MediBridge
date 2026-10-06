import express from 'express';
import crypto from 'node:crypto';
import { queryAll, queryOne, execute } from '../config/relationalDb.js';
import { insertAuditLog } from '../config/mongoDb.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/rbacMiddleware.js';
import {
  getCached,
  setCached,
  invalidateCachePrefix
} from '../services/cacheService.js';
import {
  dispatchSmsNotification,
  dispatchEmailNotification,
  publishBrokerEvent
} from '../services/rabbitmq.js';

const router = express.Router();

// GET /api/pharmacies/stock — Public/Authenticated live medication stock finder (LRU Cached)
router.get('/stock', async (req, res) => {
  const {
    q = '',
    district = 'ALL',
    category = 'ALL',
    insurance = 'ALL',
    onlyInStock = 'false',
    sortBy = 'price_asc'
  } = req.query;

  const cacheKey = `stock:${q}:${district}:${category}:${insurance}:${onlyInStock}:${sortBy}`;
  const cachedData = getCached(cacheKey);
  if (cachedData) {
    res.setHeader('X-Cache', 'HIT');
    return res.json({ ...cachedData, cacheStatus: 'HIT' });
  }

  let sql = `
    SELECT
      inv.id AS inventory_id,
      inv.batch_number,
      inv.stock_quantity,
      inv.reorder_level,
      inv.unit_price_rwf,
      inv.expiry_date,
      inv.discount_percent,
      inv.updated_at,
      m.id AS medication_id,
      m.generic_name,
      m.brand_name,
      m.category,
      m.dosage_form,
      m.strength,
      m.requires_prescription,
      m.active_ingredients,
      m.description,
      p.id AS pharmacy_id,
      p.name AS pharmacy_name,
      p.district,
      p.sector,
      p.address,
      p.phone AS pharmacy_phone,
      p.email AS pharmacy_email,
      p.operating_hours,
      p.accepts_rssb,
      p.accepts_mmi,
      p.accepts_radiant,
      p.verified
    FROM pharmacy_inventory inv
    JOIN medications m ON inv.medication_id = m.id
    JOIN pharmacies p ON inv.pharmacy_id = p.id
    WHERE 1 = 1
  `;

  const params = [];

  if (q.trim()) {
    sql += ` AND (LOWER(m.generic_name) LIKE ? OR LOWER(m.brand_name) LIKE ? OR LOWER(m.category) LIKE ? OR LOWER(p.name) LIKE ?)`;
    const pattern = `%${q.trim().toLowerCase()}%`;
    params.push(pattern, pattern, pattern, pattern);
  }

  if (district !== 'ALL') {
    sql += ` AND LOWER(p.district) = LOWER(?)`;
    params.push(district);
  }

  if (category !== 'ALL') {
    sql += ` AND LOWER(m.category) = LOWER(?)`;
    params.push(category);
  }

  if (insurance === 'RSSB') {
    sql += ` AND p.accepts_rssb = 1`;
  } else if (insurance === 'MMI') {
    sql += ` AND p.accepts_mmi = 1`;
  } else if (insurance === 'RADIANT') {
    sql += ` AND p.accepts_radiant = 1`;
  }

  if (onlyInStock === 'true') {
    sql += ` AND inv.stock_quantity > 0`;
  }

  if (sortBy === 'price_asc') {
    sql += ` ORDER BY inv.unit_price_rwf ASC`;
  } else if (sortBy === 'price_desc') {
    sql += ` ORDER BY inv.unit_price_rwf DESC`;
  } else if (sortBy === 'stock_desc') {
    sql += ` ORDER BY inv.stock_quantity DESC`;
  } else if (sortBy === 'expiry_asc') {
    sql += ` ORDER BY inv.expiry_date ASC`;
  }

  const rows = await queryAll(sql, params);

  const enrichedRows = rows.map((row) => {
    const effectivePriceRwf = row.discount_percent > 0
      ? Math.round(row.unit_price_rwf * (1 - row.discount_percent / 100))
      : row.unit_price_rwf;

    const daysToExpiry = Math.ceil(
      (new Date(row.expiry_date).getTime() - Date.now()) / (1000 * 3600 * 24)
    );

    return {
      ...row,
      effective_price_rwf: effectivePriceRwf,
      days_to_expiry: daysToExpiry,
      is_near_expiry: daysToExpiry <= 60,
      is_low_stock: row.stock_quantity <= row.reorder_level
    };
  });

  const payload = {
    count: enrichedRows.length,
    items: enrichedRows
  };

  setCached(cacheKey, payload, 25);
  res.setHeader('X-Cache', 'MISS');
  res.json({ ...payload, cacheStatus: 'MISS' });
});

// GET /api/pharmacies/catalog — List pharmacies and medications for dropdowns
router.get('/catalog', async (req, res) => {
  const [pharmacies, medications] = await Promise.all([
    queryAll('SELECT * FROM pharmacies ORDER BY name ASC'),
    queryAll('SELECT * FROM medications ORDER BY generic_name ASC')
  ]);
  res.json({ pharmacies, medications });
});

// POST /api/pharmacies/reserve — Reserve medication stock (Patient / Doctor / Admin)
router.post('/reserve', authenticateToken, requirePermission('reservation:create'), async (req, res) => {
  const { inventoryId, quantity = 1, prescriptionCode } = req.body;
  const qty = Number(quantity);

  if (!inventoryId || qty <= 0) {
    return res.status(400).json({ error: 'Valid inventoryId and positive quantity are required' });
  }

  const inv = await queryOne(
    `SELECT inv.*, m.generic_name, m.brand_name, m.requires_prescription, p.name AS pharmacy_name, p.phone AS pharmacy_phone, p.address
     FROM pharmacy_inventory inv
     JOIN medications m ON inv.medication_id = m.id
     JOIN pharmacies p ON inv.pharmacy_id = p.id
     WHERE inv.id = ?`,
    [inventoryId]
  );

  if (!inv) {
    return res.status(404).json({ error: 'Inventory batch not found' });
  }

  if (inv.stock_quantity < qty) {
    return res.status(400).json({
      error: `Insufficient stock. Only ${inv.stock_quantity} unit(s) available.`
    });
  }

  const unitPrice = inv.discount_percent > 0
    ? Math.round(inv.unit_price_rwf * (1 - inv.discount_percent / 100))
    : inv.unit_price_rwf;

  const totalPriceRwf = unitPrice * qty;
  const reservationId = `res_${crypto.randomBytes(5).toString('hex')}`;
  const reservationCode = `RSV-${Math.floor(1000 + Math.random() * 9000)}`;
  const pickupDeadline = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  // Decrement stock in Relational DB
  await execute(
    `UPDATE pharmacy_inventory SET stock_quantity = stock_quantity - ?, updated_at = ? WHERE id = ?`,
    [qty, nowIso, inventoryId]
  );

  await execute(
    `INSERT INTO stock_reservations (id, reservation_code, patient_user_id, pharmacy_id, inventory_id, prescription_doc_id, quantity, total_price_rwf, status, pickup_deadline, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'RESERVED', ?, ?)`,
    [
      reservationId,
      reservationCode,
      req.user.id,
      inv.pharmacy_id,
      inventoryId,
      prescriptionCode || null,
      qty,
      totalPriceRwf,
      pickupDeadline,
      nowIso
    ]
  );

  invalidateCachePrefix('stock:');

  // Publish SMS + Email notifications via RabbitMQ
  await dispatchSmsNotification({
    phone: req.user.phone,
    recipientName: req.user.fullName,
    contextType: 'reservation_pin',
    message: `[MediBridge RW] Reservation ${reservationCode} confirmed! ${qty}x ${inv.brand_name} held at ${inv.pharmacy_name} (${totalPriceRwf.toLocaleString()} RWF). Show code before ${new Date(pickupDeadline).toLocaleTimeString()}.`
  });

  await dispatchEmailNotification({
    email: req.user.email,
    recipientName: req.user.fullName,
    contextType: 'reservation_receipt',
    subject: `Medication Reservation Confirmed: ${reservationCode} (${inv.pharmacy_name})`,
    message: `Reservation Code: ${reservationCode}\nMedication: ${inv.generic_name} (${inv.brand_name})\nQuantity: ${qty}\nTotal Price: ${totalPriceRwf.toLocaleString()} RWF\nPickup Pharmacy: ${inv.pharmacy_name}, ${inv.address}`
  });

  // Check if stock fell below reorder threshold and emit RabbitMQ low-stock event
  if (inv.stock_quantity - qty <= inv.reorder_level) {
    await publishBrokerEvent('inventory.low_stock', {
      recipient: `${inv.pharmacy_name} Inventory Desk`,
      subject: `Low Stock Alert: ${inv.brand_name} (${inv.stock_quantity - qty} left)`,
      message: `Batch ${inv.batch_number} of ${inv.generic_name} at ${inv.pharmacy_name} dropped to ${inv.stock_quantity - qty} units (Reorder threshold: ${inv.reorder_level}).`,
      actorName: req.user.fullName,
      actorRole: req.user.role
    });
  }

  res.status(201).json({
    reservation: {
      id: reservationId,
      reservationCode,
      medicationName: `${inv.brand_name} (${inv.generic_name})`,
      pharmacyName: inv.pharmacy_name,
      quantity: qty,
      totalPriceRwf,
      status: 'RESERVED',
      pickupDeadline
    }
  });
});

// GET /api/pharmacies/reservations — List reservations based on RBAC role
router.get('/reservations', authenticateToken, async (req, res) => {
  let sql = `
    SELECT
      r.*,
      u.full_name AS patient_name,
      u.phone AS patient_phone,
      p.name AS pharmacy_name,
      p.district,
      m.generic_name,
      m.brand_name,
      inv.batch_number
    FROM stock_reservations r
    JOIN users u ON r.patient_user_id = u.id
    JOIN pharmacies p ON r.pharmacy_id = p.id
    JOIN pharmacy_inventory inv ON r.inventory_id = inv.id
    JOIN medications m ON inv.medication_id = m.id
  `;
  const params = [];

  if (req.user.role === 'PATIENT') {
    sql += ` WHERE r.patient_user_id = ?`;
    params.push(req.user.id);
  }

  sql += ` ORDER BY r.created_at DESC`;
  const reservations = await queryAll(sql, params);
  res.json({ reservations });
});

// PATCH /api/pharmacies/reservations/:id/status — Pharmacist marks reservation DISPENSED or CANCELLED
router.patch('/reservations/:id/status', authenticateToken, requirePermission('reservation:fulfill'), async (req, res) => {
  const { status } = req.body;
  if (!['DISPENSED', 'CANCELLED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const existing = await queryOne(
    `SELECT r.*, u.full_name AS patient_name, u.phone AS patient_phone, m.brand_name, p.name AS pharmacy_name
     FROM stock_reservations r
     JOIN users u ON r.patient_user_id = u.id
     JOIN pharmacy_inventory inv ON r.inventory_id = inv.id
     JOIN medications m ON inv.medication_id = m.id
     JOIN pharmacies p ON r.pharmacy_id = p.id
     WHERE r.id = ?`,
    [req.params.id]
  );

  if (!existing) {
    return res.status(404).json({ error: 'Reservation not found' });
  }

  await execute('UPDATE stock_reservations SET status = ? WHERE id = ?', [status, req.params.id]);

  if (status === 'CANCELLED' && existing.status === 'RESERVED') {
    await execute(
      'UPDATE pharmacy_inventory SET stock_quantity = stock_quantity + ? WHERE id = ?',
      [existing.quantity, existing.inventory_id]
    );
  }

  invalidateCachePrefix('stock:');

  await dispatchSmsNotification({
    phone: existing.patient_phone,
    recipientName: existing.patient_name,
    contextType: 'reservation_update',
    message: `[MediBridge RW] Reservation ${existing.reservation_code} (${existing.brand_name}) at ${existing.pharmacy_name} has been marked as ${status} by ${req.user.fullName}.`
  });

  res.json({ message: `Reservation ${existing.reservation_code} updated to ${status}` });
});

// POST /api/pharmacies/inventory — Pharmacist adds or updates a stock batch
router.post('/inventory', authenticateToken, requirePermission('stock:write'), async (req, res) => {
  const {
    pharmacyId,
    medicationId,
    batchNumber,
    stockQuantity,
    reorderLevel = 15,
    unitPriceRwf,
    expiryDate,
    discountPercent = 0
  } = req.body;

  if (!pharmacyId || !medicationId || !batchNumber || stockQuantity === undefined || !unitPriceRwf || !expiryDate) {
    return res.status(400).json({ error: 'Missing required inventory batch fields' });
  }

  const newId = `inv_${crypto.randomBytes(5).toString('hex')}`;
  const nowIso = new Date().toISOString();

  await execute(
    `INSERT INTO pharmacy_inventory (id, pharmacy_id, medication_id, batch_number, stock_quantity, reorder_level, unit_price_rwf, expiry_date, discount_percent, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId,
      pharmacyId,
      medicationId,
      batchNumber.trim().toUpperCase(),
      Number(stockQuantity),
      Number(reorderLevel),
      Number(unitPriceRwf),
      expiryDate,
      Number(discountPercent),
      nowIso
    ]
  );

  invalidateCachePrefix('stock:');

  await insertAuditLog({
    eventType: 'INVENTORY_BATCH_ADDED',
    actorUserId: req.user.id,
    actorRole: req.user.role,
    actorName: req.user.fullName,
    resourceType: 'PHARMACY_INVENTORY',
    resourceId: newId,
    severity: 'INFO',
    metadata: { pharmacyId, medicationId, batchNumber, stockQuantity, unitPriceRwf }
  });

  res.status(201).json({ id: newId, message: 'Inventory batch added successfully' });
});

// PATCH /api/pharmacies/inventory/:id — Pharmacist updates stock quantity, price, or expiry discount
router.patch('/inventory/:id', authenticateToken, requirePermission('stock:write'), async (req, res) => {
  const { stockQuantity, unitPriceRwf, discountPercent } = req.body;
  const existing = await queryOne('SELECT * FROM pharmacy_inventory WHERE id = ?', [req.params.id]);
  if (!existing) {
    return res.status(404).json({ error: 'Inventory batch not found' });
  }

  const newQty = stockQuantity !== undefined ? Number(stockQuantity) : existing.stock_quantity;
  const newPrice = unitPriceRwf !== undefined ? Number(unitPriceRwf) : existing.unit_price_rwf;
  const newDiscount = discountPercent !== undefined ? Number(discountPercent) : existing.discount_percent;

  await execute(
    `UPDATE pharmacy_inventory
     SET stock_quantity = ?, unit_price_rwf = ?, discount_percent = ?, updated_at = ?
     WHERE id = ?`,
    [newQty, newPrice, newDiscount, new Date().toISOString(), req.params.id]
  );

  invalidateCachePrefix('stock:');
  res.json({ message: 'Inventory batch updated' });
});

// POST /api/pharmacies/inventory/:id/broadcast-expiry — Broadcast near-expiry redistribution alert via RabbitMQ
router.post('/inventory/:id/broadcast-expiry', authenticateToken, requirePermission('stock:expiry_broadcast'), async (req, res) => {
  const { discountPercent = 25 } = req.body;

  const inv = await queryOne(
    `SELECT inv.*, m.generic_name, m.brand_name, p.name AS pharmacy_name, p.district, p.phone
     FROM pharmacy_inventory inv
     JOIN medications m ON inv.medication_id = m.id
     JOIN pharmacies p ON inv.pharmacy_id = p.id
     WHERE inv.id = ?`,
    [req.params.id]
  );

  if (!inv) {
    return res.status(404).json({ error: 'Inventory item not found' });
  }

  await execute(
    `UPDATE pharmacy_inventory SET discount_percent = ?, updated_at = ? WHERE id = ?`,
    [Number(discountPercent), new Date().toISOString(), req.params.id]
  );

  invalidateCachePrefix('stock:');

  const discountedPrice = Math.round(inv.unit_price_rwf * (1 - Number(discountPercent) / 100));

  const brokerEvt = await publishBrokerEvent('inventory.expiry_redistribution', {
    recipient: 'All Kigali Partner Clinics & Community Pharmacies',
    subject: `Near-Expiry Redistribution: ${inv.brand_name} (-${discountPercent}% off)`,
    message: `${inv.pharmacy_name} (${inv.district}) marked Batch ${inv.batch_number} (${inv.stock_quantity} units expiring ${inv.expiry_date}) at ${discountPercent}% discount (${discountedPrice.toLocaleString()} RWF/unit) to prevent wastage.`,
    actorName: req.user.fullName,
    actorRole: req.user.role
  });

  res.json({
    message: 'Near-expiry discount applied and broadcast across RabbitMQ clinic redistribution network',
    brokerEvent: brokerEvt
  });
});

export default router;
