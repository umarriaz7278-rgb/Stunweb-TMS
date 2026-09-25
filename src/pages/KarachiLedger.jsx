import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { applyTenantFilter, withTenantId } from '../utils/tenantStorage';
import { useSettings } from '../context/SettingsContext';

export default function KarachiLedger() {
  const { companyName } = useSettings();
  const activeCompanyName = companyName || 'GUL-E-PAKISTAN GOODS';
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Filters
  const [filterType, setFilterType] = useState('all'); // all, date, month
  const [filterDate, setFilterDate] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  // Forms
  const [incomeForm, setIncomeForm] = useState({ date: new Date().toISOString().split('T')[0], description: '', amount: '' });
  const [expenseForm, setExpenseForm] = useState({ date: new Date().toISOString().split('T')[0], description: '', amount: '' });

  useEffect(() => {
    fetchLedgers();
  }, []);

  async function fetchLedgers() {
    let q = supabase.from('karachi_ledgers').select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false });
    q = applyTenantFilter(q);
    const { data, error } = await q;
    if (data) setLedgers(data);
  }

  const handleIncomeChange = (e) => setIncomeForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleExpenseChange = (e) => setExpenseForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const submitEntry = async (e, type) => {
    e.preventDefault();
    setLoading(true); setMessage('');
    
    const form = type === 'income' ? incomeForm : expenseForm;
    const { error } = await supabase.from('karachi_ledgers').insert([withTenantId({
      entry_date: form.date,
      entry_type: type,
      description: form.description,
      amount: Number(form.amount) || 0
    })]);

    if (!error) {
      if(type === 'income') setIncomeForm({ date: new Date().toISOString().split('T')[0], description: '', amount: '' });
      if(type === 'expense') setExpenseForm({ date: new Date().toISOString().split('T')[0], description: '', amount: '' });
      setMessage(`Successfully recorded ${type} entry!`);
      fetchLedgers();
    } else {
      setMessage(`Error recording entry: ${error.message}`);
    }
    setLoading(false);
  };

  const deleteEntry = async (id) => {
    const ok = window.confirm('Kya aap yaqeen se is entry ko delete karna chahte hain? Yeh action wapas nahi ho sakta.');
    if (!ok) return;
    const { error } = await supabase.from('karachi_ledgers').delete().eq('id', id);
    if (!error) {
      setMessage('Entry successfully delete ho gayi!');
      fetchLedgers();
    } else {
      setMessage(`Error deleting entry: ${error.message}`);
    }
  };

  // --- Calculations & Filtering ---
  const filteredData = ledgers.filter(entry => {
    if (filterType === 'all') return true;
    if (filterType === 'date' && filterDate) return entry.entry_date === filterDate;
    if (filterType === 'month' && filterMonth) return entry.entry_date.startsWith(filterMonth);
    return true;
  });

  let totalIncome = 0;
  let totalExpense = 0;

  filteredData.forEach(entry => {
    if (entry.entry_type === 'income') totalIncome += Number(entry.amount);
    if (entry.entry_type === 'expense') totalExpense += Number(entry.amount);
  });

  const currentBalance = totalIncome - totalExpense;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Wallet size={28} color="var(--primary-color)" />
        <h1 className="page-title" style={{ marginBottom: 0 }}>Karachi Office Income & Expense</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              const ok = window.confirm('You are about to generate a printable A4 report for Karachi Office. Have you obtained permission to proceed?');
              if (!ok) return;
              const filtered = filteredData;
              const summary = { totalIncome, totalExpense, balance: currentBalance };
              const html = `
                <div style="font-family: Arial, Helvetica, sans-serif; padding: 16px;">
                  <div style="text-align:center; margin-bottom:12px;">
                    <h1 style="margin:0; font-size:20px;">${activeCompanyName}</h1>
                    <div style="font-weight:700; margin-top:6px;">Karachi Office Income & Expense</div>
                    <div style="color:#666; margin-top:4px;">Generated: ${new Date().toLocaleDateString()}</div>
                  </div>
                  <div style="display:flex; gap:12px; margin-top:12px;">
                    <div style="flex:1; padding:12px; border:1px solid #eee; text-align:center;">
                      <div style="color:#777">Total Income</div>
                      <div style="font-size:18px; font-weight:700; color:#10b981; margin-top:6px;">${summary.totalIncome.toLocaleString()}</div>
                    </div>
                    <div style="flex:1; padding:12px; border:1px solid #eee; text-align:center;">
                      <div style="color:#777">Total Expense</div>
                      <div style="font-size:18px; font-weight:700; color:#ef4444; margin-top:6px;">${summary.totalExpense.toLocaleString()}</div>
                    </div>
                    <div style="flex:1; padding:12px; border:1px solid #eee; text-align:center;">
                      <div style="color:#777">Current Balance</div>
                      <div style="font-size:18px; font-weight:700; margin-top:6px;">${summary.balance.toLocaleString()}</div>
                    </div>
                  </div>
                  <table style="width:100%; border-collapse:collapse; margin-top:18px;">
                    <thead>
                      <tr>
                        <th style="border:1px solid #ddd; padding:8px; text-align:left;">Date</th>
                        <th style="border:1px solid #ddd; padding:8px; text-align:left;">Type</th>
                        <th style="border:1px solid #ddd; padding:8px; text-align:left;">Description</th>
                        <th style="border:1px solid #ddd; padding:8px; text-align:right;">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${filtered.map(entry => `
                        <tr>
                          <td style="border:1px solid #ddd; padding:8px;">${entry.entry_date}</td>
                          <td style="border:1px solid #ddd; padding:8px;">${entry.entry_type}</td>
                          <td style="border:1px solid #ddd; padding:8px;">${entry.description}</td>
                          <td style="border:1px solid #ddd; padding:8px; text-align:right;">${Number(entry.amount).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                  </table>
                  <div style="text-align:center; color:#999; font-size:12px; margin-top:24px;">This is an auto-generated report from ${activeCompanyName} System</div>
                </div>
              `;
              const container = document.createElement('div');
              container.style.width = '210mm';
              container.innerHTML = html;
              document.body.appendChild(container);
              try {
                const { default: html2pdf } = await import('html2pdf.js');
                await html2pdf().set({
                  margin: [10,10,10,10],
                  filename: `Karachi_Office_Report_${new Date().toISOString().slice(0,10)}.pdf`,
                  image: { type: 'jpeg', quality: 0.98 },
                  html2canvas: { scale: 2, useCORS: true },
                  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                }).from(container).save();
              } catch (err) {
                console.error('PDF export failed:', err);
                setMessage(`PDF export failed: ${err.message || err}`);
              } finally {
                document.body.removeChild(container);
              }
            }}
          >
            Print / PDF
          </button>
        </div>
      </div>

      {message && (
        <div style={{ padding: '12px', marginBottom: '20px', borderRadius: '6px', backgroundColor: message.includes('Error') ? '#fee2e2' : '#d1fae5', color: message.includes('Error') ? '#991b1b' : '#065f46' }}>
          {message}
        </div>
      )}

      {/* --- Filter Section --- */}
      <div className="card" style={{ marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
         <strong style={{ minWidth: '100px' }}>Filter View:</strong>
         <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
           <option value="all">Overall Lifetime</option>
           <option value="date">Specific Date</option>
           <option value="month">Specific Month</option>
         </select>

         {filterType === 'date' && (
           <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
         )}

         {filterType === 'month' && (
           <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
         )}
      </div>

      {/* --- Totals Display --- */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><TrendingUp size={16} /> Total Income</div>
          <div className="stat-value" style={{ color: '#10b981' }}>{totalIncome.toLocaleString()}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="stat-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><TrendingDown size={16} /> Total Expense</div>
          <div className="stat-value" style={{ color: '#ef4444' }}>{totalExpense.toLocaleString()}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: `4px solid ${currentBalance >= 0 ? '#3b82f6' : '#f59e0b'}` }}>
          <div className="stat-title">Current Balance</div>
          <div className="stat-value" style={{ color: currentBalance >= 0 ? '#3b82f6' : '#f59e0b' }}>{currentBalance.toLocaleString()}</div>
        </div>
      </div>

      {/* --- Forms Section --- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Record Income */}
        <div className="card" style={{ border: '1.5px solid #86efac', borderTop: '5px solid #10b981', borderRadius: '12px', padding: '22px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.08)' }}>
           <h3 style={{ color: '#047857', marginBottom: '18px', fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
             <TrendingUp size={22} color="#10b981" /> + Record Income
           </h3>
           <form onSubmit={(e) => submitEntry(e, 'income')}>
             <div className="form-group" style={{ marginBottom: '14px' }}>
               <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#065f46', marginBottom: '6px', display: 'block' }}>Date</label>
               <input 
                 type="date" 
                 name="date" 
                 value={incomeForm.date} 
                 onChange={handleIncomeChange} 
                 required 
                 style={{ width: '100%', height: '46px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: '#fff', boxSizing: 'border-box' }}
               />
             </div>
             <div className="form-group" style={{ marginBottom: '14px' }}>
               <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#065f46', marginBottom: '6px', display: 'block' }}>Description</label>
               <input 
                 type="text" 
                 name="description" 
                 value={incomeForm.description} 
                 onChange={handleIncomeChange} 
                 required 
                 placeholder="e.g. Booking Income, Freight, etc."
                 style={{ width: '100%', height: '46px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: '#fff', boxSizing: 'border-box' }}
               />
             </div>
             <div className="form-group" style={{ marginBottom: '18px' }}>
               <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#065f46', marginBottom: '6px', display: 'block' }}>Amount (Rs.)</label>
               <input 
                 type="number" 
                 min="0" 
                 step="0.01" 
                 name="amount" 
                 value={incomeForm.amount} 
                 onChange={handleIncomeChange} 
                 required 
                 placeholder="0.00"
                 style={{ width: '100%', height: '48px', padding: '10px 14px', fontSize: '1.15rem', fontWeight: 800, borderRadius: '8px', border: '2px solid #10b981', backgroundColor: '#f0fdf4', color: '#065f46', boxSizing: 'border-box' }}
               />
             </div>
             <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#10b981', border: 'none', width: '100%', height: '48px', fontSize: '1.05rem', fontWeight: 800, borderRadius: '8px', cursor: 'pointer' }} disabled={loading}>
               {loading ? 'Saving...' : 'Save Income'}
             </button>
           </form>
        </div>

        {/* Record Expense */}
        <div className="card" style={{ border: '1.5px solid #fca5a5', borderTop: '5px solid #ef4444', borderRadius: '12px', padding: '22px', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.08)' }}>
           <h3 style={{ color: '#b91c1c', marginBottom: '18px', fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
             <TrendingDown size={22} color="#ef4444" /> - Record Expense
           </h3>
           <form onSubmit={(e) => submitEntry(e, 'expense')}>
             <div className="form-group" style={{ marginBottom: '14px' }}>
               <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#991b1b', marginBottom: '6px', display: 'block' }}>Date</label>
               <input 
                 type="date" 
                 name="date" 
                 value={expenseForm.date} 
                 onChange={handleExpenseChange} 
                 required 
                 style={{ width: '100%', height: '46px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: '#fff', boxSizing: 'border-box' }}
               />
             </div>
             <div className="form-group" style={{ marginBottom: '14px' }}>
               <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#991b1b', marginBottom: '6px', display: 'block' }}>Description</label>
               <input 
                 type="text" 
                 name="description" 
                 value={expenseForm.description} 
                 onChange={handleExpenseChange} 
                 required 
                 placeholder="e.g. Office Expense, Fuel, Tea, etc."
                 style={{ width: '100%', height: '46px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: '#fff', boxSizing: 'border-box' }}
               />
             </div>
             <div className="form-group" style={{ marginBottom: '18px' }}>
               <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#991b1b', marginBottom: '6px', display: 'block' }}>Amount Spent (Rs.)</label>
               <input 
                 type="number" 
                 min="0" 
                 step="0.01" 
                 name="amount" 
                 value={expenseForm.amount} 
                 onChange={handleExpenseChange} 
                 required 
                 placeholder="0.00"
                 style={{ width: '100%', height: '48px', padding: '10px 14px', fontSize: '1.15rem', fontWeight: 800, borderRadius: '8px', border: '2px solid #ef4444', backgroundColor: '#fef2f2', color: '#991b1b', boxSizing: 'border-box' }}
               />
             </div>
             <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#ef4444', border: 'none', width: '100%', height: '48px', fontSize: '1.05rem', fontWeight: 800, borderRadius: '8px', cursor: 'pointer' }} disabled={loading}>
               {loading ? 'Saving...' : 'Save Expense'}
             </button>
           </form>
        </div>
      </div>

      {/* --- Running Records --- */}
      <div className="card">
         <h3>Ledger Records (Filtered)</h3>
         <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginTop: '16px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '12px' }}>Date</th>
                <th style={{ padding: '12px' }}>Type</th>
                <th style={{ padding: '12px' }}>Description</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((entry, index) => (
                <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px' }}>{entry.entry_date}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', backgroundColor: entry.entry_type === 'income' ? '#d1fae5' : '#fee2e2', color: entry.entry_type === 'income' ? '#065f46' : '#991b1b'}}>
                      {entry.entry_type.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>{entry.description}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>{Number(entry.amount).toLocaleString()}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                      title="Delete Entry"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No records match the selected filter.</td></tr>}
            </tbody>
         </table>
      </div>
    </div>
  );
}
