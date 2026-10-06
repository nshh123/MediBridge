-- ============================================================================
-- MediBridge Relational Database Schema (PostgreSQL / SQLite Compatible DDL)
-- Satisfies Requirement 2c & Requirement 5:
--   - Primary Keys, Foreign Keys, CHECK & UNIQUE Constraints, B-Tree Indexes
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE CHECK (name IN ('PATIENT', 'DOCTOR', 'PHARMACIST', 'ADMIN')),
    description TEXT NOT NULL,
    permissions_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    password_hash TEXT,
    role_id TEXT NOT NULL,
    oauth_provider TEXT DEFAULT 'local',
    oauth_subject TEXT,
    license_number TEXT,
    organization TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS pharmacies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    district TEXT NOT NULL,
    sector TEXT NOT NULL,
    address TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    operating_hours TEXT NOT NULL,
    accepts_rssb INTEGER DEFAULT 1,
    accepts_mmi INTEGER DEFAULT 1,
    accepts_radiant INTEGER DEFAULT 1,
    verified INTEGER DEFAULT 1,
    manager_user_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (manager_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS medications (
    id TEXT PRIMARY KEY,
    generic_name TEXT NOT NULL,
    brand_name TEXT NOT NULL,
    category TEXT NOT NULL,
    dosage_form TEXT NOT NULL,
    strength TEXT NOT NULL,
    requires_prescription INTEGER DEFAULT 1,
    essential_medicine INTEGER DEFAULT 1,
    active_ingredients TEXT NOT NULL,
    description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pharmacy_inventory (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    medication_id TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    stock_quantity INTEGER NOT NULL CHECK (stock_quantity >= 0),
    reorder_level INTEGER NOT NULL DEFAULT 15,
    unit_price_rwf INTEGER NOT NULL CHECK (unit_price_rwf > 0),
    expiry_date TEXT NOT NULL,
    discount_percent INTEGER DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 90),
    updated_at TEXT NOT NULL,
    FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE CASCADE,
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
    UNIQUE(pharmacy_id, medication_id, batch_number)
);

CREATE TABLE IF NOT EXISTS stock_reservations (
    id TEXT PRIMARY KEY,
    reservation_code TEXT NOT NULL UNIQUE,
    patient_user_id TEXT NOT NULL,
    pharmacy_id TEXT NOT NULL,
    inventory_id TEXT NOT NULL,
    prescription_doc_id TEXT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    total_price_rwf INTEGER NOT NULL CHECK (total_price_rwf >= 0),
    status TEXT NOT NULL CHECK (status IN ('RESERVED', 'DISPENSED', 'CANCELLED', 'EXPIRED')),
    pickup_deadline TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (patient_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES pharmacy_inventory(id) ON DELETE CASCADE
);

-- Performance Optimization Indexes (Requirement 2c & Requirement 6)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_pharmacies_district ON pharmacies(district, verified);
CREATE INDEX IF NOT EXISTS idx_medications_search ON medications(generic_name, brand_name, category);
CREATE INDEX IF NOT EXISTS idx_inventory_lookup ON pharmacy_inventory(medication_id, stock_quantity, unit_price_rwf);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON pharmacy_inventory(expiry_date);
CREATE INDEX IF NOT EXISTS idx_reservations_patient ON stock_reservations(patient_user_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_pharmacy ON stock_reservations(pharmacy_id, status);
