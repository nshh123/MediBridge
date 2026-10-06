import jwt from 'jsonwebtoken';
import { queryOne } from '../config/relationalDb.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'medibridge-auca-webtech-super-secret-key-2026';

export function signUserToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.full_name || user.fullName,
      role: user.role_name || user.role,
      oauthProvider: user.oauth_provider || user.oauthProvider || 'local'
    },
    JWT_SECRET,
    { expiresIn: '12h', issuer: 'medibridge-api' }
  );
}

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Missing or malformed Bearer token in Authorization header'
    });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const dbUser = await queryOne(
      `SELECT u.*, r.name AS role_name, r.permissions_json
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ? AND u.is_active = 1`,
      [decoded.sub]
    );

    if (!dbUser) {
      return res.status(401).json({
        error: 'Invalid user session',
        message: 'User account not found or deactivated'
      });
    }

    req.user = {
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
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Token verification failed',
      message: err.message
    });
  }
}
