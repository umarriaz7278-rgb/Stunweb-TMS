import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { DollarSign, TrendingUp, TrendingDown, Wallet, Calendar, Filter } from 'lucide-react';

export default function BranchFinance({ branchName }) {
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Filters
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Forms
  const [incomeForm, setIncomeForm] = useState({ 
    date: new Date().toISOString().split('T')[0], 
    description: '', 
    amount: '' 
  });
  const [expenseForm, setExpenseForm] = useState({ 
    date: new Date().toISOString().split('T')[0], 
    description: '', 
    amount: '' 
  });

  useEffect(() => {
    fetchLedgers();
  }, [branchName, filterMonth]);

  async function fetchLedgers() {
    setLoading(true);
    // Fetch all records for the specific branch
    const { data, error } = await supabase
      .from('branch_ledgers')
      .select('*')
      .eq('branch_name', branchName)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) setLedgers(data);
    if (error) console.error('Error fetching ledgers:', error);
    setLoading(false);
  }

  const handleIncomeChange = (e) => setIncomeForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleExpenseChange = (e) => setExpenseForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const submitEntry = async (e, type) => {
    e.preventDefault();
    setLoading(true); setMessage('');
    
    const form = type === 'income' ? incomeForm : expenseForm;
    const { error } = await supabase.from('branch_ledgers').insert([{
      branch_name: branchName,
      entry_date: form.date,
      entry_type: type,
      description: form.description,
      amount: Number(form.amount) || 0
    }]);

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

  // --- Calculations & Filtering ---
  const filteredData = ledgers.filter(entry => {
    if (!filterMonth) return true;
    return entry.entry_date.startsWith(filterMonth);
  });

  let totalIncome = 0;
  let totalExpense = 0;

  filteredData.forEach(entry => {
    if (entry.entry_type === 'income') totalIncome += Number(entry.amount);
    if (entry.entry_type === 'expense') totalExpense += Number(entry.amount);
  });

  const monthlyProfit = totalIncome - totalExpense;
  
  const calculateRunningBalance = (index) => {
    let balance = 0;
    // Entries are sorted descending by date/created_at, so we calculate from bottom up
    for (let i = filteredData.length - 1; i >= index; i--) {
      if (filteredData[i].entry_type === 'income') balance += Number(filteredData[i].amount);
      else balance -= Number(filteredData[i].amount);
    }
    return balance;
  };

  return (
    <div className="branch-finance-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Wallet size={32} color="var(--primary-color)" />
          <div>
            <h1 className="page-title" style={{ marginBottom: 0 }}>{branchName} Branch Finance</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Income, Expense & Profit Management</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#fff', padding: '8px 16px', borderRadius: '8px', boxShadow: 'var(--card-shadow)' }}>
          <Filter size={18} color="var(--primary-color)" />
          <strong style={{ fontSize: '0.9rem' }}>Select Month:</strong>
          <input 
            type="month" 
            value={filterMonth} 
            onChange={(e) => setFilterMonth(e.target.value)} 
            style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '0.9rem' }} 
          />
        </div>
      </div>

      {message && (
        <div style={{ 
          padding: '12px 16px', 
          marginBottom: '24px', 
          borderRadius: '8px', 
          backgroundColor: message.includes('Error') ? '#fee2e2' : '#d1fae5', 
          color: message.includes('Error') ? '#991b1b' : '#065f46',
          border: `1px solid ${message.includes('Error') ? '#fecaca' : '#a7f3d0'}`
        }}>
          {message}
        </div>
      )}

      {/* --- Profit Summary Cards --- */}
      <div className="stats-grid" style={{ marginBottom: '32px' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingUp size={16} /> Monthly Income ({filterMonth})
          </div>
          <div className="stat-value" style={{ color: '#10b981' }}>Rs. {totalIncome.toLocaleString()}</div>
        </div>
        
        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="stat-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingDown size={16} /> Monthly Expense ({filterMonth})
          </div>
          <div className="stat-value" style={{ color: '#ef4444' }}>Rs. {totalExpense.toLocaleString()}</div>
        </div>
        
        <div className="stat-card" style={{ borderLeft: `4px solid ${monthlyProfit >= 0 ? 'var(--primary-color)' : '#f59e0b'}` }}>
          <div className="stat-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} /> Total Monthly Profit
          </div>
          <div className="stat-value" style={{ color: monthlyProfit >= 0 ? 'var(--primary-color)' : '#f59e0b' }}>
            Rs. {monthlyProfit.toLocaleString()}
          </div>
        </div>
      </div>

      {/* --- Income & Expense Entry Forms --- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {/* Income Form */}
        <div className="card" style={{ border: '1px solid #d1fae5', borderTop: '4px solid #10b981' }}>
           <h3 style={{ color: '#065f46', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
             <TrendingUp size={20} /> Record New Income
           </h3>
           <form onSubmit={(e) => submitEntry(e, 'income')}>
             <div className="form-group">
               <label>Transaction Date</label>
               <input type="date" name="date" value={incomeForm.date} onChange={handleIncomeChange} required/>
             </div>
             <div className="form-group">
               <label>Description / Source</label>
               <input type="text" name="description" value={incomeForm.description} onChange={handleIncomeChange} required placeholder="e.g. Delivery Payment from Ali" />
             </div>
             <div className="form-group">
               <label>Amount (Rs.)</label>
               <input 
                 type="number" min="0" step="0.01" name="amount" 
                 value={incomeForm.amount} onChange={handleIncomeChange} required 
                 style={{ border: '2px solid #10b981', fontWeight: 'bold' }}
               />
             </div>
             <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#10b981', border: 'none', width: '100%', marginTop: '8px' }} disabled={loading}>
               {loading ? 'Saving...' : 'Save Income Entry'}
             </button>
           </form>
        </div>

        {/* Expense Form */}
        <div className="card" style={{ border: '1px solid #fee2e2', borderTop: '4px solid #ef4444' }}>
           <h3 style={{ color: '#991b1b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
             <TrendingDown size={20} /> Record New Expense
           </h3>
           <form onSubmit={(e) => submitEntry(e, 'expense')}>
             <div className="form-group">
               <label>Transaction Date</label>
               <input type="date" name="date" value={expenseForm.date} onChange={handleExpenseChange} required/>
             </div>
             <div className="form-group">
               <label>Description / Purpose</label>
               <input type="text" name="description" value={expenseForm.description} onChange={handleExpenseChange} required placeholder="e.g. Office Rent or Utility Bill" />
             </div>
             <div className="form-group">
               <label>Amount Spent (Rs.)</label>
               <input 
                 type="number" min="0" step="0.01" name="amount" 
                 value={expenseForm.amount} onChange={handleExpenseChange} required 
                 style={{ border: '2px solid #ef4444', fontWeight: 'bold' }}
               />
             </div>
             <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#ef4444', border: 'none', width: '100%', marginTop: '8px' }} disabled={loading}>
               {loading ? 'Saving...' : 'Save Expense Entry'}
             </button>
           </form>
        </div>
      </div>

      {/* --- Ledger Records --- */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
         <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Finance Ledger - {filterMonth}</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Showing {ledgers.length} entries</span>
         </div>
         <div style={{ overflowX: 'auto' }}>
           <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '16px' }}>Date</th>
                  <th style={{ padding: '16px' }}>Type</th>
                  <th style={{ padding: '16px' }}>Description</th>
                  <th style={{ padding: '16px', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '16px', textAlign: 'right' }}>Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((entry, index) => {
                  const runningBalance = calculateRunningBalance(index);
                  return (
                    <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '16px' }}>{entry.entry_date}</td>
                      <td style={{ padding: '16px' }}>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: '20px', 
                          fontSize: '0.75rem', 
                          fontWeight: 600,
                          letterSpacing: '0.5px',
                          backgroundColor: entry.entry_type === 'income' ? '#d1fae5' : '#fee2e2', 
                          color: entry.entry_type === 'income' ? '#065f46' : '#991b1b'
                        }}>
                          {entry.entry_type.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '16px' }}>{entry.description}</td>
                      <td style={{ 
                        padding: '16px', 
                        textAlign: 'right', 
                        fontWeight: 'bold', 
                        color: entry.entry_type === 'income' ? '#10b981' : '#ef4444' 
                      }}>
                        {entry.entry_type === 'income' ? '+' : '-'} {Number(entry.amount).toLocaleString()}
                      </td>
                      <td style={{ 
                        padding: '16px', 
                        textAlign: 'right', 
                        fontWeight: 'bold', 
                        fontSize: '1rem',
                        color: runningBalance >= 0 ? 'var(--primary-color)' : '#f59e0b'
                      }}>
                        Rs. {runningBalance.toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Calendar size={48} style={{ opacity: 0.2, marginBottom: '16px' }} /><br />
                      No financial records found for this month ({filterMonth}).
                    </td>
                  </tr>
                )}
              </tbody>
           </table>
         </div>
      </div>
    </div>
  );
}
