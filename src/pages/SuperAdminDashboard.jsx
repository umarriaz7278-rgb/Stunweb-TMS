import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function SuperAdminDashboard() {
  const { logout, getLocalTenants, saveLocalTenants } = useAuth();
  const navigate = useNavigate();

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);

  // Form States
  const [formData, setFormData] = useState({
    company_name: '',
    owner_name: '',
    phone: '',
    email: '',
    username: '',
    password: '',
    plan_type: 'Standard',
    duration_months: 12,
    notes: '',
    is_active: true,
  });

  const [newPassword, setNewPassword] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Load Tenants
  const fetchTenants = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('saas_tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        setTenants(data);
        saveLocalTenants(data);
      } else {
        const local = getLocalTenants();
        setTenants(local);
      }
    } catch (err) {
      console.warn('Could not fetch from Supabase, loading local:', err);
      const local = getLocalTenants();
      setTenants(local);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  // Calculate Expiry from months
  const calculateExpiry = (months) => {
    const d = new Date();
    d.setMonth(d.getMonth() + parseInt(months || 12));
    return d.toISOString().split('T')[0];
  };

  // ─── Add Client ────────────────────────────────────────────────────────────
  const handleAddClient = async (e) => {
    e.preventDefault();
    if (!formData.company_name || !formData.username || !formData.password) {
      alert('Company Name, Username aur Password zaroori hain.');
      return;
    }

    const cleanUsername = formData.username.trim().toLowerCase();

    // Check duplicate
    if (tenants.some(t => t.username.toLowerCase() === cleanUsername)) {
      alert('Yeh Username pehle se kisi client ke paas hai! Doosra username muntakhib karein.');
      return;
    }

    const expires_at = calculateExpiry(formData.duration_months);

    const newTenant = {
      id: crypto.randomUUID ? crypto.randomUUID() : `tenant-${Date.now()}`,
      company_name: formData.company_name.trim(),
      owner_name: formData.owner_name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      username: cleanUsername,
      password_hash: formData.password.trim(),
      is_active: formData.is_active,
      expires_at: expires_at,
      plan_type: formData.plan_type,
      notes: formData.notes,
      created_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from('saas_tenants').insert([newTenant]);
      if (error) throw error;
    } catch (err) {
      console.warn('Saved client locally (DB offline):', err);
    }

    const updated = [newTenant, ...tenants];
    setTenants(updated);
    saveLocalTenants(updated);
    setShowAddModal(false);
    setFormData({
      company_name: '',
      owner_name: '',
      phone: '',
      email: '',
      username: '',
      password: '',
      plan_type: 'Standard',
      duration_months: 12,
      notes: '',
      is_active: true,
    });
    showToast(`✅ Client "${newTenant.company_name}" kamyabi se add ho gaya!`);
  };

  // ─── Toggle Client Active / Inactive (Service ON / OFF) ────────────────────
  const toggleClientStatus = async (tenant) => {
    const newStatus = !tenant.is_active;
    const updated = tenants.map(t => t.id === tenant.id ? { ...t, is_active: newStatus } : t);
    setTenants(updated);
    saveLocalTenants(updated);

    try {
      await supabase
        .from('saas_tenants')
        .update({ is_active: newStatus, updated_at: new Date().toISOString() })
        .eq('id', tenant.id);
    } catch (err) {
      console.warn('Error updating status in DB:', err);
    }

    showToast(newStatus ? `🟢 "${tenant.company_name}" ki service ON (Active) kar di gayi!` : `🔴 "${tenant.company_name}" ki service OFF (Suspended) kar di gayi!`);
  };

  // ─── Edit Client Details ───────────────────────────────────────────────────
  const handleEditClient = async (e) => {
    e.preventDefault();
    if (!selectedTenant) return;

    const updatedFields = {
      company_name: formData.company_name,
      owner_name: formData.owner_name,
      phone: formData.phone,
      email: formData.email,
      plan_type: formData.plan_type,
      expires_at: formData.expires_at,
      notes: formData.notes,
      updated_at: new Date().toISOString(),
    };

    const updated = tenants.map(t => t.id === selectedTenant.id ? { ...t, ...updatedFields } : t);
    setTenants(updated);
    saveLocalTenants(updated);

    try {
      await supabase.from('saas_tenants').update(updatedFields).eq('id', selectedTenant.id);
    } catch (err) {
      console.warn('Error saving edit to DB:', err);
    }

    setShowEditModal(false);
    setSelectedTenant(null);
    showToast(`✅ Client details update ho gayin!`);
  };

  // ─── Reset Password ────────────────────────────────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedTenant || !newPassword.trim()) {
      alert('Naya password dakhil karein.');
      return;
    }

    const pass = newPassword.trim();
    const updated = tenants.map(t => t.id === selectedTenant.id ? { ...t, password_hash: pass } : t);
    setTenants(updated);
    saveLocalTenants(updated);

    try {
      await supabase.from('saas_tenants').update({ password_hash: pass, updated_at: new Date().toISOString() }).eq('id', selectedTenant.id);
    } catch (err) {
      console.warn('Error resetting pass in DB:', err);
    }

    setShowPasswordModal(false);
    setSelectedTenant(null);
    setNewPassword('');
    showToast(`🔑 Password kamyabi se tabdeel ho gaya! Naya password: ${pass}`);
  };

  // ─── Delete Client ─────────────────────────────────────────────────────────
  const handleDeleteClient = async () => {
    if (!selectedTenant) return;

    const updated = tenants.filter(t => t.id !== selectedTenant.id);
    setTenants(updated);
    saveLocalTenants(updated);

    try {
      await supabase.from('saas_tenants').delete().eq('id', selectedTenant.id);
    } catch (err) {
      console.warn('Error deleting client in DB:', err);
    }

    setShowDeleteModal(false);
    setSelectedTenant(null);
    showToast(`🗑️ Client "${selectedTenant.company_name}" remove kar diya gaya.`);
  };

  // Quick Copy
  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper Auto Generate Password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$';
    let res = '';
    for (let i = 0; i < 8; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  // Stats
  const totalClients = tenants.length;
  const activeClients = tenants.filter(t => t.is_active).length;
  const suspendedClients = tenants.filter(t => !t.is_active).length;
  const expiringSoon = tenants.filter(t => {
    if (!t.expires_at) return false;
    const diffDays = Math.ceil((new Date(t.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  }).length;

  // Filtered List
  const filteredTenants = tenants.filter(t => {
    const matchesSearch =
      (t.company_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.owner_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.phone || '').includes(searchQuery);

    if (!matchesSearch) return false;
    if (statusFilter === 'active') return t.is_active;
    if (statusFilter === 'suspended') return !t.is_active;
    if (statusFilter === 'expired') {
      return t.expires_at && new Date(t.expires_at) < new Date();
    }
    return true;
  });

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary, #0f172a)',
      color: 'var(--text-primary, #f8fafc)',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '24px 32px',
    }}>
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          backgroundColor: '#10b981',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4)',
          fontWeight: 600,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.3s ease-in-out',
        }}>
          {toastMsg}
        </div>
      )}

      {/* Top Super Admin Navbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        paddingBottom: '20px',
        marginBottom: '28px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            fontSize: '32px',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            padding: '8px 12px',
          }}>
            👑
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.5px' }}>
              SaaS Super Admin Control Panel
            </h1>
            <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
              Goods Transport Management System — Multi-Tenant Master Manager
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              backgroundColor: 'rgba(255,255,255,0.08)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '13px',
              transition: 'all 0.2s ease',
            }}
          >
            🚛 Open Software View
          </button>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            🔒 Logout Master
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '28px',
      }}>
        <div style={{
          backgroundColor: 'rgba(30, 41, 59, 0.7)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '18px 20px',
        }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
            Total Registered Clients
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, marginTop: '8px', color: '#60a5fa' }}>
            {totalClients}
          </div>
        </div>

        <div style={{
          backgroundColor: 'rgba(30, 41, 59, 0.7)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '12px',
          padding: '18px 20px',
        }}>
          <div style={{ color: '#34d399', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
            🟢 Active Services (ON)
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, marginTop: '8px', color: '#10b981' }}>
            {activeClients}
          </div>
        </div>

        <div style={{
          backgroundColor: 'rgba(30, 41, 59, 0.7)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '12px',
          padding: '18px 20px',
        }}>
          <div style={{ color: '#f87171', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
            🔴 Suspended / OFF
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, marginTop: '8px', color: '#ef4444' }}>
            {suspendedClients}
          </div>
        </div>

        <div style={{
          backgroundColor: 'rgba(30, 41, 59, 0.7)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '12px',
          padding: '18px 20px',
        }}>
          <div style={{ color: '#fbbf24', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
            ⏳ Expiring in 30 Days
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, marginTop: '8px', color: '#f59e0b' }}>
            {expiringSoon}
          </div>
        </div>
      </div>

      {/* Main Control Table Card */}
      <div style={{
        backgroundColor: 'rgba(30, 41, 59, 0.6)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '14px',
        overflow: 'hidden',
      }}>
        {/* Table Toolbar */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
            <input
              type="text"
              placeholder="🔍 Search client by company, username, owner, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '10px 14px',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none',
              }}
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only (ON)</option>
              <option value="suspended">Suspended Only (OFF)</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <button
            onClick={() => {
              setFormData({
                company_name: '',
                owner_name: '',
                phone: '',
                email: '',
                username: '',
                password: generateRandomPassword(),
                plan_type: 'Standard',
                duration_months: 12,
                notes: '',
                is_active: true,
              });
              setShowAddModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 22px',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            }}
          >
            ➕ Add New Client
          </button>
        </div>

        {/* Table Content */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '13px',
          }}>
            <thead>
              <tr style={{
                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                color: 'rgba(255,255,255,0.6)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                <th style={{ padding: '14px 20px' }}>Company & Plan</th>
                <th style={{ padding: '14px 20px' }}>Owner & Contact</th>
                <th style={{ padding: '14px 20px' }}>Username & Password</th>
                <th style={{ padding: '14px 20px' }}>Service Status (ON/OFF)</th>
                <th style={{ padding: '14px 20px' }}>Expiry Date</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                    Loading clients...
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '50px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏢</div>
                    <div style={{ fontWeight: 600, fontSize: '15px' }}>Koi client nahi mila</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>Naya client add karne ke liye upar <b>"+ Add New Client"</b> button dabayein.</div>
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => {
                  const isExpired = tenant.expires_at && new Date(tenant.expires_at) < new Date();
                  return (
                    <tr
                      key={tenant.id}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        transition: 'background 0.2s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {/* Company & Plan */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#ffffff' }}>
                          {tenant.company_name}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            color: '#60a5fa',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                          }}>
                            {tenant.plan_type || 'Standard'}
                          </span>
                        </div>
                      </td>

                      {/* Owner & Contact */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ color: '#ffffff', fontWeight: 500 }}>
                          {tenant.owner_name || '—'}
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '2px' }}>
                          📞 {tenant.phone || '—'}
                        </div>
                      </td>

                      {/* Username & Password */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            color: '#93c5fd',
                          }}>
                            {tenant.username}
                          </span>
                          <button
                            onClick={() => copyToClipboard(tenant.username, `u-${tenant.id}`)}
                            title="Copy username"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '11px',
                              color: copiedId === `u-${tenant.id}` ? '#10b981' : 'rgba(255,255,255,0.4)',
                            }}
                          >
                            {copiedId === `u-${tenant.id}` ? '✓ Copied' : '📋'}
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            color: '#fbbf24',
                            fontSize: '12px',
                          }}>
                            {tenant.password_hash || tenant.password || '••••••••'}
                          </span>
                          <button
                            onClick={() => copyToClipboard(tenant.password_hash || tenant.password, `p-${tenant.id}`)}
                            title="Copy password"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '11px',
                              color: copiedId === `p-${tenant.id}` ? '#10b981' : 'rgba(255,255,255,0.4)',
                            }}
                          >
                            {copiedId === `p-${tenant.id}` ? '✓ Copied' : '📋'}
                          </button>
                        </div>
                      </td>

                      {/* Live ON/OFF Switch */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button
                            onClick={() => toggleClientStatus(tenant)}
                            style={{
                              position: 'relative',
                              width: '50px',
                              height: '26px',
                              borderRadius: '13px',
                              backgroundColor: tenant.is_active ? '#10b981' : '#475569',
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s',
                              padding: 0,
                            }}
                          >
                            <div style={{
                              position: 'absolute',
                              top: '3px',
                              left: tenant.is_active ? '27px' : '3px',
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              backgroundColor: '#ffffff',
                              transition: 'left 0.2s',
                            }} />
                          </button>
                          <span style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: tenant.is_active ? '#34d399' : '#f87171',
                          }}>
                            {tenant.is_active ? 'ON (Active)' : 'OFF (Suspended)'}
                          </span>
                        </div>
                      </td>

                      {/* Expiry Date */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ color: isExpired ? '#f87171' : '#ffffff', fontWeight: 500 }}>
                          {tenant.expires_at || 'Unlimited'}
                        </div>
                        {isExpired && (
                          <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, marginTop: '2px' }}>
                            ⚠️ Expired
                          </div>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            onClick={() => {
                              setSelectedTenant(tenant);
                              setFormData({
                                company_name: tenant.company_name,
                                owner_name: tenant.owner_name || '',
                                phone: tenant.phone || '',
                                email: tenant.email || '',
                                plan_type: tenant.plan_type || 'Standard',
                                expires_at: tenant.expires_at || '',
                                notes: tenant.notes || '',
                              });
                              setShowEditModal(true);
                            }}
                            title="Edit Client"
                            style={{
                              padding: '6px 10px',
                              backgroundColor: 'rgba(255,255,255,0.08)',
                              color: '#ffffff',
                              border: '1px solid rgba(255,255,255,0.15)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            ✏️ Edit
                          </button>

                          <button
                            onClick={() => {
                              setSelectedTenant(tenant);
                              setNewPassword(generateRandomPassword());
                              setShowPasswordModal(true);
                            }}
                            title="Reset Password"
                            style={{
                              padding: '6px 10px',
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              color: '#fbbf24',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            🔑 Pass
                          </button>

                          <button
                            onClick={() => {
                              setSelectedTenant(tenant);
                              setShowDeleteModal(true);
                            }}
                            title="Delete Client"
                            style={{
                              padding: '6px 10px',
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL: ADD CLIENT ────────────────────────────────────────────── */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '560px',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>
                ➕ Naya Client (Transport Company) Add Karein
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddClient}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
                    Company / Goods Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Al-Madina Goods Transport"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
                    Owner Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Haji Rashid Ahmed"
                    value={formData.owner_name}
                    onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    placeholder="0300-1234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
                    Plan Type
                  </label>
                  <select
                    value={formData.plan_type}
                    onChange={(e) => setFormData({ ...formData, plan_type: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="Basic">Basic Plan</option>
                    <option value="Standard">Standard Plan</option>
                    <option value="Premium">Premium Plan</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
              </div>

              <div style={{
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '14px',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#60a5fa', marginBottom: '8px' }}>
                  🔑 Client Login Credentials (Yahi client ko send karein)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
                      Login Username *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. almadina"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '6px',
                        color: '#93c5fd',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
                      Login Password *
                    </label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input
                        type="text"
                        required
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        style={{
                          flex: 1,
                          padding: '8px 10px',
                          backgroundColor: 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '6px',
                          color: '#fbbf24',
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          fontSize: '13px',
                          boxSizing: 'border-box',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, password: generateRandomPassword() })}
                        title="Generate random password"
                        style={{
                          padding: '8px 10px',
                          backgroundColor: 'rgba(255,255,255,0.1)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '6px',
                          color: '#ffffff',
                          cursor: 'pointer',
                        }}
                      >
                        🎲
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
                    Package Duration
                  </label>
                  <select
                    value={formData.duration_months}
                    onChange={(e) => setFormData({ ...formData, duration_months: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="1">1 Month (30 Days)</option>
                    <option value="3">3 Months</option>
                    <option value="6">6 Months</option>
                    <option value="12">1 Year (12 Months)</option>
                    <option value="36">3 Years</option>
                    <option value="120">Lifetime / 10 Years</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
                    Initial Service Status
                  </label>
                  <select
                    value={formData.is_active ? 'true' : 'false'}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="true">🟢 ON (Active Immediately)</option>
                    <option value="false">🔴 OFF (Keep Suspended)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '10px 18px',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 24px',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                  }}
                >
                  Save & Create Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: EDIT CLIENT ───────────────────────────────────────────── */}
      {showEditModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            padding: '28px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>
                ✏️ Edit Client Details
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditClient}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
                  Company Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
                    Owner Name
                  </label>
                  <input
                    type="text"
                    value={formData.owner_name}
                    onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
                    Plan Type
                  </label>
                  <select
                    value={formData.plan_type}
                    onChange={(e) => setFormData({ ...formData, plan_type: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="Basic">Basic</option>
                    <option value="Standard">Standard</option>
                    <option value="Premium">Premium</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  style={{
                    padding: '10px 18px',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 24px',
                    backgroundColor: '#3b82f6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                  }}
                >
                  Update Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: RESET PASSWORD ───────────────────────────────────────── */}
      {showPasswordModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '440px',
            padding: '24px',
          }}>
            <h2 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>
              🔑 Reset Password for "{selectedTenant?.company_name}"
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: '0 0 16px' }}>
              Username: <b style={{ color: '#60a5fa' }}>{selectedTenant?.username}</b>
            </p>

            <form onSubmit={handleResetPassword}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
                  Naya Password Dakhil Karein:
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      color: '#fbbf24',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setNewPassword(generateRandomPassword())}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    🎲
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 20px',
                    backgroundColor: '#f59e0b',
                    color: '#000000',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '13px',
                  }}
                >
                  Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: DELETE CLIENT ────────────────────────────────────────── */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '440px',
            padding: '24px',
          }}>
            <h2 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 700, color: '#ef4444' }}>
              ⚠️ Client Delete Confirmation
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', lineHeight: 1.5, margin: '0 0 20px' }}>
              Kya aap sach mein client <b>"{selectedTenant?.company_name}"</b> ({selectedTenant?.username}) ko delete karna chahte hain? Is client ka sara record remove ho jayega.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteClient}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                Yes, Delete Client
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
