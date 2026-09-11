import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { TrendingUp, Plus, X, Lock, Unlock, Users, Phone, MapPin, Search, Edit2, Trash2, Save, UserCheck } from 'lucide-react';

const BROKERS_STORAGE_KEY = 'islamabad_broker_accounts';

function loadInitialBrokers() {
  try {
    const s = localStorage.getItem(BROKERS_STORAGE_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

export default function BrokerReceivable() {
  const [activeTab, setActiveTab] = useState('ledger');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));

  // Challan ledger (from challans with Islamabad bilties)
  const [challans, setChallans] = useState([]);
  const [loadingChallans, setLoadingChallans] = useState(true);

  // Manual received entries
  const [received, setReceived] = useState([]);
  const [loadingReceived, setLoadingReceived] = useState(true);

  // Add received form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], description: '', vehicle_number: '', amount: '', broker_name: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Broker Accounts List State
  const [brokers, setBrokers] = useState(loadInitialBrokers);
  const [brokerSearch, setBrokerSearch] = useState('');
  const [showBrokerForm, setShowBrokerForm] = useState(false);
  const [editingBrokerId, setEditingBrokerId] = useState(null);
  const [brokerForm, setBrokerForm] = useState({
    name: '',
    phone: '',
    address: '',
  });

  // Closed months
  const [closedMonths, setClosedMonths] = useState(() => {
    const s = localStorage.getItem('broker_receivable_closed');
    return s ? JSON.parse(s) : [];
  });

  const isClosed = closedMonths.includes(filterMonth);

  const toggleClose = () => {
    const updated = isClosed
      ? closedMonths.filter(m => m !== filterMonth)
      : [...closedMonths, filterMonth];
    setClosedMonths(updated);
    localStorage.setItem('broker_receivable_closed', JSON.stringify(updated));
  };

  useEffect(() => {
    fetchChallans();
    fetchReceived();
    fetchBrokers();
  }, []);

  async function fetchChallans() {
    setLoadingChallans(true);
    // Step 1: Get all challan_ids that have Islamabad bilties
    const { data: cbData, error: cbError } = await supabase
      .from('challan_bilties')
      .select('challan_id, bilties(destination_branch_id, branches(name))');

    if (cbError) {
      console.error('challan_bilties error:', cbError.message);
      setLoadingChallans(false);
      return;
    }

    const islamabadChallanIds = (cbData || [])
      .filter(cb => cb.bilties?.branches?.name === 'Islamabad')
      .map(cb => cb.challan_id);

    if (!islamabadChallanIds.length) {
      setChallans([]);
      setLoadingChallans(false);
      return;
    }

    // Step 2: Fetch those challans with all financial fields
    const { data, error } = await supabase
      .from('challans')
      .select('id, challan_number, challan_date, vehicle_number, total_bilty_amount, commission_deduction, vehicle_freight, branch_deposit')
      .in('id', islamabadChallanIds)
      .order('id', { ascending: false });

    if (error) console.error('challans error:', error.message);
    if (data) setChallans(data);
    setLoadingChallans(false);
  }

  async function fetchReceived() {
    setLoadingReceived(true);
    const { data, error } = await supabase
      .from('broker_received_islamabad')
      .select('*')
      .order('id', { ascending: false });
    if (error) console.error('broker_received error:', error.message);
    if (data) setReceived(data);
    setLoadingReceived(false);
  }

  async function fetchBrokers() {
    try {
      const { data, error } = await supabase.from('islamabad_brokers').select('*').order('name');
      if (!error && data && data.length > 0) {
        setBrokers(data);
        localStorage.setItem(BROKERS_STORAGE_KEY, JSON.stringify(data));
      }
    } catch (err) {
      console.warn('Could not fetch brokers from Supabase, using local:', err);
    }
  }

  const handleFormChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAddReceived = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setMsg({ text: 'Amount required.', type: 'error' });
      return;
    }
    setSaving(true);
    const descWithBroker = form.broker_name 
      ? `[${form.broker_name}] ${form.description || ''}`.trim()
      : form.description;

    const { error } = await supabase.from('broker_received_islamabad').insert([{
      date: form.date,
      description: descWithBroker,
      vehicle_number: form.vehicle_number,
      amount: parseFloat(form.amount),
    }]);
    setSaving(false);
    if (error) {
      setMsg({ text: 'Error: ' + error.message, type: 'error' });
    } else {
      setMsg({ text: 'Amount received entry added!', type: 'success' });
      setForm({ date: new Date().toISOString().split('T')[0], description: '', vehicle_number: '', amount: '', broker_name: '' });
      setShowForm(false);
      fetchReceived();
    }
  };

  const handleDeleteReceived = async (id) => {
    await supabase.from('broker_received_islamabad').delete().eq('id', id);
    fetchReceived();
  };

  // Broker Accounts CRUD Handlers
  const handleSaveBroker = async (e) => {
    e.preventDefault();
    if (!brokerForm.name.trim()) {
      setMsg({ text: 'Broker Name is required.', type: 'error' });
      return;
    }

    const newBroker = {
      id: editingBrokerId || Date.now().toString(),
      name: brokerForm.name.trim(),
      phone: brokerForm.phone.trim(),
      address: brokerForm.address.trim(),
      created_at: new Date().toISOString(),
    };

    let updatedBrokers;
    if (editingBrokerId) {
      updatedBrokers = brokers.map(b => b.id === editingBrokerId ? { ...b, ...newBroker } : b);
    } else {
      updatedBrokers = [newBroker, ...brokers];
    }

    setBrokers(updatedBrokers);
    localStorage.setItem(BROKERS_STORAGE_KEY, JSON.stringify(updatedBrokers));

    // Supabase sync
    try {
      await supabase.from('islamabad_brokers').upsert([newBroker]);
    } catch {}

    setMsg({ text: `Broker account "${newBroker.name}" ${editingBrokerId ? 'updated' : 'created'} successfully!`, type: 'success' });
    setBrokerForm({ name: '', phone: '', address: '' });
    setEditingBrokerId(null);
    setShowBrokerForm(false);
  };

  const handleEditBroker = (broker) => {
    setBrokerForm({
      name: broker.name || '',
      phone: broker.phone || '',
      address: broker.address || '',
    });
    setEditingBrokerId(broker.id);
    setShowBrokerForm(true);
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const handleDeleteBroker = async (id) => {
    if (window.confirm('Are you sure you want to delete this broker account?')) {
      const updated = brokers.filter(b => b.id !== id);
      setBrokers(updated);
      localStorage.setItem(BROKERS_STORAGE_KEY, JSON.stringify(updated));
      try {
        await supabase.from('islamabad_brokers').delete().eq('id', id);
      } catch {}
      setMsg({ text: 'Broker account deleted.', type: 'success' });
    }
  };

  // Receivable from Broker = total_bilty_amount - commission - vehicle_freight - branch_deposit
  const calcReceivable = (ch) => {
    const biltyAmt = parseFloat(ch.total_bilty_amount) || 0;
    const commission = parseFloat(ch.commission_deduction) || 0;
    const freight = parseFloat(ch.vehicle_freight) || 0;
    const deposit = parseFloat(ch.branch_deposit) || 0;
    return biltyAmt - commission - freight - deposit;
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
  const totalReceivable = monthChallans.reduce((s, ch) => s + calcReceivable(ch), 0);
  const totalReceived_ = monthReceived.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const balance = totalReceivable - totalReceived_;

  const filteredBrokers = brokers.filter(b => {
    if (!brokerSearch.trim()) return true;
    const q = brokerSearch.toLowerCase();
    return (
      (b.name && b.name.toLowerCase().includes(q)) ||
      (b.phone && b.phone.toLowerCase().includes(q)) ||
      (b.address && b.address.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <TrendingUp size={28} color="#2563eb" />
          <h1 className="page-title" style={{ marginBottom: 0, color: '#1e40af', fontWeight: 800 }}>A/C Receivable Broker — Islamabad</h1>
        </div>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
        Track Islamabad branch challan broker receivables, payments received, and manage broker accounts list.
      </p>

      {/* Month Filter + Close (Only for ledger and received tabs) */}
      {activeTab !== 'brokers' && (
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
      )}

      {/* Summary Cards (Only for ledger and received tabs) */}
      {activeTab !== 'brokers' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '22px' }}>
          {[
            { label: 'Total A/C Receivable', value: totalReceivable, color: '#6366f1' },
            { label: 'Total Received', value: totalReceived_, color: '#10b981' },
            { label: 'Balance Remaining', value: balance, color: balance > 0 ? '#ef4444' : '#10b981' },
          ].map(c => (
            <div key={c.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', borderLeft: `4px solid ${c.color}` }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>{c.label}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: c.color }}>Rs. {c.value.toLocaleString('en-PK')}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', borderBottom: '2px solid var(--border)', flexWrap: 'wrap' }}>
        {[
          ['ledger', 'Broker Ledger (Challans)'],
          ['received', 'Amount Received'],
          ['brokers', '🤝 Broker Name List (بروکرز لسٹ)'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            padding: '10px 20px', fontSize: '0.9rem', fontWeight: 700, border: 'none',
            borderRadius: '8px 8px 0 0', cursor: 'pointer', marginBottom: '-2px',
            background: activeTab === key ? '#2563eb' : 'transparent',
            color: activeTab === key ? '#fff' : 'var(--text-muted)',
            borderBottom: activeTab === key ? '2px solid #2563eb' : '2px solid transparent',
            transition: 'all 0.2s',
          }}>{label}</button>
        ))}
      </div>

      {/* Message */}
      {msg.text && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', background: msg.type === 'success' ? '#d1fae5' : '#fee2e2', color: msg.type === 'success' ? '#065f46' : '#991b1b', fontWeight: 700, fontSize: '0.9rem', border: `1px solid ${msg.type === 'success' ? '#86efac' : '#fca5a5'}` }}>
          {msg.text}
        </div>
      )}

      {/* TAB 1: Broker Ledger */}
      {activeTab === 'ledger' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Islamabad Challans — {filterMonth || 'All Time'}</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{monthChallans.length} challans</span>
          </div>
          {loadingChallans ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
          ) : monthChallans.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No Islamabad challans found for {filterMonth}.</div>
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
                    const p = calcReceivable(ch);
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
                    <td style={{ padding: '10px 14px', color: totalReceivable >= 0 ? '#16a34a' : '#ef4444', fontSize: '0.95rem' }}>Rs. {totalReceivable.toLocaleString('en-PK')}</td>
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
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', fontSize: '0.9rem', fontWeight: 700 }}
              >
                <Plus size={16} /> Add Received Amount
              </button>
            </div>
          )}

          {/* Add Form */}
          {showForm && !isClosed && (
            <div className="card" style={{ padding: '22px', marginBottom: '20px', borderTop: '4px solid #10b981' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: 800, color: '#065f46' }}>Record Received Payment</h3>
              <form onSubmit={handleAddReceived}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#065f46', marginBottom: '6px', display: 'block' }}>Date *</label>
                    <input type="date" name="date" value={form.date} onChange={handleFormChange} required style={{ width: '100%', height: '44px', padding: '10px 12px', fontSize: '0.95rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box' }} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#065f46', marginBottom: '6px', display: 'block' }}>Select Broker (Optional)</label>
                    <select
                      name="broker_name"
                      value={form.broker_name}
                      onChange={handleFormChange}
                      style={{ width: '100%', height: '44px', padding: '10px 12px', fontSize: '0.95rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box' }}
                    >
                      <option value="">-- Select from Broker List --</option>
                      {brokers.map(b => (
                        <option key={b.id} value={b.name}>{b.name} {b.phone ? `(${b.phone})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#065f46', marginBottom: '6px', display: 'block' }}>Vehicle Number</label>
                    <input type="text" name="vehicle_number" value={form.vehicle_number} onChange={handleFormChange} placeholder="e.g. LEA-1234" style={{ width: '100%', height: '44px', padding: '10px 12px', fontSize: '0.95rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box' }} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#065f46', marginBottom: '6px', display: 'block' }}>Description</label>
                    <input type="text" name="description" value={form.description} onChange={handleFormChange} placeholder="e.g. Broker payment / remarks" style={{ width: '100%', height: '44px', padding: '10px 12px', fontSize: '0.95rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box' }} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#065f46', marginBottom: '6px', display: 'block' }}>Amount Received (Rs.) *</label>
                    <input type="number" name="amount" value={form.amount} onChange={handleFormChange} min="0" step="0.01" placeholder="0.00" required style={{ width: '100%', height: '44px', padding: '10px 12px', fontSize: '1rem', fontWeight: 700, borderRadius: '8px', border: '1.5px solid #86efac', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '10px 24px', fontWeight: 700, borderRadius: '8px' }}>
                    {saving ? 'Saving...' : 'Save Payment'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} style={{ padding: '10px 20px', borderRadius: '8px' }}>Cancel</button>
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
              <strong style={{ color: '#6366f1' }}>Rs. {totalReceivable.toLocaleString('en-PK')}</strong>
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

      {/* TAB 3: Broker Name List */}
      {activeTab === 'brokers' && (
        <div>
          {/* Top Bar: Stat Card & Add Broker Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={26} color="#2563eb" />
              </div>
              <div>
                <h2 style={{ margin: 0, color: '#1e40af', fontSize: '1.3rem', fontWeight: 800 }}>
                  Broker Name List (بروکرز لسٹ)
                </h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Total Registered Brokers: <strong style={{ color: '#2563eb' }}>{brokers.length}</strong>
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                if (showBrokerForm) {
                  setShowBrokerForm(false);
                  setEditingBrokerId(null);
                  setBrokerForm({ name: '', phone: '', address: '' });
                } else {
                  setShowBrokerForm(true);
                  setEditingBrokerId(null);
                  setBrokerForm({ name: '', phone: '', address: '' });
                }
              }}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', fontSize: '0.92rem', fontWeight: 700, borderRadius: '8px', background: '#2563eb' }}
            >
              {showBrokerForm ? <><X size={17} /> Close Form</> : <><Plus size={17} /> Add New Broker Account</>}
            </button>
          </div>

          {/* Create / Edit Broker Form */}
          {showBrokerForm && (
            <div className="card" style={{ padding: '24px', marginBottom: '22px', borderTop: '4px solid #2563eb', animation: 'fadeIn 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {editingBrokerId ? '✏️ Edit Broker Account' : '➕ Create New Broker Account (نیا بروکر اکاؤنٹ)'}
                </h3>
                <button
                  type="button"
                  onClick={() => { setShowBrokerForm(false); setEditingBrokerId(null); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveBroker}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af', marginBottom: '6px', display: 'block' }}>
                      Broker Name (بروکر کا نام) *
                    </label>
                    <input
                      type="text"
                      value={brokerForm.name}
                      onChange={(e) => setBrokerForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Tariq Mehmood Broker"
                      required
                      style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', fontWeight: 600, borderRadius: '8px', border: '1.5px solid #93c5fd', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#059669', marginBottom: '6px', display: 'block' }}>
                      Mobile Number (موبائل نمبر)
                    </label>
                    <input
                      type="text"
                      value={brokerForm.phone}
                      onChange={(e) => setBrokerForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="e.g. 0300-1234567"
                      style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #86efac', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#7c3aed', marginBottom: '6px', display: 'block' }}>
                      Address / Location (پتہ / ایڈریس)
                    </label>
                    <input
                      type="text"
                      value={brokerForm.address}
                      onChange={(e) => setBrokerForm(p => ({ ...p, address: e.target.value }))}
                      placeholder="e.g. I-9/2 Goods Forwarding, Islamabad"
                      style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #c4b5fd', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => { setShowBrokerForm(false); setEditingBrokerId(null); }}
                    style={{ padding: '10px 20px', borderRadius: '8px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 26px', fontSize: '0.95rem', fontWeight: 700, borderRadius: '8px', background: '#2563eb' }}
                  >
                    <Save size={17} />
                    {editingBrokerId ? 'Update Broker Account' : 'Save Broker Account'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Search Filter */}
          <div className="card" style={{ marginBottom: '18px', padding: '14px 18px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                value={brokerSearch}
                onChange={(e) => setBrokerSearch(e.target.value)}
                placeholder="Search broker by name, mobile number, or address..."
                style={{
                  width: '100%',
                  height: '44px',
                  paddingLeft: '40px',
                  paddingRight: '14px',
                  fontSize: '0.95rem',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Brokers Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', borderTop: '4px solid #2563eb' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#1e40af' }}>
                All Broker Accounts ({filteredBrokers.length})
              </h3>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Islamabad Branch</span>
            </div>

            {filteredBrokers.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                {brokers.length === 0 ? (
                  <div>
                    <p style={{ fontSize: '1rem', color: '#475569', marginBottom: '12px' }}>No broker accounts added yet.</p>
                    <button
                      onClick={() => setShowBrokerForm(true)}
                      className="btn btn-primary"
                      style={{ padding: '8px 18px', fontSize: '0.88rem' }}
                    >
                      <Plus size={15} /> Create First Broker Account
                    </button>
                  </div>
                ) : (
                  <p>No brokers found matching "{brokerSearch}".</p>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', fontSize: '0.8rem' }}>#</th>
                      <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', fontSize: '0.8rem' }}>Broker Name</th>
                      <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 800, color: '#059669', textTransform: 'uppercase', fontSize: '0.8rem' }}>Mobile Number</th>
                      <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', fontSize: '0.8rem' }}>Address</th>
                      <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', fontSize: '0.8rem' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBrokers.map((b, i) => (
                      <tr
                        key={b.id}
                        style={{ borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#dbeafe', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem' }}>
                              {b.name ? b.name.charAt(0).toUpperCase() : 'B'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>{b.name}</div>
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ID: {String(b.id).slice(0, 8)}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {b.phone ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#065f46', fontWeight: 600, background: '#d1fae5', padding: '3px 10px', borderRadius: '6px', fontSize: '0.85rem' }}>
                              <Phone size={13} /> {b.phone}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {b.address ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                              <MapPin size={14} color="#7c3aed" /> {b.address}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            <button
                              onClick={() => handleEditBroker(b)}
                              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}
                              title="Edit Broker"
                            >
                              <Edit2 size={14} /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteBroker(b.id)}
                              style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}
                              title="Delete Broker"
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
