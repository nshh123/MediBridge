import { insertAuditLog } from '../config/mongoDb.js';

// ============================================================================
// MediBridge RBAC (Role-Based Access Control) Policy Matrix (Requirement 8)
// ============================================================================

export const RBAC_ROLE_DEFINITIONS = {
  PATIENT: {
    id: 'role_patient',
    name: 'PATIENT',
    description: 'Citizens & patients searching live medication stock, reserving drugs, and viewing E-Prescriptions.',
    permissions: [
      'stock:read',
      'reservation:create',
      'reservation:read_own',
      'prescription:read_own',
      'ai:triage'
    ]
  },
  DOCTOR: {
    id: 'role_doctor',
    name: 'DOCTOR',
    description: 'Licensed clinicians issuing digitally signed E-Prescriptions and running AI drug-interaction checks.',
    permissions: [
      'stock:read',
      'prescription:create',
      'prescription:read_all',
      'ai:triage',
      'ai:clinical_override'
    ]
  },
  PHARMACIST: {
    id: 'role_pharmacist',
    name: 'PHARMACIST',
    description: 'Licensed pharmacy managers updating stock batches, verifying/dispensing E-Prescriptions, and broadcasting expiry alerts.',
    permissions: [
      'stock:read',
      'stock:write',
      'stock:expiry_broadcast',
      'reservation:read_pharmacy',
      'reservation:fulfill',
      'prescription:verify',
      'prescription:dispense',
      'ai:triage'
    ]
  },
  ADMIN: {
    id: 'role_admin',
    name: 'ADMIN',
    description: 'System administrators overseeing RBAC policies, pharmacy verifications, RabbitMQ queues, and hybrid database telemetry.',
    permissions: [
      'stock:read',
      'stock:write',
      'stock:expiry_broadcast',
      'reservation:read_all',
      'reservation:fulfill',
      'prescription:create',
      'prescription:read_all',
      'prescription:verify',
      'prescription:dispense',
      'ai:triage',
      'broker:manage',
      'system:admin',
      'rbac:manage'
    ]
  }
};

export function requireRole(allowedRoles = []) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    if (!allowedRoles.includes(req.user.role) && req.user.role !== 'ADMIN') {
      await insertAuditLog({
        eventType: 'RBAC_ACCESS_DENIED',
        actorUserId: req.user.id,
        actorRole: req.user.role,
        actorName: req.user.fullName,
        resourceType: req.originalUrl,
        severity: 'SECURITY',
        metadata: {
          requiredRoles: allowedRoles,
          attemptedMethod: req.method
        }
      });

      return res.status(403).json({
        error: 'RBAC Access Denied',
        message: `Role '${req.user.role}' is not authorized to access this resource. Required role(s): ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}

export function requirePermission(permissionName) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const hasPerm = req.user.permissions.includes(permissionName) || req.user.role === 'ADMIN';
    if (!hasPerm) {
      await insertAuditLog({
        eventType: 'RBAC_PERMISSION_DENIED',
        actorUserId: req.user.id,
        actorRole: req.user.role,
        actorName: req.user.fullName,
        resourceType: req.originalUrl,
        severity: 'SECURITY',
        metadata: {
          requiredPermission: permissionName,
          userPermissions: req.user.permissions
        }
      });

      return res.status(403).json({
        error: 'RBAC Permission Denied',
        message: `Your role (${req.user.role}) lacks the '${permissionName}' permission required for this operation.`
      });
    }

    next();
  };
}
