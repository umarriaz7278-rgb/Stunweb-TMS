import React, { useState, useRef, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { Settings as SettingsIcon, Building, Image, RotateCcw, Save, CheckCircle, AlertCircle, Upload, Eye, GitBranch, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';


export default function Settings() {
  const {
    companyName: storedCompanyName,
    companySubtitle: storedCompanySubtitle,
    biltyHeaderUrl: storedBiltyHeaderUrl,
    challanHeaderUrl: storedChallanHeaderUrl,
    saveSettings,
    resetBiltyHeader,
    resetChallanHeader,
    resetAllSettings,
    DEFAULT_SETTINGS,
  } = useSettings();

  const [companyName, setCompanyName] = useState(storedCompanyName);
  const [companySubtitle, setCompanySubtitle] = useState(storedCompanySubtitle);

  const [biltyPreview, setBiltyPreview] = useState(storedBiltyHeaderUrl);
  const [challanPreview, setChallanPreview] = useState(storedChallanHeaderUrl);

  const [biltyFileString, setBiltyFileString] = useState(null);
  const [challanFileString, setChallanFileString] = useState(null);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // ── Branch Management State ──────────────────────────────────────────────────
  const LOCKED_BRANCHES = ['islamabad', 'karachi'];
  const [branches, setBranches] = useState([]);
  const [branchLoading, setBranchLoading] = useState(true);
  const [newBranchName, setNewBranchName] = useState('');
  const [branchSaving, setBranchSaving] = useState(false);
  const [branchMsg, setBranchMsg] = useState({ text: '', type: '' });

  const showBranchMsg = (text, type = 'success') => {
    setBranchMsg({ text, type });
    setTimeout(() => setBranchMsg({ text: '', type: '' }), 4000);
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    setBranchLoading(true);
    const { data, error } = await supabase.from('branches').select('*').order('name');
    if (error) console.error('Error loading branches:', error.message);
    if (data) setBranches(data);
    setBranchLoading(false);
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    const trimmedName = newBranchName.trim();
    if (!trimmedName) { showBranchMsg('Branch name required.', 'error'); return; }
    if (LOCKED_BRANCHES.includes(trimmedName.toLowerCase())) {
      showBranchMsg('This branch already exists as a built-in branch.', 'error'); return;
    }
    const exists = branches.some(b => b.name.toLowerCase() === trimmedName.toLowerCase());
    if (exists) { showBranchMsg('A branch with this name already exists.', 'error'); return; }
    setBranchSaving(true);
    const { error } = await supabase.from('branches').insert([{ name: trimmedName }]);
    setBranchSaving(false);
    if (error) { showBranchMsg('Error creating branch: ' + error.message, 'error'); }
    else {
      showBranchMsg(`Branch "${trimmedName}" created! Page will refresh to update sidebar.`, 'success');
      setNewBranchName('');
      fetchBranches();
      setTimeout(() => window.location.reload(), 2000);
    }
  };

  const handleDeleteBranch = async (branch) => {
    if (!window.confirm(`Delete "${branch.name}" branch?\n\nThis removes it from the sidebar and Bilty/Challan selection.\nExisting data in Supabase remains safe.`)) return;
    const { error } = await supabase.from('branches').delete().eq('id', branch.id);
    if (error) { showBranchMsg('Error deleting branch: ' + error.message, 'error'); }
    else {
      showBranchMsg(`Branch "${branch.name}" deleted. Page will refresh.`, 'success');
      fetchBranches();
      setTimeout(() => window.location.reload(), 2000);
    }
  };

  const biltyInputRef = useRef(null);
  const challanInputRef = useRef(null);

  const showNotification = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  // Convert uploaded image to optimized Base64
  const handleImageUpload = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showNotification('Please select a valid image file (PNG, JPG, WebP)', 'error');
      return;
    }

    // Limit size to 4MB before conversion
    if (file.size > 4 * 1024 * 1024) {
      showNotification('Image size should be less than 4MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result;
      if (type === 'bilty') {
        setBiltyPreview(base64);
        setBiltyFileString(base64);
      } else if (type === 'challan') {
        setChallanPreview(base64);
        setChallanFileString(base64);
      }
      showNotification(`${type === 'bilty' ? 'Bilty' : 'Challan'} header image selected. Click 'Save' to apply.`, 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCompanyProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveSettings({
        companyName: companyName.trim() || DEFAULT_SETTINGS.companyName,
        companySubtitle: companySubtitle.trim() || DEFAULT_SETTINGS.companySubtitle,
      });
      showNotification('Company Name and Subtitle updated successfully!', 'success');
    } catch (err) {
      showNotification('Failed to update company settings: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBiltyHeader = async () => {
    if (!biltyFileString && biltyPreview === storedBiltyHeaderUrl) {
      showNotification('No changes made to Bilty header.', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveSettings({ biltyHeaderUrl: biltyPreview });
      setBiltyFileString(null);
      showNotification('Bilty Header image updated successfully!', 'success');
    } catch (err) {
      showNotification('Failed to save Bilty header: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChallanHeader = async () => {
    if (!challanFileString && challanPreview === storedChallanHeaderUrl) {
      showNotification('No changes made to Challan header.', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveSettings({ challanHeaderUrl: challanPreview });
      setChallanFileString(null);
      showNotification('Challan Header image updated successfully!', 'success');
    } catch (err) {
      showNotification('Failed to save Challan header: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetBilty = async () => {
    if (window.confirm('Are you sure you want to reset Bilty header to default?')) {
      await resetBiltyHeader();
      setBiltyPreview(DEFAULT_SETTINGS.biltyHeaderUrl);
      setBiltyFileString(null);
      showNotification('Bilty header reset to default.', 'success');
    }
  };

  const handleResetChallan = async () => {
    if (window.confirm('Are you sure you want to reset Challan header to default?')) {
      await resetChallanHeader();
      setChallanPreview(DEFAULT_SETTINGS.challanHeaderUrl);
      setChallanFileString(null);
      showNotification('Challan header reset to default.', 'success');
    }
  };

  const handleResetAll = async () => {
    if (window.confirm('Are you sure you want to reset all settings to system defaults?')) {
      await resetAllSettings();
      setCompanyName(DEFAULT_SETTINGS.companyName);
      setCompanySubtitle(DEFAULT_SETTINGS.companySubtitle);
      setBiltyPreview(DEFAULT_SETTINGS.biltyHeaderUrl);
      setChallanPreview(DEFAULT_SETTINGS.challanHeaderUrl);
      setBiltyFileString(null);
      setChallanFileString(null);
      showNotification('All settings have been restored to defaults.', 'success');
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SettingsIcon size={28} color="#2563eb" />
          </div>
          <div>
            <h1 className="page-title" style={{ margin: 0, color: '#1e40af', fontWeight: 800, fontSize: '1.6rem' }}>
              System Settings (سیٹنگز)
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
              Customize company name, logos, and printable headers for Bilty and Challan.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetAll}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 16px', border: '1.5px solid #cbd5e1' }}
        >
          <RotateCcw size={16} color="#64748b" />
          Reset All Defaults
        </button>
      </div>

      {/* Notification Banner */}
      {message.text && (
        <div
          style={{
            padding: '12px 18px',
            marginBottom: '20px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: message.type === 'error' ? '#fee2e2' : '#d1fae5',
            color: message.type === 'error' ? '#991b1b' : '#065f46',
            border: `1.5px solid ${message.type === 'error' ? '#fca5a5' : '#86efac'}`,
            fontWeight: 600,
          }}
        >
          {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* ─── SECTION 1: Company Profile ─── */}
      <div className="card" style={{ marginBottom: '24px', borderTop: '4px solid #2563eb', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Building size={22} color="#2563eb" />
          <h2 style={{ margin: 0, color: '#1e40af', fontSize: '1.25rem', fontWeight: 800 }}>
            1. Software Owner / Company Profile
          </h2>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '18px' }}>
          This company name appears on the sidebar, header bar, and system reports.
        </p>

        <form onSubmit={handleSaveCompanyProfile}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1e40af', marginBottom: '6px' }}>
                Company Name (کمپنی کا نام) *
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. ABID MEHMOOD"
                required
                style={{
                  width: '100%',
                  height: '46px',
                  padding: '10px 14px',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                  border: '1.5px solid #93c5fd',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1e40af', marginBottom: '6px' }}>
                Company Subtitle / Tagline
              </label>
              <input
                type="text"
                value={companySubtitle}
                onChange={(e) => setCompanySubtitle(e.target.value)}
                placeholder="e.g. Goods Transport System"
                style={{
                  width: '100%',
                  height: '46px',
                  padding: '10px 14px',
                  fontSize: '1rem',
                  borderRadius: '8px',
                  border: '1.5px solid #93c5fd',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 24px',
                fontSize: '0.95rem',
                fontWeight: 700,
                borderRadius: '8px',
              }}
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Company Details'}
            </button>
          </div>
        </form>
      </div>

      {/* ─── SECTION 2: Bilty Booking Print Header ─── */}
      <div className="card" style={{ marginBottom: '24px', borderTop: '4px solid #059669', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Image size={22} color="#059669" />
            <h2 style={{ margin: 0, color: '#065f46', fontSize: '1.25rem', fontWeight: 800 }}>
              2. Bilty Booking Print Header (بلٹی پرنٹ ہیڈر)
            </h2>
          </div>
          <span style={{ fontSize: '0.8rem', background: '#d1fae5', color: '#065f46', padding: '4px 10px', borderRadius: '20px', fontWeight: 700 }}>
            Applies to Bilty Print (Customer & Office Copy)
          </span>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Eye size={15} /> Header Image Live Preview:
            </span>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Recommended Size: <strong>1000px × 140px</strong> (PNG / JPG)
            </span>
          </div>

          <div style={{ border: '2px dashed #cbd5e1', borderRadius: '6px', background: '#ffffff', padding: '10px', textAlign: 'center', minHeight: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {biltyPreview ? (
              <img
                src={biltyPreview}
                alt="Bilty Header Preview"
                style={{ maxWidth: '100%', maxHeight: '130px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No header image loaded</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <input
              type="file"
              ref={biltyInputRef}
              accept="image/png, image/jpeg, image/jpg, image/webp"
              style={{ display: 'none' }}
              onChange={(e) => handleImageUpload(e, 'bilty')}
            />
            <button
              type="button"
              onClick={() => biltyInputRef.current?.click()}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 700, borderRadius: '8px', border: '1.5px solid #059669', color: '#065f46' }}
            >
              <Upload size={17} />
              Upload New Bilty Header (PNG / JPG)
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleResetBilty}
              className="btn btn-secondary"
              style={{ padding: '10px 16px', fontSize: '0.88rem', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RotateCcw size={15} /> Reset Default
            </button>

            <button
              type="button"
              onClick={handleSaveBiltyHeader}
              disabled={saving}
              className="btn btn-primary"
              style={{ padding: '10px 22px', fontSize: '0.92rem', fontWeight: 700, backgroundColor: '#059669', borderColor: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Save size={17} /> Save Bilty Header
            </button>
          </div>
        </div>
      </div>

      {/* ─── SECTION 3: Challan Management Print Header ─── */}
      <div className="card" style={{ marginBottom: '24px', borderTop: '4px solid #d97706', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Image size={22} color="#d97706" />
            <h2 style={{ margin: 0, color: '#b45309', fontSize: '1.25rem', fontWeight: 800 }}>
              3. Challan Management Print Header (چالان پرنٹ ہیڈر)
            </h2>
          </div>
          <span style={{ fontSize: '0.8rem', background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: '20px', fontWeight: 700 }}>
            Applies to Challan Print Document
          </span>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Eye size={15} /> Header Image Live Preview:
            </span>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Recommended Size: <strong>1100px × 150px</strong> (PNG / JPG)
            </span>
          </div>

          <div style={{ border: '2px dashed #cbd5e1', borderRadius: '6px', background: '#ffffff', padding: '10px', textAlign: 'center', minHeight: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {challanPreview ? (
              <img
                src={challanPreview}
                alt="Challan Header Preview"
                style={{ maxWidth: '100%', maxHeight: '130px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No header image loaded</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <input
              type="file"
              ref={challanInputRef}
              accept="image/png, image/jpeg, image/jpg, image/webp"
              style={{ display: 'none' }}
              onChange={(e) => handleImageUpload(e, 'challan')}
            />
            <button
              type="button"
              onClick={() => challanInputRef.current?.click()}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 700, borderRadius: '8px', border: '1.5px solid #d97706', color: '#b45309' }}
            >
              <Upload size={17} />
              Upload New Challan Header (PNG / JPG)
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleResetChallan}
              className="btn btn-secondary"
              style={{ padding: '10px 16px', fontSize: '0.88rem', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RotateCcw size={15} /> Reset Default
            </button>

            <button
              type="button"
              onClick={handleSaveChallanHeader}
              disabled={saving}
              className="btn btn-primary"
              style={{ padding: '10px 22px', fontSize: '0.92rem', fontWeight: 700, backgroundColor: '#d97706', borderColor: '#d97706', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Save size={17} /> Save Challan Header
            </button>
          </div>
        </div>
      </div>

      {/* ─── SECTION 4: Branch Management ─── */}
      <div className="card" style={{ marginBottom: '24px', borderTop: '4px solid #7c3aed', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <GitBranch size={22} color="#7c3aed" />
          <h2 style={{ margin: 0, color: '#5b21b6', fontSize: '1.25rem', fontWeight: 800 }}>
            4. Branch Management (برانچ مینجمنٹ)
          </h2>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '18px' }}>
          Create new branches or delete custom branches.
          When a new branch is created, it automatically gets its own sub-pages (Overview, Finance, Account Statement, Delivery Report, A/C Receivable, Broker A/C).
        </p>

        {/* Branch notification */}
        {branchMsg.text && (
          <div style={{ padding: '12px 18px', marginBottom: '16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px',
            backgroundColor: branchMsg.type === 'error' ? '#fee2e2' : '#d1fae5',
            color: branchMsg.type === 'error' ? '#991b1b' : '#065f46',
            border: `1.5px solid ${branchMsg.type === 'error' ? '#fca5a5' : '#86efac'}`, fontWeight: 600 }}>
            {branchMsg.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            <span>{branchMsg.text}</span>
          </div>
        )}

        {/* Create new branch form */}
        <form onSubmit={handleCreateBranch} style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#5b21b6', marginBottom: '6px' }}>
              New Branch Name (نئی برانچ کا نام) *
            </label>
            <input
              type="text"
              value={newBranchName}
              onChange={e => setNewBranchName(e.target.value)}
              placeholder="e.g. Abbottabad, Peshawar, Quetta..."
              required
              style={{ width: '100%', height: '46px', padding: '10px 14px', fontSize: '1rem', fontWeight: 600, borderRadius: '8px', border: '1.5px solid #c4b5fd', boxSizing: 'border-box' }}
            />
          </div>
          <button
            type="submit"
            disabled={branchSaving}
            style={{ height: '46px', padding: '0 24px', fontSize: '0.95rem', fontWeight: 700, borderRadius: '8px', border: 'none', cursor: 'pointer', background: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
            <Plus size={18} />
            {branchSaving ? 'Creating...' : 'Create Branch'}
          </button>
        </form>

        {/* Branches list */}
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 700, color: '#374151' }}>All Branches:</h3>
          {branchLoading ? (
            <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>Loading branches...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {branches.map(branch => {
                const isLocked = LOCKED_BRANCHES.includes(branch.name.toLowerCase());
                return (
                  <div key={branch.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '8px', border: `1.5px solid ${isLocked ? '#e5e7eb' : '#c4b5fd'}`, background: isLocked ? '#f9fafb' : '#f5f3ff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.1rem' }}>{isLocked ? '🏛️' : '🏢'}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: isLocked ? '#374151' : '#5b21b6' }}>{branch.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {isLocked ? 'Built-in Branch (cannot delete)' : 'Custom Branch'}
                        </div>
                      </div>
                    </div>
                    {!isLocked && (
                      <button
                        onClick={() => handleDeleteBranch(branch)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '0.82rem', fontWeight: 700, border: '1.5px solid #ef4444', borderRadius: '8px', cursor: 'pointer', background: '#fff', color: '#ef4444' }}>
                        <Trash2 size={14} /> Delete
                      </button>
                    )}
                    {isLocked && (
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', background: '#e5e7eb', padding: '4px 10px', borderRadius: '6px' }}>
                        🔒 Protected
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Guide Card */}
      <div className="card" style={{ background: '#f8fafc', borderLeft: '4px solid #3b82f6', padding: '18px 24px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: '#1e40af', fontWeight: 700 }}>

          💡 Header Design Guide (ہیڈر ڈیزائن ہدایات)
        </h3>
        <ul style={{ margin: 0, paddingLeft: '20px', color: '#475569', fontSize: '0.88rem', lineHeight: 1.6 }}>
          <li>
            <strong>Bilty Header:</strong> Image should include your Company Name, Registered Office Address, Phone Numbers, and Logo. Aspect ratio of <strong>6:1 or 7:1</strong> is ideal.
          </li>
          <li>
            <strong>Challan Header:</strong> Full width banner designed for A4 landscape/portrait print. Recommended resolution is <strong>1100px × 150px</strong>.
          </li>
          <li>
            <strong>File Formats:</strong> High-resolution PNG or JPG with transparent or white background is recommended.
          </li>
        </ul>
      </div>
    </div>
  );
}
