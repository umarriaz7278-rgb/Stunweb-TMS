import { useState, useEffect, Fragment } from 'react';
import { supabase } from '../supabaseClient';
import { Users, Plus, Trash2, X, ChevronDown, ChevronUp, FileText, DollarSign } from 'lucide-react';

// Generic Broker A/C page for any branch
// Receives branchName as a prop from App.jsx route
export default function BranchBrokerAC({ branchName }) {
  const [activeTab, setActiveTab] = useState('ledger');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));

  // Challans tab
  const [challans, setChallans] = useState([]);
  const [loadingChallans, setLoadingChallans] = useState(true);

  // Amount received tab
  const [received, setReceived] = useState([]);
  const [loadingReceived, setLoadingReceived] = useState(true);
  const [showReceivedForm, setShowReceivedForm] = useState(false);
  const [receivedForm, setReceivedForm] = useState({ date: new Date().toISOString().split('T')[0], description: '', amount: '' });
  const [savingReceived, setSavingReceived] = useState(false);

  // Broker list tab
  const brokerKey = `${branchName?.toLowerCase()}_broker_accounts`;
  const [brokers, setBrokers] = useState(() => {
    try { return JSON.parse(localStorage.getItem(brokerKey) || '[]'); } catch { return []; }
  });
  const [brokerForm, setBrokerForm] = useState({ name: '', phone: '', address: '' });
  const [showBrokerForm, setShowBrokerForm] = useState(false);
  const [savingBroker, setSavingBroker] = useState(false);

  // Expanded broker ledger
  const [expandedBroker, setExpandedBroker] = useState(null);
  const [brokerPayForm, setBrokerPayForm] = useState({ date: new Date().toISOString().split('T')[0], description: '', amount: '' });
  const [showBrokerPayForm, setShowBrokerPayForm] = useState(false);
  const [savingBrokerPay, setSavingBrokerPay] = useState(false);

  const [msg, setMsg] = useState({ text: '', type: '' });
  const showMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  useEffect(() => {
    if (branchName) {
      fetchChallans();
      fetchReceived();
    }
  }, [branchName]);

  async function fetchChallans() {
    setLoadingChallans(true);
    const { data: cbData } = await supabase
      .from('challan_bilties')
      .select('challan_id, bilties(destination_branch_id, branches(name))');

    const branchChallanIds = (cbData || [])
      .filter(cb => cb.bilties?.branches?.name === branchName)
      .map(cb => cb.challan_id);

    if (!branchChallanIds.length) { setChallans([]); setLoadingChallans(false); return; }

    const { data } = await supabase
      .from('challans')
      .select('id, challan_number, challan_date, vehicle_number, total_bilty_amount, commission_deduction, branch_deposit, broker_name')
      .in('id', branchChallanIds)
      .order('id', { ascending: false });

    if (data) setChallans(data);
    setLoadingChallans(false);
  }

  async function fetchReceived() {
    setLoadingReceived(true);
    const { data } = await supabase
      .from('branch_broker_received')
      .select('*')
      .eq('branch_name', branchName)
      .order('id', { ascending: false });
    if (data) setReceived(data);
    setLoadingReceived(false);
  }

  const handleAddReceived = async (e) => {
    e.preventDefault();
    if (!receivedForm.amount || parseFloat(receivedForm.amount) <= 0) {
      showMsg('Amount required.', 'error'); return;
    }
    setSavingReceived(true);
    const { error } = await supabase.from('branch_broker_received').insert([{
      branch_name: branchName,
      broker_name: '',
      date: receivedForm.date,
      description: receivedForm.description,
      amount: parseFloat(receivedForm.amount),
    }]);
    setSavingReceived(false);
    if (error) { showMsg('Error: ' + error.message, 'error'); }
    else { showMsg('Entry added!'); setReceivedForm({ date: new Date().toISOString().split('T')[0], description: '', amount: '' }); setShowReceivedForm(false); fetchReceived(); }
  };

  const handleDeleteReceived = async (id) => {
    await supabase.from('branch_broker_received').delete().eq('id', id);
    fetchReceived();
  };

  // Broker CRUD (localStorage)
  const saveBrokers = (list) => {
    setBrokers(list);
    localStorage.setItem(brokerKey, JSON.stringify(list));
  };

  const handleAddBroker = (e) => {
    e.preventDefault();
    if (!brokerForm.name.trim()) { showMsg('Broker name required.', 'error'); return; }
    setSavingBroker(true);
    const newBroker = { id: Date.now(), name: brokerForm.name.trim(), phone: brokerForm.phone.trim(), address: brokerForm.address.trim() };
    saveBrokers([...brokers, newBroker]);
    setBrokerForm({ name: '', phone: '', address: '' });
    setShowBrokerForm(false);
    setSavingBroker(false);
    showMsg('Broker account created!');
  };

  const handleDeleteBroker = (id) => {
    if (!window.confirm('Delete this broker account?')) return;
    saveBrokers(brokers.filter(b => b.id !== id));
    if (expandedBroker === id) setExpandedBroker(null);
    showMsg('Broker deleted.');
  };

  // Per-broker ledger
  const getBrokerChallans = (brokerName) => challans.filter(ch => ch.broker_name === brokerName);
  const getBrokerReceived = (brokerName) => received.filter(r => r.broker_name === brokerName || (r.description || '').includes(brokerName));

  const handleSaveBrokerPayment = async (broker, e) => {
    e.preventDefault();
    if (!brokerPayForm.amount || parseFloat(brokerPayForm.amount) <= 0) {
      showMsg('Amount required.', 'error'); return;
    }
    setSavingBrokerPay(true);
    const { error } = await supabase.from('branch_broker_received').insert([{
      branch_name: branchName,
      broker_name: broker.name,
      date: brokerPayForm.date,
      description: brokerPayForm.description || `Payment from ${broker.name}`,
      amount: parseFloat(brokerPayForm.amount),
    }]);
    setSavingBrokerPay(false);
    if (error) { showMsg('Error: ' + error.message, 'error'); }
    else { showMsg('Payment saved!'); setBrokerPayForm({ date: new Date().toISOString().split('T')[0], description: '', amount: '' }); setShowBrokerPayForm(false); fetchReceived(); }
  };

  const monthChallans = challans.filter(ch => {
    if (!filterMonth) return true;
    return (ch.challan_date?.slice(0, 7) === filterMonth) || !ch.challan_date;
  });
  const monthReceived = received.filter(r => {
    if (!filterMonth) return true;
    return r.date?.slice(0, 7) === filterMonth;
  });

  const totalReceivable = monthChallans.reduce((s, ch) => s + (parseFloat(ch.branch_deposit) || 0), 0);
  const totalReceived = monthReceived.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const balance = totalReceivable - totalReceived;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
        <Users size={26} color="var(--primary-color)" />
        <h1 className="page-title" style={{ marginBottom: 0 }}>Broker A/C — {branchName}</h1>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
        Track {branchName} branch broker accounts, challan receivables, and received payments.
      </p>

      {msg.text && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', background: msg.type === 'success' ? '#d1fae5' : '#fee2e2', color: msg.type === 'success' ? '#065f46' : '#991b1b', fontWeight: 600, fontSize: '0.88rem' }}>
          {msg.text}
        </div>
      )}

      {/* Month filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Month:</label>
        <input
          type="month"
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          style={{ padding: '6px 10px', fontSize: '0.85rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
        />
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '22px' }}>
        {[
          { label: 'Total Receivable', value: totalReceivable, color: '#6366f1' },
          { label: 'Total Received', value: totalReceived, color: '#10b981' },
          { label: 'Balance', value: balance, color: balance > 0 ? '#ef4444' : '#10b981' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', borderLeft: `4px solid ${c.color}` }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>{c.label}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: c.color }}>Rs. {c.value.toLocaleString('en-PK')}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', borderBottom: '2px solid var(--border)' }}>
        {[['ledger', 'Broker Ledger (Challans)'], ['received', 'Amount Received'], ['brokers', 'Broker Name List']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            padding: '8px 20px', fontSize: '0.88rem', fontWeight: 700, border: 'none',
            borderRadius: '8px 8px 0 0', cursor: 'pointer', marginBottom: '-2px',
            background: activeTab === key ? 'var(--primary)' : 'transparent',
            color: activeTab === key ? '#fff' : 'var(--text-muted)',
            borderBottom: activeTab === key ? '2px solid var(--primary)' : '2px solid transparent',
          }}>{label}</button>
        ))}
      </div>

      {/* TAB 1: Challan Ledger */}
      {activeTab === 'ledger' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{branchName} Challans — {filterMonth || 'All Time'}</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{monthChallans.length} challans</span>
          </div>
          {loadingChallans ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
          ) : monthChallans.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No challans for {filterMonth}.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                    {['#', 'Challan No', 'Date', 'Vehicle', 'Broker', 'Branch Deposit'].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthChallans.map((ch, i) => (
                    <tr key={ch.id} style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--primary-color)' }}>#{ch.challan_number || ch.id}</td>
                      <td style={{ padding: '10px 14px' }}>{ch.challan_date ? new Date(ch.challan_date + 'T00:00:00').toLocaleDateString('en-PK') : '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{ch.vehicle_number || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{ch.broker_name || '—'}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#16a34a' }}>Rs. {(parseFloat(ch.branch_deposit) || 0).toLocaleString('en-PK')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                    <td colSpan={5} style={{ padding: '10px 14px' }}>Monthly Total Receivable</td>
                    <td style={{ padding: '10px 14px', color: '#16a34a', fontSize: '0.95rem' }}>Rs. {totalReceivable.toLocaleString('en-PK')}</td>
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
          <div style={{ marginBottom: '14px' }}>
            <button onClick={() => { setShowReceivedForm(!showReceivedForm); setMsg({ text: '', type: '' }); }}
              className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 20px' }}>
              <Plus size={16} /> Add Received Amount
            </button>
          </div>
          {showReceivedForm && (
            <div className="card" style={{ padding: '20px', marginBottom: '18px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '0.95rem', fontWeight: 700 }}>New Entry</h3>
              <form onSubmit={handleAddReceived}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group"><label>Date</label><input type="date" name="date" value={receivedForm.date} onChange={e => setReceivedForm(p => ({...p, date: e.target.value}))} required /></div>
                  <div className="form-group"><label>Description</label><input type="text" name="description" value={receivedForm.description} onChange={e => setReceivedForm(p => ({...p, description: e.target.value}))} placeholder="e.g. Broker payment" /></div>
                  <div className="form-group"><label>Amount <span style={{ color: 'red' }}>*</span></label><input type="number" value={receivedForm.amount} onChange={e => setReceivedForm(p => ({...p, amount: e.target.value}))} min="0" step="0.01" placeholder="0" required /></div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary" disabled={savingReceived} style={{ padding: '8px 20px' }}>{savingReceived ? 'Saving...' : 'Save'}</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowReceivedForm(false)} style={{ padding: '8px 20px' }}>Cancel</button>
                </div>
              </form>
            </div>
          )}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Amount Received — {filterMonth || 'All Time'}</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{monthReceived.length} entries</span>
            </div>
            {loadingReceived ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
              : monthReceived.length === 0 ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No entries for {filterMonth}.</div>
              : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                      {['#', 'Date', 'Broker', 'Description', 'Amount', 'Action'].map((h, i) => (
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
                        <td style={{ padding: '10px 14px' }}>{r.broker_name || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>{r.description || '—'}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#10b981' }}>Rs. {(parseFloat(r.amount) || 0).toLocaleString('en-PK')}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <button onClick={() => handleDeleteReceived(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}>
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                      <td colSpan={4} style={{ padding: '10px 14px' }}>Monthly Total Received</td>
                      <td style={{ padding: '10px 14px', color: '#10b981', fontSize: '0.95rem' }}>Rs. {totalReceived.toLocaleString('en-PK')}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Broker Name List */}
      {activeTab === 'brokers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e40af' }}>Broker Name List — {branchName}</h2>
            <button onClick={() => setShowBrokerForm(!showBrokerForm)} className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 20px' }}>
              <Plus size={16} /> Add New Broker
            </button>
          </div>

          {showBrokerForm && (
            <div className="card" style={{ padding: '20px', marginBottom: '18px', borderTop: '4px solid #2563eb' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '0.95rem', fontWeight: 700 }}>New Broker Account</h3>
              <form onSubmit={handleAddBroker}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group"><label>Broker Name <span style={{ color: 'red' }}>*</span></label><input type="text" value={brokerForm.name} onChange={e => setBrokerForm(p => ({...p, name: e.target.value}))} placeholder="e.g. Ali Traders" required /></div>
                  <div className="form-group"><label>Mobile Number</label><input type="text" value={brokerForm.phone} onChange={e => setBrokerForm(p => ({...p, phone: e.target.value}))} placeholder="e.g. 0321-1234567" /></div>
                  <div className="form-group"><label>Address</label><input type="text" value={brokerForm.address} onChange={e => setBrokerForm(p => ({...p, address: e.target.value}))} placeholder="e.g. Main Market, City" /></div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary" disabled={savingBroker} style={{ padding: '8px 20px' }}>{savingBroker ? 'Saving...' : 'Save Broker'}</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowBrokerForm(false)} style={{ padding: '8px 20px' }}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {brokers.length === 0 ? (
            <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No broker accounts yet. Click "Add New Broker" to create one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {brokers.map(broker => {
                const bChallans = getBrokerChallans(broker.name);
                const bReceived = getBrokerReceived(broker.name);
                const bReceivable = bChallans.reduce((s, ch) => s + (parseFloat(ch.branch_deposit) || 0), 0);
                const bReceivedTotal = bReceived.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                const bBalance = bReceivable - bReceivedTotal;
                const isExpanded = expandedBroker === broker.id;

                return (
                  <Fragment key={broker.id}>
                    <div className="card" style={{ padding: '16px 20px', border: isExpanded ? '2px solid #2563eb' : '1px solid var(--border)', transition: 'border 0.2s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1e40af' }}>{broker.name}</div>
                          {broker.phone && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>📞 {broker.phone}</div>}
                          {broker.address && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>📍 {broker.address}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: bBalance > 0 ? '#ef4444' : '#10b981', background: bBalance > 0 ? '#fee2e2' : '#d1fae5', padding: '4px 10px', borderRadius: '6px' }}>
                            Balance: Rs. {bBalance.toLocaleString('en-PK')}
                          </span>
                          <button
                            onClick={() => { setExpandedBroker(isExpanded ? null : broker.id); setShowBrokerPayForm(false); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '0.82rem', fontWeight: 700, border: '1.5px solid #2563eb', borderRadius: '8px', cursor: 'pointer', background: isExpanded ? '#2563eb' : '#eff6ff', color: isExpanded ? '#fff' : '#1e40af' }}>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {isExpanded ? 'Hide Ledger' : 'View Ledger'}
                          </button>
                          <button onClick={() => handleDeleteBroker(broker.id)}
                            style={{ background: 'none', border: '1.5px solid #ef4444', borderRadius: '8px', cursor: 'pointer', color: '#ef4444', padding: '7px 10px', display: 'flex', alignItems: 'center' }}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                          {/* Stat Cards */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                            {[
                              { label: 'Challans Linked', value: bChallans.length, color: '#6366f1', isCount: true },
                              { label: 'Total Receivable', value: bReceivable, color: '#d97706' },
                              { label: 'Total Received', value: bReceivedTotal, color: '#10b981' },
                              { label: 'Remaining Balance', value: bBalance, color: bBalance > 0 ? '#ef4444' : '#10b981' },
                            ].map(c => (
                              <div key={c.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', borderLeft: `3px solid ${c.color}` }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>{c.label}</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: c.color }}>{c.isCount ? bChallans.length : `Rs. ${c.value.toLocaleString('en-PK')}`}</div>
                              </div>
                            ))}
                          </div>

                          {/* Two column grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                            {/* Challans table */}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <FileText size={16} color="#6366f1" />
                                <strong style={{ fontSize: '0.88rem', color: '#1e40af' }}>Challans</strong>
                              </div>
                              {bChallans.length === 0 ? (
                                <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>No challans linked</div>
                              ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                  <thead>
                                    <tr style={{ background: 'var(--bg-secondary)' }}>
                                      <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Date</th>
                                      <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Challan #</th>
                                      <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Vehicle</th>
                                      <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>Receivable</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {bChallans.map(ch => (
                                      <tr key={ch.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '7px 10px' }}>{ch.challan_date ? new Date(ch.challan_date + 'T00:00:00').toLocaleDateString('en-PK') : '—'}</td>
                                        <td style={{ padding: '7px 10px', fontWeight: 700, color: 'var(--primary-color)' }}>#{ch.challan_number}</td>
                                        <td style={{ padding: '7px 10px' }}>{ch.vehicle_number || '—'}</td>
                                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#d97706' }}>Rs. {(parseFloat(ch.branch_deposit) || 0).toLocaleString('en-PK')}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>

                            {/* Received payments */}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <DollarSign size={16} color="#10b981" />
                                <strong style={{ fontSize: '0.88rem', color: '#065f46' }}>Received Payments</strong>
                              </div>
                              {bReceived.length === 0 ? (
                                <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>No payments yet</div>
                              ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                  <thead>
                                    <tr style={{ background: 'var(--bg-secondary)' }}>
                                      <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Date</th>
                                      <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Description</th>
                                      <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {bReceived.map(r => (
                                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '7px 10px' }}>{r.date ? new Date(r.date).toLocaleDateString('en-PK') : '—'}</td>
                                        <td style={{ padding: '7px 10px' }}>{r.description || '—'}</td>
                                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>Rs. {(parseFloat(r.amount) || 0).toLocaleString('en-PK')}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>

                          {/* Receive Amount form */}
                          <div>
                            <button
                              onClick={() => setShowBrokerPayForm(!showBrokerPayForm)}
                              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', fontSize: '0.85rem', fontWeight: 700, border: 'none', borderRadius: '8px', cursor: 'pointer', background: '#10b981', color: '#fff', marginBottom: '12px' }}>
                              <Plus size={15} /> Receive Amount
                            </button>
                            {showBrokerPayForm && (
                              <form onSubmit={(e) => handleSaveBrokerPayment(broker, e)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', background: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px' }}>
                                <div className="form-group" style={{ margin: 0 }}><label style={{ fontSize: '0.82rem' }}>Date</label><input type="date" value={brokerPayForm.date} onChange={e => setBrokerPayForm(p => ({...p, date: e.target.value}))} required /></div>
                                <div className="form-group" style={{ margin: 0 }}><label style={{ fontSize: '0.82rem' }}>Description</label><input type="text" value={brokerPayForm.description} onChange={e => setBrokerPayForm(p => ({...p, description: e.target.value}))} placeholder="Optional" /></div>
                                <div className="form-group" style={{ margin: 0 }}><label style={{ fontSize: '0.82rem' }}>Amount <span style={{ color: 'red' }}>*</span></label><input type="number" value={brokerPayForm.amount} onChange={e => setBrokerPayForm(p => ({...p, amount: e.target.value}))} min="0" step="0.01" placeholder="0" required /></div>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                                  <button type="submit" className="btn btn-primary" disabled={savingBrokerPay} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>{savingBrokerPay ? 'Saving...' : 'Save'}</button>
                                  <button type="button" className="btn btn-secondary" onClick={() => setShowBrokerPayForm(false)} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>Cancel</button>
                                </div>
                              </form>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </Fragment>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
