import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { TrendingUp, Plus, X, Lock, Unlock } from 'lucide-react';

export default function ProfitReportRawalpindi() {
  const [activeTab, setActiveTab] = useState('ledger');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));

  // Challan profit ledger (from challans with Rawalpindi bilties)
  const [challans, setChallans] = useState([]);
  const [loadingChallans, setLoadingChallans] = useState(true);

  // Manual received entries
  const [received, setReceived] = useState([]);
  const [loadingReceived, setLoadingReceived] = useState(true);

  // Add received form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], description: '', vehicle_number: '', amount: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Closed months
  const [closedMonths, setClosedMonths] = useState(() => {
    const s = localStorage.getItem('profit_rawalpindi_closed');
    return s ? JSON.parse(s) : [];
  });

  const isClosed = closedMonths.includes(filterMonth);

  const toggleClose = () => {
    const updated = isClosed
      ? closedMonths.filter(m => m !== filterMonth)
      : [...closedMonths, filterMonth];
    setClosedMonths(updated);
    localStorage.setItem('profit_rawalpindi_closed', JSON.stringify(updated));
  };

  useEffect(() => {
    fetchChallans();
    fetchReceived();
  }, []);

  async function fetchChallans() {
    setLoadingChallans(true);
    // Step 1: Get all challan_ids that have Rawalpindi bilties
    const { data: cbData, error: cbError } = await supabase
      .from('challan_bilties')
      .select('challan_id, bilties(destination_branch_id, branches(name))');

    if (cbError) {
      console.error('challan_bilties error:', cbError.message);
      setLoadingChallans(false);
      return;
    }

    const rawalpindiChallanIds = (cbData || [])
      .filter(cb => cb.bilties?.branches?.name === 'Rawalpindi')
      .map(cb => cb.challan_id);

    if (!rawalpindiChallanIds.length) {
      setChallans([]);
      setLoadingChallans(false);
      return;
    }

    // Step 2: Fetch those challans with all financial fields
    const { data, error } = await supabase
      .from('challans')
      .select('id, challan_number, challan_date, vehicle_number, total_bilty_amount, labor_deduction, commission_deduction, other_deduction, vehicle_freight, branch_deposit')
      .in('id', rawalpindiChallanIds)
      .order('id', { ascending: false });

    if (error) console.error('challans error:', error.message);
    if (data) setChallans(data);
    setLoadingChallans(false);
  }

  async function fetchReceived() {
    setLoadingReceived(true);
    const { data, error } = await supabase
      .from('profit_received_rawalpindi')
      .select('*')
      .order('id', { ascending: false });
    if (error) console.error('profit_received error:', error.message);
    if (data) setReceived(data);
    setLoadingReceived(false);
  }

  const handleFormChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAddReceived = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setMsg({ text: 'Amount required.', type: 'error' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('profit_received_rawalpindi').insert([{
      date: form.date,
      description: form.description,
      vehicle_number: form.vehicle_number,
      amount: parseFloat(form.amount),
    }]);
    setSaving(false);
    if (error) {
      setMsg({ text: 'Error: ' + error.message, type: 'error' });
    } else {
      setMsg({ text: 'Amount received entry added!', type: 'success' });
      setForm({ date: new Date().toISOString().split('T')[0], description: '', vehicle_number: '', amount: '' });
      setShowForm(false);
      fetchReceived();
    }
  };

  const handleDeleteReceived = async (id) => {
    await supabase.from('profit_received_rawalpindi').delete().eq('id', id);
    fetchReceived();
  };

  // Calculate profit for a challan (now shows branch_deposit amount)
  const calcProfit = (ch) => {
    return parseFloat(ch.branch_deposit) || 0;
  };

  // Month filter helpers
  const monthChallans = challans.filter(ch => {
    if (!filterMonth) return true;
    const d = ch.challan_date?.slice(0, 7);
    return d === filterMonth || !d;
  });

  const monthReceived = received.filter(r => {
    if (!filterMonth) return true;
    return r.date?.slice(0, 7) === filterMonth;
  });

  // Summary
  const totalProfitDue = monthChallans.reduce((s, ch) => s + calcProfit(ch), 0);
  const totalReceived_ = monthReceived.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const balance = totalProfitDue - totalReceived_;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <TrendingUp size={26} color="var(--primary-color)" />
          <h1 className="page-title" style={{ marginBottom: 0 }}>A/C Receivable — Rawalpindi</h1>
        </div>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
        Track Rawalpindi branch challan A/C receivable and received payments.
      </p>

      {/* Month Filter + Close */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Month:</label>
          <input
            type="month"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '0.85rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          />
        </div>
        <button
          onClick={toggleClose}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 16px', fontSize: '0.82rem', fontWeight: 700,
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            background: isClosed ? '#10b981' : '#ef4444', color: '#fff'
          }}
        >
          {isClosed ? <><Unlock size={14} /> Reopen Month</> : <><Lock size={14} /> Close This Month</>}
        </button>
        {isClosed && (
          <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600, background: '#d1fae5', padding: '4px 10px', borderRadius: '6px' }}>
            📌 Month Closed (read-only)
          </span>
        )}
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '22px' }}>
        {[
          { label: 'Total A/C Receivable', value: totalProfitDue, color: '#6366f1' },
          { label: 'Total Received', value: totalReceived_, color: '#10b981' },
          { label: 'Balance Remaining', value: balance, color: balance > 0 ? '#ef4444' : '#10b981' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', borderLeft: `4px solid ${c.color}` }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>{c.label}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: c.color }}>Rs. {c.value.toLocaleString('en-PK')}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', borderBottom: '2px solid var(--border)' }}>
        {[['ledger', 'Profit Ledger (Challans)'], ['received', 'Amount Received']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            padding: '8px 20px', fontSize: '0.88rem', fontWeight: 700, border: 'none',
            borderRadius: '8px 8px 0 0', cursor: 'pointer', marginBottom: '-2px',
            background: activeTab === key ? 'var(--primary)' : 'transparent',
            color: activeTab === key ? '#fff' : 'var(--text-muted)',
            borderBottom: activeTab === key ? '2px solid var(--primary)' : '2px solid transparent',
          }}>{label}</button>
        ))}
      </div>

      {/* Message */}
      {msg.text && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', background: msg.type === 'success' ? '#d1fae5' : '#fee2e2', color: msg.type === 'success' ? '#065f46' : '#991b1b', fontWeight: 600, fontSize: '0.88rem' }}>
          {msg.text}
        </div>
      )}

      {/* TAB 1: Profit Ledger */}
      {activeTab === 'ledger' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Rawalpindi Challans — {filterMonth || 'All Time'}</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{monthChallans.length} challans</span>
          </div>
          {loadingChallans ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
          ) : monthChallans.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No Rawalpindi challans found for {filterMonth}.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                    {['#', 'Challan No', 'Date', 'Vehicle No', 'A/C Receivable'].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthChallans.map((ch, i) => {
                    const p = calcProfit(ch);
                    return (
                      <tr key={ch.id} style={{ borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--primary-color)' }}>#{ch.challan_number || ch.id}</td>
                        <td style={{ padding: '10px 14px' }}>{ch.challan_date ? new Date(ch.challan_date + 'T00:00:00').toLocaleDateString('en-PK') : '—'}</td>
                        <td style={{ padding: '10px 14px' }}>{ch.vehicle_number || '—'}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: p >= 0 ? '#16a34a' : '#ef4444' }}>Rs. {p.toLocaleString('en-PK')}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                    <td colSpan={4} style={{ padding: '10px 14px' }}>Monthly Total</td>
                    <td style={{ padding: '10px 14px', color: totalProfitDue >= 0 ? '#16a34a' : '#ef4444', fontSize: '0.95rem' }}>Rs. {totalProfitDue.toLocaleString('en-PK')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Amount Received */}
      {activeTab === 'received' && (
        <div>
          {/* Add Button */}
          {!isClosed && (
            <div style={{ marginBottom: '14px' }}>
              <button
                onClick={() => { setShowForm(!showForm); setMsg({ text: '', type: '' }); }}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 20px' }}
              >
                <Plus size={16} /> Add Received Amount
              </button>
            </div>
          )}

          {/* Add Form */}
          {showForm && !isClosed && (
            <div className="card" style={{ padding: '20px', marginBottom: '18px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '0.95rem', fontWeight: 700 }}>New Entry</h3>
              <form onSubmit={handleAddReceived}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label>Date</label>
                    <input type="date" name="date" value={form.date} onChange={handleFormChange} required />
                  </div>
                  <div className="form-group">
                    <label>Vehicle Number</label>
                    <input type="text" name="vehicle_number" value={form.vehicle_number} onChange={handleFormChange} placeholder="e.g. LEA-1234" />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <input type="text" name="description" value={form.description} onChange={handleFormChange} placeholder="e.g. Profit payment" />
                  </div>
                  <div className="form-group">
                    <label>Amount Received <span style={{ color: 'red' }}>*</span></label>
                    <input type="number" name="amount" value={form.amount} onChange={handleFormChange} min="0" step="0.01" placeholder="0" required />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '8px 20px' }}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} style={{ padding: '8px 20px' }}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {/* Received Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Amount Received — {filterMonth || 'All Time'}</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{monthReceived.length} entries</span>
            </div>
            {loadingReceived ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
            ) : monthReceived.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No received entries for {filterMonth}.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                      {['#', 'Date', 'Vehicle No', 'Description', 'Amount', isClosed ? '' : 'Action'].map((h, i) => (
                        <th key={i} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthReceived.map((r, i) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ padding: '10px 14px' }}>{r.date ? new Date(r.date).toLocaleDateString('en-PK') : '—'}</td>
                        <td style={{ padding: '10px 14px' }}>{r.vehicle_number || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>{r.description || '—'}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#10b981' }}>Rs. {(parseFloat(r.amount) || 0).toLocaleString('en-PK')}</td>
                        {!isClosed && (
                          <td style={{ padding: '10px 14px' }}>
                            <button onClick={() => handleDeleteReceived(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }} title="Delete">
                              <X size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                      <td colSpan={4} style={{ padding: '10px 14px' }}>Monthly Total Received</td>
                      <td style={{ padding: '10px 14px', color: '#10b981', fontSize: '0.95rem' }}>Rs. {totalReceived_.toLocaleString('en-PK')}</td>
                      {!isClosed && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Balance Summary */}
          <div className="card" style={{ marginTop: '16px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
              <span>Total A/C Receivable ({filterMonth}):</span>
              <strong style={{ color: '#6366f1' }}>Rs. {totalProfitDue.toLocaleString('en-PK')}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
              <span>Total Received:</span>
              <strong style={{ color: '#10b981' }}>Rs. {totalReceived_.toLocaleString('en-PK')}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '10px', fontSize: '1rem', fontWeight: 700 }}>
              <span>Balance Remaining:</span>
              <strong style={{ color: balance > 0 ? '#ef4444' : '#10b981' }}>Rs. {balance.toLocaleString('en-PK')}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
