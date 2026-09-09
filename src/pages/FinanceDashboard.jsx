import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FileText } from 'lucide-react';

export default function FinanceDashboard() {
  const [finance, setFinance] = useState({
    total_branch_income: 0,
    total_branch_expenses: 0,
    total_branch_receivables: 0,
    total_broker_freight: 0,
    broker_settled: 0
  });

  const [expenseForm, setExpenseForm] = useState({
    vehicle_number: '',
    description: '',
    amount: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFinance();
  }, []);

  async function fetchFinance() {
    const { data } = await supabase.from('finance_overview').select('*');
    if (data && data.length > 0) {
      setFinance(data[0]);
    }
  }

  const handleExpenseChange = (e) => {
    const { name, value } = e.target;
    setExpenseForm(prev => ({ ...prev, [name]: value }));
  };

  const submitExpense = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('branch_expenses').insert([{
      vehicle_number: expenseForm.vehicle_number,
      description: expenseForm.description,
      amount: parseFloat(expenseForm.amount)
    }]);

    if (!error) {
      setExpenseForm({ vehicle_number: '', description: '', amount: '' });
      fetchFinance();
    }
    setLoading(false);
  };

  const branchProfit = finance.total_branch_income - finance.total_branch_expenses;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <FileText size={28} color="var(--primary-color)" />
        <h1 className="page-title" style={{ marginBottom: 0 }}>Branch Finance & Accounting</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-title">Total Extra Income (Deliveries)</div>
          <div className="stat-value" style={{ color: '#10b981' }}>{finance.total_branch_income.toLocaleString()}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="stat-title">Total Branch Expenses</div>
          <div className="stat-value" style={{ color: '#ef4444' }}>{finance.total_branch_expenses.toLocaleString()}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-title">Net Branch Profit</div>
          <div className="stat-value" style={{ color: '#3b82f6' }}>{branchProfit.toLocaleString()}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-title">Branch Receivables (from Customers)</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>{finance.total_branch_receivables.toLocaleString()}</div>
        </div>
      </div>

      <div className="card">
        <h3>Record Daily Branch Expense</h3>
        <form onSubmit={submitExpense} style={{ marginTop: '16px' }} className="form-grid">
          <div className="form-group">
            <label>Vehicle Number (Optional)</label>
            <input type="text" name="vehicle_number" value={expenseForm.vehicle_number} onChange={handleExpenseChange} />
          </div>
          <div className="form-group">
            <label>Amount</label>
            <input type="number" min="0" step="0.01" name="amount" value={expenseForm.amount} onChange={handleExpenseChange} required />
          </div>
          <div className="form-group full-width">
            <label>Expense Description</label>
            <input type="text" name="description" value={expenseForm.description} onChange={handleExpenseChange} required />
          </div>
          <div className="form-group full-width">
             <button type="submit" className="btn btn-primary" disabled={loading}>
               {loading ? 'Saving...' : 'Add Expense'}
             </button>
          </div>
        </form>
      </div>
    </div>
  );
}
