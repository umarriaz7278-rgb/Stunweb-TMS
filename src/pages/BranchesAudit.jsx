import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart2 } from 'lucide-react';

const BRANCHES = ['Lahore', 'Islamabad', 'Rawalpindi'];

export default function BranchesAudit() {
  const [activeTab, setActiveTab] = useState('Lahore');
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));

  // Closed months stored in localStorage: { 'Lahore': ['2026-04', ...], ... }
  const [closedMonths, setClosedMonths] = useState(() => {
    const saved = localStorage.getItem('branches_audit_closed_months');
    return saved ? JSON.parse(saved) : { Lahore: [], Islamabad: [], Rawalpindi: [] };
  });

  useEffect(() => {
    fetchDeliveries();
  }, [activeTab]);

  async function fetchDeliveries() {
    setLoading(true);
    // Fetch deliveries joined with bilties to get branch info
    const { data, error } = await supabase
      .from('deliveries')
      .select(`
        id,
        created_at,
        delivered_qty,
        paid_amount,
        extra_labor,
        extra_unloading,
        local_fare,
        extra_other,
        bilty_id,
        bilties (
          bilty_number,
          destination_branch_id,
          branches ( name )
        )
      `)
      .order('id', { ascending: false });

    if (error) {
      console.error('Error fetching deliveries:', error);
    } else {
      // Filter by current active branch
      const filtered = (data || []).filter(d =>
        d.bilties?.branches?.name === activeTab
      );
      setDeliveries(filtered);
    }
    setLoading(false);
  }

  const saveClosedMonths = (updated) => {
    setClosedMonths(updated);
    localStorage.setItem('branches_audit_closed_months', JSON.stringify(updated));
  };

  const isMonthClosed = (branch, month) => {
    return (closedMonths[branch] || []).includes(month);
  };

  const toggleCloseMonth = (branch, month) => {
    const current = closedMonths[branch] || [];
    let updated;
    if (current.includes(month)) {
      updated = { ...closedMonths, [branch]: current.filter(m => m !== month) };
    } else {
      updated = { ...closedMonths, [branch]: [...current, month] };
    }
    saveClosedMonths(updated);
  };

  // Filter by month
  const filteredDeliveries = deliveries.filter(d => {
    if (!filterMonth) return true;
    if (!d.created_at) return true; // show if no date
    const date = d.created_at?.slice(0, 7);
    return date === filterMonth;
  });

  // Totals
  const totalExtraLabor = filteredDeliveries.reduce((s, d) => s + (parseFloat(d.extra_labor) || 0), 0);
  const totalExtraUnloading = filteredDeliveries.reduce((s, d) => s + (parseFloat(d.extra_unloading) || 0), 0);
  const totalLocalFare = filteredDeliveries.reduce((s, d) => s + (parseFloat(d.local_fare) || 0), 0);
  const totalOther = filteredDeliveries.reduce((s, d) => s + (parseFloat(d.extra_other) || 0), 0);
  const grandTotal = totalExtraLabor + totalExtraUnloading + totalLocalFare + totalOther;

  const isClosed = isMonthClosed(activeTab, filterMonth);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
        <BarChart2 size={26} color="var(--primary-color)" />
        <h1 className="page-title" style={{ marginBottom: 0 }}>Branches Audit</h1>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.85rem' }}>
        Branch-wise delivery income audit — Extra Labor, Unloading, Local Fare & Other Charges per bilty.
      </p>

      {/* Branch Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', borderBottom: '2px solid var(--border)', paddingBottom: '0' }}>
        {BRANCHES.map(branch => (
          <button
            key={branch}
            onClick={() => { setActiveTab(branch); }}
            style={{
              padding: '8px 22px',
              fontSize: '0.88rem',
              fontWeight: 700,
              border: 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              background: activeTab === branch ? 'var(--primary)' : 'var(--bg-main)',
              color: activeTab === branch ? '#fff' : 'var(--text-muted)',
              borderBottom: activeTab === branch ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-2px',
              transition: 'all 0.2s'
            }}
          >
            {branch}
          </button>
        ))}
      </div>

      {/* Filters Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Month:</label>
          <input
            type="month"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '0.85rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-surface)', color: 'var(--text-main)' }}
          />
        </div>
        <button
          onClick={() => toggleCloseMonth(activeTab, filterMonth)}
          style={{
            padding: '6px 16px',
            fontSize: '0.82rem',
            fontWeight: 700,
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            background: isClosed ? '#10b981' : '#ef4444',
            color: '#fff',
          }}
        >
          {isClosed ? '✅ Month Closed — Click to Reopen' : '🔒 Close This Month'}
        </button>
        {isClosed && (
          <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600, background: '#d1fae5', padding: '4px 10px', borderRadius: '6px' }}>
            📌 This month is closed (read-only)
          </span>
        )}
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '18px' }}>
        {[
          { label: 'Extra Labor', value: totalExtraLabor, color: '#6366f1' },
          { label: 'Extra Unloading', value: totalExtraUnloading, color: '#f59e0b' },
          { label: 'Local Fare', value: totalLocalFare, color: '#14b8a6' },
          { label: 'Other Charges', value: totalOther, color: '#0ea5e9' },
          { label: 'Total Extra Income', value: grandTotal, color: '#10b981' },
        ].map(card => (
          <div key={card.label} style={{ background: 'var(--bg-surface)', border: `1px solid var(--border)`, borderRadius: '10px', padding: '14px 16px', borderLeft: `4px solid ${card.color}` }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>{card.label}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: card.color }}>Rs. {card.value.toLocaleString()}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{filteredDeliveries.length} deliveries</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
            {activeTab} Branch — {filterMonth || 'All Time'} Delivery Records
            {isClosed && <span style={{ marginLeft: '10px', fontSize: '0.75rem', background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '4px' }}>CLOSED</span>}
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{filteredDeliveries.length} records</span>
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : filteredDeliveries.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No delivery records found for {activeTab} in {filterMonth || 'this period'}.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>#</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Bilty #</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Date</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>Delivered Qty</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>Extra Labor</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>Extra Unloading</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>Local Fare</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>Other Charges</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>Total Extra</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeliveries.map((d, i) => {
                const rowTotal = (parseFloat(d.extra_labor) || 0) + (parseFloat(d.extra_unloading) || 0) + (parseFloat(d.local_fare) || 0) + (parseFloat(d.extra_other) || 0);
                const hasExtra = rowTotal > 0;
                return (
                  <tr
                    key={d.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: isClosed ? 'rgba(16,185,129,0.03)' : 'transparent',
                      opacity: isClosed ? 0.85 : 1,
                    }}
                  >
                    <td style={{ padding: '9px 14px', color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ padding: '9px 14px', fontWeight: 700, color: 'var(--primary-color)' }}>
                      #{d.bilties?.bilty_number || d.bilty_id}
                    </td>
                    <td style={{ padding: '9px 14px', color: 'var(--text-muted)' }}>
                      {d.created_at ? new Date(d.created_at).toLocaleDateString('en-PK') : '-'}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right' }}>{d.delivered_qty}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', color: parseFloat(d.extra_labor) > 0 ? '#6366f1' : 'var(--text-muted)' }}>
                      Rs. {(parseFloat(d.extra_labor) || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', color: parseFloat(d.extra_unloading) > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                      Rs. {(parseFloat(d.extra_unloading) || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', color: parseFloat(d.local_fare) > 0 ? '#14b8a6' : 'var(--text-muted)' }}>
                      Rs. {(parseFloat(d.local_fare) || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', color: parseFloat(d.extra_other) > 0 ? '#0ea5e9' : 'var(--text-muted)' }}>
                      Rs. {(parseFloat(d.extra_other) || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: hasExtra ? '#10b981' : 'var(--text-muted)' }}>
                      Rs. {rowTotal.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Footer totals */}
            <tfoot>
              <tr style={{ background: 'var(--bg-main)', borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                <td colSpan={4} style={{ padding: '10px 14px', fontSize: '0.85rem' }}>Monthly Total</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: '#6366f1' }}>Rs. {totalExtraLabor.toLocaleString()}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: '#f59e0b' }}>Rs. {totalExtraUnloading.toLocaleString()}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: '#14b8a6' }}>Rs. {totalLocalFare.toLocaleString()}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: '#0ea5e9' }}>Rs. {totalOther.toLocaleString()}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: '#10b981', fontSize: '0.95rem' }}>Rs. {grandTotal.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
