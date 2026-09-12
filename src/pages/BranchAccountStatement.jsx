import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FileText, Plus, X, Lock, Unlock } from 'lucide-react';

// Generic Account Statement page for any branch
// Receives branchName as a prop from App.jsx route
export default function BranchAccountStatement({ branchName }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    entry_type: 'debit',
    description: '',
    amount: ''
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const closedKey = `account_stmt_${branchName?.toLowerCase()}_closed`;
  const [closedMonths, setClosedMonths] = useState(() => {
    try { return JSON.parse(localStorage.getItem(closedKey) || '[]'); } catch { return []; }
  });
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const isClosed = closedMonths.includes(filterMonth);

  const toggleClose = () => {
    const updated = isClosed
      ? closedMonths.filter(m => m !== filterMonth)
      : [...closedMonths, filterMonth];
    setClosedMonths(updated);
    localStorage.setItem(closedKey, JSON.stringify(updated));
  };

  const showNotif = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  useEffect(() => {
    if (branchName) fetchEntries();
  }, [branchName]);

  async function fetchEntries() {
    setLoading(true);
    const { data, error } = await supabase
      .from('branch_account_entries')
      .select('*')
      .eq('branch_name', branchName)
      .order('entry_date', { ascending: false });
    if (error) console.error('branch_account_entries error:', error.message);
    if (data) setEntries(data);
    setLoading(false);
  }

  const handleFormChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAddEntry = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      showNotif('Amount required.', 'error'); return;
    }
    setSaving(true);
    const { error } = await supabase.from('branch_account_entries').insert([{
      branch_name: branchName,
      entry_date: form.entry_date,
      entry_type: form.entry_type,
      description: form.description,
      amount: parseFloat(form.amount),
    }]);
    setSaving(false);
    if (error) { showNotif('Error: ' + error.message, 'error'); }
    else {
      showNotif('Entry added!');
      setForm({ entry_date: new Date().toISOString().split('T')[0], entry_type: 'debit', description: '', amount: '' });
      setShowForm(false);
      fetchEntries();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    await supabase.from('branch_account_entries').delete().eq('id', id);
    fetchEntries();
  };

  // Filter by month
  const monthEntries = entries.filter(e => {
    if (!filterMonth) return true;
    return e.entry_date?.slice(0, 7) === filterMonth;
  });

  const totalDebits = monthEntries.filter(e => e.entry_type === 'debit').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalCredits = monthEntries.filter(e => e.entry_type === 'credit').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const netBalance = totalDebits - totalCredits;

  // Running balance
  const sortedEntries = [...monthEntries].sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date));
  let runningBalance = 0;
  const entriesWithBalance = sortedEntries.map(e => {
    if (e.entry_type === 'debit') runningBalance += parseFloat(e.amount) || 0;
    else runningBalance -= parseFloat(e.amount) || 0;
    return { ...e, runningBalance };
  }).reverse();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FileText size={26} color="var(--primary-color)" />
          <h1 className="page-title" style={{ marginBottom: 0 }}>Account Statement — {branchName}</h1>
        </div>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
        Track {branchName} branch debit and credit account entries.
      </p>

      {msg.text && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', background: msg.type === 'success' ? '#d1fae5' : '#fee2e2', color: msg.type === 'success' ? '#065f46' : '#991b1b', fontWeight: 600, fontSize: '0.88rem' }}>
          {msg.text}
        </div>
      )}

      {/* Month filter + close */}
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
        <button onClick={toggleClose} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 16px', fontSize: '0.82rem', fontWeight: 700,
          border: 'none', borderRadius: '8px', cursor: 'pointer',
          background: isClosed ? '#10b981' : '#ef4444', color: '#fff'
        }}>
          {isClosed ? <><Unlock size={14} /> Reopen Month</> : <><Lock size={14} /> Close This Month</>}
        </button>
        {isClosed && (
          <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600, background: '#d1fae5', padding: '4px 10px', borderRadius: '6px' }}>
            📌 Month Closed (read-only)
          </span>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '22px' }}>
        {[
          { label: 'Total Debits', value: totalDebits, color: '#ef4444' },
          { label: 'Total Credits', value: totalCredits, color: '#10b981' },
          { label: 'Net Balance (Dr - Cr)', value: netBalance, color: netBalance > 0 ? '#ef4444' : '#10b981' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', borderLeft: `4px solid ${c.color}` }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>{c.label}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: c.color }}>Rs. {c.value.toLocaleString('en-PK')}</div>
          </div>
        ))}
      </div>

      {/* Add Entry */}
      {!isClosed && (
        <div style={{ marginBottom: '14px' }}>
          <button onClick={() => { setShowForm(!showForm); setMsg({ text: '', type: '' }); }}
            className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 20px' }}>
            <Plus size={16} /> Add Entry
          </button>
        </div>
      )}

      {showForm && !isClosed && (
        <div className="card" style={{ padding: '20px', marginBottom: '18px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '0.95rem', fontWeight: 700 }}>New Account Entry</h3>
          <form onSubmit={handleAddEntry}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group">
                <label>Date</label>
                <input type="date" name="entry_date" value={form.entry_date} onChange={handleFormChange} required />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select name="entry_type" value={form.entry_type} onChange={handleFormChange}
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.95rem', border: '1.5px solid var(--border)', borderRadius: '6px', background: 'var(--bg-secondary)' }}>
                  <option value="debit">Debit (Dr)</option>
                  <option value="credit">Credit (Cr)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <input type="text" name="description" value={form.description} onChange={handleFormChange} placeholder="e.g. Payment from customer" />
              </div>
              <div className="form-group">
                <label>Amount <span style={{ color: 'red' }}>*</span></label>
                <input type="number" name="amount" value={form.amount} onChange={handleFormChange} min="0" step="0.01" placeholder="0" required />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '8px 20px' }}>{saving ? 'Saving...' : 'Save'}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} style={{ padding: '8px 20px' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Entries Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{branchName} Account Entries — {filterMonth || 'All Time'}</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{monthEntries.length} entries</span>
        </div>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : monthEntries.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No entries for {filterMonth}.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                  {['#', 'Date', 'Type', 'Description', 'Amount', 'Running Balance', isClosed ? '' : 'Action'].map((h, i) => (
                    <th key={i} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entriesWithBalance.map((e, i) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={ev => ev.currentTarget.style.background = ''}>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ padding: '10px 14px' }}>{e.entry_date ? new Date(e.entry_date + 'T00:00:00').toLocaleDateString('en-PK') : '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.78rem', padding: '3px 8px', borderRadius: '4px', background: e.entry_type === 'debit' ? '#fee2e2' : '#d1fae5', color: e.entry_type === 'debit' ? '#991b1b' : '#065f46' }}>
                        {e.entry_type === 'debit' ? 'Dr' : 'Cr'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>{e.description || '—'}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: e.entry_type === 'debit' ? '#ef4444' : '#10b981' }}>
                      Rs. {(parseFloat(e.amount) || 0).toLocaleString('en-PK')}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: e.runningBalance > 0 ? '#ef4444' : '#10b981' }}>
                      Rs. {e.runningBalance.toLocaleString('en-PK')}
                    </td>
                    {!isClosed && (
                      <td style={{ padding: '10px 14px' }}>
                        <button onClick={() => handleDelete(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}>
                          <X size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                  <td colSpan={4} style={{ padding: '10px 14px' }}>Monthly Total</td>
                  <td colSpan={2} style={{ padding: '10px 14px', color: netBalance > 0 ? '#ef4444' : '#10b981', fontSize: '0.95rem' }}>
                    Net: Rs. {netBalance.toLocaleString('en-PK')}
                  </td>
                  {!isClosed && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
