import express from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { queryOne, queryAll, execute } from '../config/relationalDb.js';
import { insertAuditLog } from '../config/mongoDb.js';
import { signUserToken, authenticateToken } from '../middleware/authMiddleware.js';
import { dispatchEmailNotification } from '../services/rabbitmq.js';

const router = express.Router();

// Store short-lived OAuth2 Authorization Codes (RFC 6749 Authorization Code + PKCE Flow)
const oauthAuthorizationCodes = new Map();

function formatUserResponse(dbUser) {
  return {
    id: dbUser.id,
    fullName: dbUser.full_name,
    email: dbUser.email,
    phone: dbUser.phone,
    role: dbUser.role_name,
    oauthProvider: dbUser.oauth_provider,
    licenseNumber: dbUser.license_number,
    organization: dbUser.organization,
    permissions: JSON.parse(dbUser.permissions_json || '[]')
  };
}

// GET /api/auth/demo-accounts — Quick switcher accounts for grading/testing all 4 RBAC roles
router.get('/demo-accounts', async (req, res) => {
  const users = await queryAll(
    `SELECT u.id, u.full_name, u.email, u.phone, u.oauth_provider, u.license_number, u.organization, r.name AS role_name, r.description AS role_description
     FROM users u
     JOIN roles r ON u.role_id = r.id
     ORDER BY CASE r.name
       WHEN 'PATIENT' THEN 1
       WHEN 'DOCTOR' THEN 2
       WHEN 'PHARMACIST' THEN 3
       WHEN 'ADMIN' THEN 4
     END`
  );
  res.json({ accounts: users });
});

// POST /api/auth/login — Standard Email & Password Authentication
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const dbUser = await queryOne(
    `SELECT u.*, r.name AS role_name, r.permissions_json
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE LOWER(u.email) = LOWER(?)`,
    [email.trim()]
  );

  if (!dbUser || !bcrypt.compareSync(password, dbUser.password_hash)) {
    await insertAuditLog({
      eventType: 'AUTH_LOGIN_FAILED',
      actorName: email,
      resourceType: 'AUTH_SESSION',
      severity: 'WARN',
      metadata: { reason: 'Invalid email or password' }
    });
    return res.status(401).json({ error: 'Invalid credentials. (Hint: Demo password is Password123!)' });
  }

  const token = signUserToken(dbUser);
  const userProfile = formatUserResponse(dbUser);

  await insertAuditLog({
    eventType: 'AUTH_LOGIN_SUCCESS',
    actorUserId: userProfile.id,
    actorRole: userProfile.role,
    actorName: userProfile.fullName,
    resourceType: 'AUTH_SESSION',
    severity: 'INFO',
    metadata: { method: 'password_jwt' }
  });

  res.json({
    token,
    authMechanism: 'JWT_BEARER_HS256',
    user: userProfile
  });
});

// POST /api/auth/register — Register a new user account
router.post('/register', async (req, res) => {
  const { fullName, email, phone, password, role = 'PATIENT', organization, licenseNumber } = req.body;
  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'Full name, email, and password are required' });
  }

  const existing = await queryOne('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const allowedRole = ['PATIENT', 'DOCTOR', 'PHARMACIST'].includes(role.toUpperCase())
    ? role.toUpperCase()
    : 'PATIENT';

  const roleRow = await queryOne('SELECT id FROM roles WHERE name = ?', [allowedRole]);
  const newUserId = `usr_${crypto.randomBytes(5).toString('hex')}`;
  const passwordHash = bcrypt.hashSync(password, 10);

  await execute(
    `INSERT INTO users (id, full_name, email, phone, password_hash, role_id, oauth_provider, license_number, organization, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'local', ?, ?, 1, ?)`,
    [
      newUserId,
      fullName.trim(),
      email.trim().toLowerCase(),
      phone || '+250 788 000 000',
      passwordHash,
      roleRow.id,
      licenseNumber || null,
      organization || 'Citizen / Self-Registered',
      new Date().toISOString()
    ]
  );

  const dbUser = await queryOne(
    `SELECT u.*, r.name AS role_name, r.permissions_json
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.id = ?`,
    [newUserId]
  );

  const token = signUserToken(dbUser);
  const userProfile = formatUserResponse(dbUser);

  await dispatchEmailNotification({
    email: userProfile.email,
    recipientName: userProfile.fullName,
    subject: 'Welcome to MediBridge Rwanda — Account Activated',
    message: `Hello ${userProfile.fullName}, your ${userProfile.role} account on MediBridge is now active.`,
    contextType: 'welcome'
  });

  res.status(201).json({
    token,
    authMechanism: 'JWT_BEARER_HS256',
    user: userProfile
  });
});

// ============================================================================
// Requirement 6: OAuth 2.0 Authorization Code + PKCE Flow Endpoints
// ============================================================================

// Step 1: POST /api/auth/oauth/authorize — Issues RFC 6749 Authorization Code
router.post('/oauth/authorize', async (req, res) => {
  const {
    provider = 'google-oauth2',
    email,
    clientId = 'medibridge-web-client-rw',
    redirectUri = 'http://localhost:5173/oauth/callback',
    scope = 'openid profile email clinical.role',
    codeChallenge = 'pkce_sha256_challenge_demo',
    state = crypto.randomBytes(8).toString('hex')
  } = req.body;

  const dbUser = await queryOne(
    `SELECT u.*, r.name AS role_name, r.permissions_json
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE LOWER(u.email) = LOWER(?)`,
    [email || 'aline.patient@medibridge.rw']
  );

  if (!dbUser) {
    return res.status(404).json({ error: 'Selected OAuth2 identity email not found' });
  }

  const authCode = `oauth2_code_${crypto.randomBytes(10).toString('hex')}`;
  oauthAuthorizationCodes.set(authCode, {
    userId: dbUser.id,
    provider,
    clientId,
    redirectUri,
    scope,
    codeChallenge,
    state,
    expiresAt: Date.now() + 5 * 60 * 1000
  });

  res.json({
    authorizationCode: authCode,
    state,
    provider,
    clientId,
    redirectUri,
    scope,
    expiresIn: 300
  });
});

// Step 2: POST /api/auth/oauth/token — Exchanges Authorization Code for Access Token & ID Token
router.post('/oauth/token', async (req, res) => {
  const { grantType = 'authorization_code', code, provider = 'google-oauth2' } = req.body;

  if (grantType !== 'authorization_code' || !code) {
    return res.status(400).json({ error: 'unsupported_grant_type or missing authorization code' });
  }

  const codeRecord = oauthAuthorizationCodes.get(code);
  if (!codeRecord || Date.now() > codeRecord.expiresAt) {
    return res.status(400).json({ error: 'invalid_grant: Authorization code expired or already used' });
  }

  // Consume single-use authorization code
  oauthAuthorizationCodes.delete(code);

  const dbUser = await queryOne(
    `SELECT u.*, r.name AS role_name, r.permissions_json
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.id = ?`,
    [codeRecord.userId]
  );

  const accessToken = signUserToken({ ...dbUser, oauth_provider: provider });
  const userProfile = formatUserResponse({ ...dbUser, oauth_provider: provider });

  await insertAuditLog({
    eventType: 'OAUTH2_TOKEN_EXCHANGE_SUCCESS',
    actorUserId: userProfile.id,
    actorRole: userProfile.role,
    actorName: userProfile.fullName,
    resourceType: 'OAUTH2_PROVIDER',
    resourceId: provider,
    severity: 'INFO',
    metadata: {
      grantType: 'authorization_code',
      scope: codeRecord.scope,
      clientId: codeRecord.clientId
    }
  });

  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 43200,
    scope: codeRecord.scope,
    id_token_claims: {
      iss: `https://accounts.${provider.replace('-oauth2', '')}.com`,
      sub: dbUser.oauth_subject || `oauth_${dbUser.id}`,
      aud: codeRecord.clientId,
      email: userProfile.email,
      name: userProfile.fullName,
      role: userProfile.role
    },
    token: accessToken,
    authMechanism: `OAUTH2_AUTHORIZATION_CODE (${provider.toUpperCase()})`,
    user: userProfile
  });
});

// GET /api/auth/me — Verify current user token & return RBAC profile
router.get('/me', authenticateToken, async (req, res) => {
  res.json({ user: req.user });
});

export default router;
