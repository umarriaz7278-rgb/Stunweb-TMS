import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

const LOCAL_STORAGE_SESSION_KEY = 'saas_auth_session';
const LOCAL_STORAGE_TENANTS_KEY = 'saas_local_tenants_cache';

// Built-in Super Admin fallback credentials
const DEFAULT_SUPERADMIN = {
  username: 'superadmin',
  password: 'admin123',
  full_name: 'Master Super Admin',
  type: 'superadmin'
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  // Helper to get local tenants fallback
  const getLocalTenants = () => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_TENANTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const saveLocalTenants = (tenants) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_TENANTS_KEY, JSON.stringify(tenants));
    } catch (e) {
      console.error('Error saving local tenants:', e);
    }
  };

  // Check and verify session periodically
  useEffect(() => {
    async function verifyCurrentSession() {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      if (currentUser.type === 'superadmin') {
        setLoading(false);
        return;
      }

      // If tenant, verify if still active and not expired in DB
      try {
        const { data, error } = await supabase
          .from('saas_tenants')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (!error && data) {
          if (!data.is_active) {
            logout();
            alert('Aapka account administrator ki taraf se suspend kar diya gaya hai.');
            setLoading(false);
            return;
          }
          if (data.expires_at && new Date(data.expires_at) < new Date()) {
            logout();
            alert('Aapki subscription expire ho chuki hai. Baraye meherbani admin se rabta karein.');
            setLoading(false);
            return;
          }
          // Update cached tenant
          const updatedUser = { ...data, type: 'tenant' };
          setCurrentUser(updatedUser);
          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(updatedUser));
        }
      } catch (err) {
        console.warn('Session verification error:', err);
      } finally {
        setLoading(false);
      }
    }

    verifyCurrentSession();
  }, []);

  // Login function
  const login = async (username, password) => {
    const cleanUser = (username || '').trim();
    const cleanPass = (password || '').trim();

    if (!cleanUser || !cleanPass) {
      throw new Error('Username aur Password dakhil karein.');
    }

    // 1. Check Client (Tenant) Login in Supabase FIRST
    let tenant = null;
    try {
      const { data, error } = await supabase
        .from('saas_tenants')
        .select('*')
        .eq('username', cleanUser)
        .maybeSingle();

      if (!error && data) {
        tenant = data;
      }
    } catch {
      // ignore
    }

    // Fallback: check local storage tenants
    if (!tenant) {
      const localTenants = getLocalTenants();
      tenant = localTenants.find(t => t.username?.toLowerCase() === cleanUser.toLowerCase());
    }

    // If tenant found, verify password and log in as tenant
    if (tenant) {
      if (tenant.password_hash !== cleanPass && tenant.password !== cleanPass) {
        throw new Error('Ghalat Password! Baraye meherbani theek password dakhil karein.');
      }

      if (tenant.is_active === false) {
        throw new Error('Aapka account Deactivate / Suspend kar diya gaya hai. Baraye meherbani Administrator se rabta karein.');
      }

      if (tenant.expires_at) {
        const expDate = new Date(tenant.expires_at);
        const today = new Date();
        today.setHours(0,0,0,0);
        if (expDate < today) {
          throw new Error(`Aapka subscription package (${tenant.expires_at}) expire ho chuka hai. Renewal ke liye Admin se rabta karein.`);
        }
      }

      const tenantUser = {
        ...tenant,
        type: 'tenant',
      };

      setCurrentUser(tenantUser);
      localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(tenantUser));

      if (tenant.company_name) {
        localStorage.setItem('app_settings_company_name', tenant.company_name);
      }

      return { success: true, user: tenantUser };
    }

    // 2. If not a tenant, check Super Admin Login
    if (cleanUser.toLowerCase() === DEFAULT_SUPERADMIN.username.toLowerCase() && cleanPass === DEFAULT_SUPERADMIN.password) {
      const superAdminUser = {
        id: 'superadmin-master',
        username: cleanUser,
        full_name: 'Master Super Admin',
        type: 'superadmin',
      };
      setCurrentUser(superAdminUser);
      localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(superAdminUser));
      return { success: true, user: superAdminUser };
    }

    // Also check remote `saas_super_admins` table
    try {
      const { data: adminData } = await supabase
        .from('saas_super_admins')
        .select('*')
        .eq('username', cleanUser)
        .eq('password_hash', cleanPass)
        .maybeSingle();

      if (adminData) {
        const superAdminUser = {
          id: adminData.id,
          username: adminData.username,
          full_name: adminData.full_name || 'Master Super Admin',
          type: 'superadmin',
        };
        setCurrentUser(superAdminUser);
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(superAdminUser));
        return { success: true, user: superAdminUser };
      }
    } catch {
      // ignore
    }

    throw new Error('Ghalat Username ya Password! Dobara koshish karein.');
  };

  // Logout function
  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
  };

  const isSuperAdmin = currentUser?.type === 'superadmin';
  const isAuthenticated = !!currentUser;
  const tenant = currentUser?.type === 'tenant' ? currentUser : null;
  const tenantId = tenant?.id || (isSuperAdmin ? 'superadmin' : null);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        isSuperAdmin,
        tenant,
        tenantId,
        loading,
        login,
        logout,
        getLocalTenants,
        saveLocalTenants,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
