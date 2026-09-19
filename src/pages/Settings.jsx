import React, { useState, useRef, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { 
  Settings as SettingsIcon, Building, Image, RotateCcw, Save, 
  CheckCircle, AlertCircle, Upload, Eye, GitBranch, Plus, Trash2,
  Download, Database, ShieldCheck, FileUp, HardDrive, RefreshCw
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { getTenantItem, setTenantItem } from '../utils/tenantStorage';

export default function Settings() {
  const {
    companyName: storedCompanyName,
    companySubtitle: storedCompanySubtitle,
    primaryBranchName: storedPrimaryBranchName,
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
  const [primaryBranchName, setPrimaryBranchName] = useState(storedPrimaryBranchName || 'Islamabad');

  const [biltyPreview, setBiltyPreview] = useState(storedBiltyHeaderUrl);
  const [challanPreview, setChallanPreview] = useState(storedChallanHeaderUrl);

  const [biltyFileString, setBiltyFileString] = useState(null);
  const [challanFileString, setChallanFileString] = useState(null);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // ── Branch Management State (100% Client-Isolated) ───────────────────────────
  const [branches, setBranches] = useState([]);
  const [branchLoading, setBranchLoading] = useState(true);
  const [newBranchName, setNewBranchName] = useState('');
  const [branchSaving, setBranchSaving] = useState(false);
  const [branchMsg, setBranchMsg] = useState({ text: '', type: '' });

  const showBranchMsg = (text, type = 'success') => {
    setBranchMsg({ text, type });
    setTimeout(() => setBranchMsg({ text: '', type: '' }), 4000);
  };

  const fetchBranches = () => {
    setBranchLoading(true);
    const primName = (primaryBranchName || storedPrimaryBranchName || 'Islamabad').trim();
    const custom = getTenantItem('custom_branches', []) || [];
    
    // Built-in protected branches for this specific client
    const builtInList = [
      { id: 'built-in-primary', name: primName, isLocked: true },
      { id: 'built-in-karachi', name: 'Karachi', isLocked: true }
    ];

    const customList = (custom || []).map(b => ({
      id: b.id || ('br_' + b.name),
      name: b.name,
      isLocked: false
    }));

    setBranches([...builtInList, ...customList]);
    setBranchLoading(false);
  };

  useEffect(() => {
    fetchBranches();
  }, [primaryBranchName, storedPrimaryBranchName]);

  const handleCreateBranch = (e) => {
    e.preventDefault();
    const trimmedName = newBranchName.trim();
    if (!trimmedName) { showBranchMsg('Branch name required.', 'error'); return; }
    
    const primName = (primaryBranchName || storedPrimaryBranchName || 'Islamabad').trim().toLowerCase();
    if (trimmedName.toLowerCase() === 'karachi' || trimmedName.toLowerCase() === primName) {
      showBranchMsg('This branch already exists as a built-in branch.', 'error'); 
      return;
    }

    const existingCustom = getTenantItem('custom_branches', []) || [];
    const exists = existingCustom.some(b => (b.name || '').trim().toLowerCase() === trimmedName.toLowerCase());
    if (exists) { 
      showBranchMsg('A branch with this name already exists in your system.', 'error'); 
      return; 
    }

    setBranchSaving(true);
    const newBranch = {
      id: 'br_' + Date.now(),
      name: trimmedName,
      created_at: new Date().toISOString()
    };
    const updated = [...existingCustom, newBranch];
    setTenantItem('custom_branches', updated);
    setBranchSaving(false);
    showBranchMsg(`Branch "${trimmedName}" created successfully!`, 'success');
    setNewBranchName('');
    fetchBranches();
    window.dispatchEvent(new Event('tenant_branches_updated'));
  };

  const handleDeleteBranch = (branch) => {
    if (!window.confirm(`Delete "${branch.name}" branch?\n\nThis removes it from your sidebar and Bilty/Challan selection.`)) return;
    
    const existingCustom = getTenantItem('custom_branches', []) || [];
    const updated = existingCustom.filter(b => b.name.toLowerCase() !== branch.name.toLowerCase() && b.id !== branch.id);
    setTenantItem('custom_branches', updated);
    showBranchMsg(`Branch "${branch.name}" deleted.`, 'success');
    fetchBranches();
    window.dispatchEvent(new Event('tenant_branches_updated'));
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

  const handleSavePrimaryBranch = async (e) => {
    e.preventDefault();
    const cleanName = primaryBranchName.trim();
    if (!cleanName) {
      showNotification('Branch name cannot be empty.', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveSettings({
        primaryBranchName: cleanName,
      });
      // Also update/sync in Supabase branches table
      try {
        const { data: allBranches } = await supabase.from('branches').select('*');
        if (allBranches && allBranches.length > 0) {
          const oldPrimary = (storedPrimaryBranchName || '').trim().toLowerCase();
          const match = allBranches.find(b => 
            b.name.toLowerCase() === oldPrimary || 
            b.name.toLowerCase() === 'islamabad'
          );
          if (match) {
            await supabase.from('branches').update({ name: cleanName }).eq('id', match.id);
          } else {
            const exists = allBranches.some(b => b.name.toLowerCase() === cleanName.toLowerCase());
            if (!exists) {
              await supabase.from('branches').insert([{ name: cleanName }]);
            }
          }
        }
      } catch (err) {
        console.warn('Could not sync branch name to branches table:', err);
      }
      showNotification(`Main Branch renamed to "${cleanName}"! Sidebar, reports, bilty and challan updated.`, 'success');
      fetchBranches();
    } catch (err) {
      showNotification('Failed to update branch name: ' + err.message, 'error');
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

  // ── Backup & Restore State & Handlers ────────────────────────────────────────
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState({ text: '', type: '' });
  const restoreFileInputRef = useRef(null);

  const showBackupMsg = (text, type = 'success') => {
    setBackupMsg({ text, type });
    setTimeout(() => setBackupMsg({ text: '', type: '' }), 6000);
  };

  const handleExportBackup = async () => {
    setBackupLoading(true);
    try {
      // 1. Fetch Supabase Data
      const [
        { data: bilties },
        { data: challans },
        { data: challanBilties },
        { data: deliveries },
        { data: ledgers },
        { data: branchList }
      ] = await Promise.all([
        supabase.from('bilties').select('*'),
        supabase.from('challans').select('*'),
        supabase.from('challan_bilties').select('*'),
        supabase.from('deliveries').select('*'),
        supabase.from('branch_ledgers').select('*'),
        supabase.from('branches').select('*')
      ]);

      // 2. Fetch all localStorage data
      const localStoreDump = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          try {
            const val = localStorage.getItem(key);
            localStoreDump[key] = val;
          } catch (e) {}
        }
      }

      // 3. Compile Master Backup Object
      const backupPackage = {
        tms_backup_meta: {
          app_name: 'Goods Transport Management System (TMS SaaS)',
          version: '2.0',
          created_at: new Date().toISOString(),
          date_formatted: new Date().toLocaleString('en-PK'),
          company_name: companyName || storedCompanyName || 'Client Company',
          company_subtitle: companySubtitle || storedCompanySubtitle,
          primary_branch: primaryBranchName || storedPrimaryBranchName,
          summary: {
            bilties_count: bilties?.length || 0,
            challans_count: challans?.length || 0,
            deliveries_count: deliveries?.length || 0,
            ledgers_count: ledgers?.length || 0,
            branches_count: branchList?.length || 0,
            local_keys_count: Object.keys(localStoreDump).length
          }
        },
        supabase_data: {
          bilties: bilties || [],
          challans: challans || [],
          challan_bilties: challanBilties || [],
          deliveries: deliveries || [],
          branch_ledgers: ledgers || [],
          branches: branchList || []
        },
        local_storage_data: localStoreDump
      };

      // 4. Download file
      const jsonStr = JSON.stringify(backupPackage, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const cleanComp = (companyName || storedCompanyName || 'TMS').replace(/[^a-zA-Z0-9_-]/g, '_');
      const dateTag = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `${cleanComp}_Full_Backup_${dateTag}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showBackupMsg(`Full backup downloaded successfully! (${backupPackage.tms_backup_meta.summary.bilties_count} Bilties, ${backupPackage.tms_backup_meta.summary.challans_count} Challans, ${backupPackage.tms_backup_meta.summary.ledgers_count} Ledgers, ${backupPackage.tms_backup_meta.summary.deliveries_count} Deliveries).`, 'success');
    } catch (err) {
      console.error('Backup generation error:', err);
      showBackupMsg(`Failed to generate backup: ${err.message || err}`, 'error');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setRestoreLoading(true);
        const raw = event.target?.result;
        if (!raw) throw new Error('File is empty.');
        
        const backup = JSON.parse(raw);
        if (!backup.tms_backup_meta && !backup.supabase_data && !backup.local_storage_data) {
          throw new Error('Invalid backup file format. This is not a recognized TMS backup file.');
        }

        const meta = backup.tms_backup_meta || {};
        const sum = meta.summary || {};
        const conf = window.confirm(
          `Confirm System Restoration (ڈیٹا بحالی کی تصدیق):\n\n` +
          `Company: ${meta.company_name || 'N/A'}\n` +
          `Backup Date: ${meta.date_formatted || meta.created_at || 'Unknown'}\n` +
          `Bilties: ${sum.bilties_count || backup.supabase_data?.bilties?.length || 0}\n` +
          `Challans: ${sum.challans_count || backup.supabase_data?.challans?.length || 0}\n` +
          `Ledgers: ${sum.ledgers_count || backup.supabase_data?.branch_ledgers?.length || 0}\n\n` +
          `Warning: Restoring will merge and recover this backup into your current system.\nDo you wish to proceed?`
        );

        if (!conf) {
          setRestoreLoading(false);
          if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
          return;
        }

        // 1. Restore localStorage items
        if (backup.local_storage_data && typeof backup.local_storage_data === 'object') {
          Object.entries(backup.local_storage_data).forEach(([k, v]) => {
            if (typeof v === 'string') {
              localStorage.setItem(k, v);
            } else {
              localStorage.setItem(k, JSON.stringify(v));
            }
          });
        }

        // 2. Restore Supabase Records (with upsert)
        const sbData = backup.supabase_data || {};
        
        if (sbData.branches && sbData.branches.length > 0) {
          await supabase.from('branches').upsert(sbData.branches, { onConflict: 'id', ignoreDuplicates: true });
        }
        if (sbData.bilties && sbData.bilties.length > 0) {
          await supabase.from('bilties').upsert(sbData.bilties, { onConflict: 'id', ignoreDuplicates: false });
        }
        if (sbData.challans && sbData.challans.length > 0) {
          await supabase.from('challans').upsert(sbData.challans, { onConflict: 'id', ignoreDuplicates: false });
        }
        if (sbData.challan_bilties && sbData.challan_bilties.length > 0) {
          await supabase.from('challan_bilties').upsert(sbData.challan_bilties, { onConflict: 'id', ignoreDuplicates: false });
        }
        if (sbData.deliveries && sbData.deliveries.length > 0) {
          await supabase.from('deliveries').upsert(sbData.deliveries, { onConflict: 'id', ignoreDuplicates: false });
        }
        if (sbData.branch_ledgers && sbData.branch_ledgers.length > 0) {
          await supabase.from('branch_ledgers').upsert(sbData.branch_ledgers, { onConflict: 'id', ignoreDuplicates: false });
        }

        showBackupMsg('System successfully restored from backup! The page will now reload...', 'success');
        setTimeout(() => {
          window.location.reload();
        }, 1800);

      } catch (err) {
        console.error('Restore error:', err);
        showBackupMsg(`Restoration failed: ${err.message || err}`, 'error');
        setRestoreLoading(false);
      } finally {
        if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
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

      {/* ─── SECTION 2: Primary Branch Settings (Rename Islamabad Branch) ─── */}
      <div className="card" style={{ marginBottom: '24px', borderTop: '4px solid #7c3aed', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <GitBranch size={22} color="#7c3aed" />
          <h2 style={{ margin: 0, color: '#5b21b6', fontSize: '1.25rem', fontWeight: 800 }}>
            2. Main / Destination Branch Rename (مین برانچ کا نام)
          </h2>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '18px', lineHeight: 1.5 }}>
          Yahan se aap default <b>Islamabad Branch</b> ka naam tabdeel karke koi bhi doosra shahar (e.g. <b>Lahore, Peshawar, Faisalabad, Multan, Quetta</b>) rakh sakte hain. Is se sidebar ke tamam sub-pages, delivery reports, A/C receivables, broker accounts, bilty destinations aur challan dispatch me yeh naya naam khud-ba-khud active ho jayega.
        </p>

        <form onSubmit={handleSavePrimaryBranch}>
          <div style={{ maxWidth: '480px', marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#5b21b6', marginBottom: '6px' }}>
              Primary Branch Name (مین برانچ کا نام) *
            </label>
            <input
              type="text"
              value={primaryBranchName}
              onChange={(e) => setPrimaryBranchName(e.target.value)}
              placeholder="e.g. Lahore ya Islamabad ya Peshawar"
              required
              style={{
                width: '100%',
                height: '46px',
                padding: '10px 14px',
                fontSize: '1.05rem',
                fontWeight: 700,
                borderRadius: '8px',
                border: '1.5px solid #c4b5fd',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
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
                backgroundColor: '#7c3aed',
                borderColor: '#6d28d9',
              }}
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save & Update Branch Name (نام تبدیل کریں)'}
            </button>
          </div>
        </form>
      </div>

      {/* ─── SECTION 3: Bilty Booking Print Header ─── */}
      <div className="card" style={{ marginBottom: '24px', borderTop: '4px solid #059669', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Image size={22} color="#059669" />
            <h2 style={{ margin: 0, color: '#065f46', fontSize: '1.25rem', fontWeight: 800 }}>
              3. Bilty Booking Print Header (بلٹی پرنٹ ہیڈر)
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

      {/* ─── SECTION 5: Data Backup & Disaster Recovery Center ─── */}
      <div className="card" style={{ marginBottom: '24px', borderTop: '4px solid #059669', padding: '24px', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(5, 150, 105, 0.1)', color: '#059669' }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, color: '#065f46', fontSize: '1.25rem', fontWeight: 800 }}>
                5. Data Backup & Restore Center (ڈیٹا بیک اپ اور بحالی)
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '3px 0 0 0' }}>
                Secure your complete system data daily. Download full backups or restore previously saved records anytime.
              </p>
            </div>
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '4px 12px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
            🔒 Client-Isolated Security
          </span>
        </div>

        {/* Backup message banner */}
        {backupMsg.text && (
          <div style={{
            padding: '12px 18px',
            marginBottom: '16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: backupMsg.type === 'error' ? '#fee2e2' : '#d1fae5',
            color: backupMsg.type === 'error' ? '#991b1b' : '#065f46',
            border: `1.5px solid ${backupMsg.type === 'error' ? '#fca5a5' : '#86efac'}`,
            fontWeight: 600,
            fontSize: '0.9rem'
          }}>
            {backupMsg.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            <span>{backupMsg.text}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '20px' }}>
          
          {/* Box 1: Download Backup */}
          <div style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            border: '1.5px solid #86efac',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#166534' }}>
                <HardDrive size={20} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                  📥 Download Daily Backup
                </h3>
              </div>
              <p style={{ color: '#15803d', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '14px' }}>
                Save a complete copy of all Bilties, Challans, Handover deliveries, Accounts, Ledgers, and Dispatching inventory directly to your device.
              </p>
              <div style={{ fontSize: '0.78rem', color: '#166534', background: 'rgba(255,255,255,0.7)', padding: '8px 12px', borderRadius: '6px', marginBottom: '16px' }}>
                ✅ <strong>روزانہ کی محفوظ عادت:</strong> ہر روز کام ختم کرنے پر بیک اپ ڈاؤن لوڈ کر کے اپنے پاس یو ایس بی (USB) یا محفوظ فولڈر میں رکھیں۔
              </div>
            </div>

            <button
              type="button"
              disabled={backupLoading || restoreLoading}
              onClick={handleExportBackup}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '12px 18px',
                fontSize: '0.95rem',
                fontWeight: 800,
                color: '#fff',
                backgroundColor: '#059669',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
                opacity: backupLoading ? 0.7 : 1
              }}
            >
              {backupLoading ? <RefreshCw size={18} className="spin" /> : <Download size={18} />}
              {backupLoading ? 'Generating Backup...' : 'Download Full Backup (.json)'}
            </button>
          </div>

          {/* Box 2: Restore Backup */}
          <div style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            border: '1.5px solid #93c5fd',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#1e40af' }}>
                <FileUp size={20} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                  📤 Restore System from Backup
                </h3>
              </div>
              <p style={{ color: '#1d4ed8', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '14px' }}>
                If you ever change your computer or need to recover lost data, select your backup JSON file here to restore all business records immediately.
              </p>
              <div style={{ fontSize: '0.78rem', color: '#1e40af', background: 'rgba(255,255,255,0.7)', padding: '8px 12px', borderRadius: '6px', marginBottom: '16px' }}>
                ⚡ <strong>خودکار بحالی:</strong> فائل منتخب کرتے ہی سسٹم ڈیٹا کو جانچے گا اور سارا ریکارڈ خودکار طور پر بحال کر دے گا۔
              </div>
            </div>

            <div>
              <input
                ref={restoreFileInputRef}
                type="file"
                accept=".json,.tmsbak"
                onChange={handleImportBackup}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                disabled={backupLoading || restoreLoading}
                onClick={() => restoreFileInputRef.current?.click()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '12px 18px',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  color: '#fff',
                  backgroundColor: '#2563eb',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                  opacity: restoreLoading ? 0.7 : 1
                }}
              >
                {restoreLoading ? <RefreshCw size={18} className="spin" /> : <Upload size={18} />}
                {restoreLoading ? 'Restoring Records...' : 'Upload & Restore Backup File'}
              </button>
            </div>
          </div>

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
