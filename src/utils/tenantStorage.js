import { supabase } from '../supabaseClient';

const SESSION_KEY = 'saas_auth_session';

/**
 * Get the currently logged-in tenant ID.
 * Returns the tenant UUID, 'master' for super admin, or 'guest'.
 */
export function getCurrentTenantId() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return 'guest';
    const parsed = JSON.parse(raw);
    if (parsed.type === 'superadmin') return 'master';
    return parsed.id || 'guest';
  } catch {
    return 'guest';
  }
}

/**
 * Get the currently logged-in tenant object.
 */
export function getCurrentTenant() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Generate a tenant-scoped localStorage key.
 * Example: getScopedKey('bilty_records') => 'tenant_abc-123_bilty_records'
 */
export function getScopedKey(baseKey) {
  const tenantId = getCurrentTenantId();
  return `tenant_${tenantId}_${baseKey}`;
}

/**
 * Get tenant-scoped item from localStorage.
 */
export function getTenantItem(baseKey, fallback = null) {
  try {
    const key = getScopedKey(baseKey);
    const data = localStorage.getItem(key);
    return data !== null ? JSON.parse(data) : fallback;
  } catch (e) {
    console.error(`Error loading tenant key ${baseKey}:`, e);
    return fallback;
  }
}

/**
 * Set tenant-scoped item into localStorage.
 */
export function setTenantItem(baseKey, data) {
  try {
    const key = getScopedKey(baseKey);
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error saving tenant key ${baseKey}:`, e);
  }
}

/**
 * Remove tenant-scoped item from localStorage.
 */
export function removeTenantItem(baseKey) {
  try {
    const key = getScopedKey(baseKey);
    localStorage.removeItem(key);
  } catch (e) {
    console.error(`Error removing tenant key ${baseKey}:`, e);
  }
}

/**
 * Check if a string is a valid RFC-4122 UUID.
 */
export function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ''));
}

/**
 * Helper to attach tenant_id filter to Supabase queries.
 * If logged in as a tenant with a valid UUID, automatically appends .eq('tenant_id', tenantId).
 */
export function applyTenantFilter(query) {
  const tenantId = getCurrentTenantId();
  if (tenantId && tenantId !== 'master' && tenantId !== 'guest' && isValidUUID(tenantId)) {
    return query.eq('tenant_id', tenantId);
  }
  return query;
}

/**
 * Helper to attach tenant_id payload to inserts / upserts.
 */
export function withTenantId(data) {
  const tenantId = getCurrentTenantId();
  if (tenantId && tenantId !== 'master' && tenantId !== 'guest' && isValidUUID(tenantId)) {
    if (Array.isArray(data)) {
      return data.map(item => ({ ...item, tenant_id: tenantId }));
    }
    return { ...data, tenant_id: tenantId };
  }
  return data;
}

