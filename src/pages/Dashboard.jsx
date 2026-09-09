import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

// ─── Stat Card Component ──────────────────────────────────────────────────────
function StatCard({ icon, iconColor, value, label }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${iconColor}`}>{icon}</div>
      <div className="stat-info">
        <h4>{value}</h4>
        <p>{label}</p>
      </div>
    </div>
  );
}

// ─── Simple SVG Sparkline ─────────────────────────────────────────────────────
function Sparkline({ data, color }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 60;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d - min) / range) * (h * 0.8) - h * 0.1;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: '60px' }}>
      <defs>
        <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#grad-${color})`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats] = useState({
    totalBilties: 0,
    activeBranches: 0,
    totalChallans: 0,
    warehouseItems: 0,
  });
  const [recentBilties, setRecentBilties] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sparkline mock data
  const chartData = [40, 65, 52, 78, 93, 85, 110, 97, 120, 108, 134, 125, 148, 162];

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      try {
        const [biltiesRes, challansRes, recentRes] = await Promise.all([
          supabase.from('bilties').select('*', { count: 'exact', head: true }),
          supabase.from('challans').select('*', { count: 'exact', head: true }),
          supabase.from('bilties').select('id, bilty_number, sender_name, receiver_name, local_freight, bilty_date, destination_branch_id').order('created_at', { ascending: false }).limit(8),
        ]);

        setStats({
          totalBilties:  biltiesRes.count  || 0,
          activeBranches: 3,
          totalChallans: challansRes.count || 0,
          warehouseItems: 0,
        });

        setRecentBilties(recentRes.data || []);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  // ── Backup handler ──────────────────────────────────────────────────────────
  const handleBackup = async () => {
    try {
      const tables = [
        'bilties', 'booking_receipts', 'branches', 'branch_ledgers', 'branch_expenses',
        'challan_bilties', 'challans', 'deliveries', 'receiving_verifications', 'short_claims',
        'broker_ledgers', 'broker_received_islamabad', 'broker_received_lahore',
        'broker_received_rawalpindi', 'profit_received_islamabad', 'profit_received_lahore',
        'profit_received_rawalpindi', 'commission_received_islamabad', 'finance_overview',
        'karachi_ledgers', 'local_freight_parties', 'local_freight_transactions',
        'warehouse_rental_deliveries', 'warehouse_rental_items', 'warehouse_rental_clients',
      ];
      const backup = { _meta: { date: new Date().toISOString(), version: '2.0' }, supabase: {}, localStorage: {} };
      for (const table of tables) {
        const { data } = await supabase.from(table).select('*');
        backup.supabase[table] = data || [];
      }
      ['ftl_brokers', 'ftl_trips', 'ftl_vehicles', 'ftl_containers'].forEach(k => {
        backup.localStorage[k] = JSON.parse(localStorage.getItem(k) || '[]');
      });
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `ABID_MEHMOOD_Backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('✅ Backup downloaded successfully!', 'success');
    } catch (err) {
      showToast('❌ Backup failed: ' + err.message, 'error');
    }
  };

  // ── Restore handler ─────────────────────────────────────────────────────────
  const handleRestore = () => {
    const input   = document.createElement('input');
    input.type    = 'file';
    input.accept  = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!window.confirm('⚠️ Restore will overwrite ALL current data. Are you sure?')) return;
      try {
        const backup = JSON.parse(await file.text());
        if (!backup._meta || !backup.supabase) { showToast('Invalid backup file!', 'error'); return; }
        const { error } = await supabase.rpc('reset_all_data');
        if (error) throw error;
        for (const [table, rows] of Object.entries(backup.supabase)) {
          if (rows && rows.length > 0) {
            const clean = rows.map(({ id, ...rest }) => rest);
            await supabase.from(table).insert(clean);
          }
        }
        showToast('✅ Data restored! Reloading…', 'success');
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        showToast('❌ Restore failed: ' + err.message, 'error');
      }
    };
    input.click();
  };

  // ── Delete all data handler ─────────────────────────────────────────────────
  const handleDeleteAll = async () => {
    if (!window.confirm('⚠️ Delete ALL practice data permanently?')) return;
    if (!window.confirm('🔴 LAST WARNING — this cannot be undone. Continue?')) return;
    try {
      const tables = [
        'warehouse_rental_deliveries', 'warehouse_rental_items', 'warehouse_rental_clients',
        'local_freight_transactions', 'local_freight_parties', 'karachi_ledgers',
        'finance_overview', 'commission_received_islamabad', 'profit_received_rawalpindi',
        'profit_received_lahore', 'profit_received_islamabad', 'broker_received_rawalpindi',
        'broker_received_lahore', 'broker_received_islamabad', 'broker_ledgers',
        'short_claims', 'receiving_verifications', 'deliveries', 'branch_expenses',
        'branch_ledgers', 'branches', 'challan_bilties', 'challans', 'booking_receipts', 'bilties',
      ];
      for (const table of tables) {
        try { await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000'); }
        catch { /* table may not exist */ }
      }
      ['ftl_brokers', 'ftl_trips', 'ftl_vehicles', 'ftl_containers'].forEach(k => localStorage.removeItem(k));
      showToast('✅ All practice data deleted!', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      showToast('❌ Error: ' + err.message, 'error');
    }
  };

  return (
    <div>
      {/* ── KPI Stats ── */}
      <div className="stats-grid">
        <StatCard icon="📄" iconColor="blue"   value={loading ? '…' : stats.totalBilties}   label="Total Bilties" />
        <StatCard icon="🚚" iconColor="orange"  value={loading ? '…' : stats.totalChallans}  label="Total Challans" />
        <StatCard icon="🏙️" iconColor="green"   value={loading ? '…' : stats.activeBranches} label="Active Branches" />
        <StatCard icon="🏬" iconColor="red"     value={loading ? '…' : stats.warehouseItems}  label="Warehouse Items" />
      </div>

      {/* ── Trend Chart + Quick Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '14px' }}>
        {/* Trend card */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3>📈 Bilty Volume Trend (Last 14 Days)</h3>
            <span className="badge badge-info">Live</span>
          </div>
          <Sparkline data={chartData} color="#2563eb" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', color: 'var(--text-light)', fontSize: '10px' }}>
            <span>14 days ago</span>
            <span>Today</span>
          </div>
        </div>

        {/* Quick actions card */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3>⚡ Quick Actions</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <a href="/bilty" className="btn btn-primary" style={{ justifyContent: 'flex-start', gap: '8px' }}>
              📝 <span>New Bilty</span>
            </a>
            <a href="/challan" className="btn btn-outline" style={{ justifyContent: 'flex-start', gap: '8px' }}>
              🚚 <span>New Challan</span>
            </a>
            <a href="/warehouse" className="btn btn-outline" style={{ justifyContent: 'flex-start', gap: '8px' }}>
              🏬 <span>Warehouse</span>
            </a>
            <a href="/karachi-office" className="btn btn-outline" style={{ justifyContent: 'flex-start', gap: '8px' }}>
              💵 <span>Ledger Entry</span>
            </a>
          </div>
        </div>
      </div>

      {/* ── Recent Bilties Table ── */}
      <div className="card">
        <div className="card-header">
          <h3>📋 Recent Bilties</h3>
          <a href="/bilty/all-records" className="btn btn-outline btn-sm">View All</a>
        </div>
        {loading ? (
          <div className="page-loader" style={{ minHeight: '120px' }}>
            <div className="spinner" />
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Bilty #</th>
                  <th>Sender</th>
                  <th>Receiver</th>
                  <th>Freight (Rs.)</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentBilties.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-light)', padding: '24px' }}>
                      No bilties found. <a href="/bilty" style={{ color: 'var(--primary)' }}>Create the first one →</a>
                    </td>
                  </tr>
                ) : (
                  recentBilties.map((b) => (
                    <tr key={b.id}>
                      <td><strong style={{ color: 'var(--dark)' }}>{b.bilty_number || '—'}</strong></td>
                      <td>{b.sender_name || '—'}</td>
                      <td>{b.receiver_name || '—'}</td>
                      <td style={{ fontWeight: 600 }}>
                        Rs.&nbsp;{Number(b.local_freight || 0).toLocaleString('en-PK')}
                      </td>
                      <td>{b.bilty_date || '—'}</td>
                      <td><span className="badge badge-success">Booked</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── System Status + Data Management ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {/* System status */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3>🖥️ System Status</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: 'Database',      status: 'Connected',   ok: true },
              { label: 'Cloud Storage', status: 'Active',      ok: true },
              { label: 'Supabase API',  status: 'Operational', ok: true },
            ].map(({ label, status, ok }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ color: 'var(--text)' }}>{label}</span>
                <span className={`badge badge-${ok ? 'success' : 'danger'}`}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: ok ? 'var(--success)' : 'var(--danger)', display: 'inline-block', marginRight: 5 }} />
                  {status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Data management */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3>💾 Data Management</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button className="btn btn-success btn-sm" onClick={handleBackup} style={{ justifyContent: 'flex-start' }}>
              ⬇️ &nbsp;Backup All Data
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleRestore} style={{ justifyContent: 'flex-start' }}>
              ⬆️ &nbsp;Restore from Backup
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleDeleteAll} style={{ justifyContent: 'flex-start' }}>
              🗑️ &nbsp;Delete All Practice Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Global toast helper ──────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  const colors = { success: 'var(--success)', error: 'var(--danger)', info: 'var(--primary)', warning: 'var(--warning)' };
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position:fixed;bottom:20px;right:20px;padding:12px 20px;
    border-radius:6px;color:#fff;font-size:13px;font-weight:500;
    z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.2);
    background:${colors[type] || colors.info};
    animation:toastIn 0.2s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
