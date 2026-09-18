import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FileText } from 'lucide-react';
import { applyTenantFilter, withTenantId } from '../utils/tenantStorage';

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
    try {
      let qLedgers = supabase.from('branch_ledgers').select('entry_type, amount');
      qLedgers = applyTenantFilter(qLedgers);
      const { data: lData } = await qLedgers;

      let income = 0;
      let exp = 0;
      if (lData) {
        lData.forEach(l => {
          if (l.entry_type === 'income') income += Number(l.amount || 0);
          else if (l.entry_type === 'expense') exp += Number(l.amount || 0);
        });
      }

      let qExp = supabase.from('branch_expenses').select('amount');
      qExp = applyTenantFilter(qExp);
      const { data: expData } = await qExp;
      if (expData) {
        expData.forEach(e => { exp += Number(e.amount || 0); });
      }

      let qBroker = supabase.from('broker_ledgers').select('transaction_type, amount');
      qBroker = applyTenantFilter(qBroker);
      const { data: brkData } = await qBroker;
      let brokerFreight = 0;
      let brokerSettled = 0;
      if (brkData) {
        brkData.forEach(b => {
          if (b.transaction_type === 'freight_payable') brokerFreight += Number(b.amount || 0);
          else brokerSettled += Number(b.amount || 0);
        });
      }

      setFinance({
        total_branch_income: income,
        total_branch_expenses: exp,
        total_branch_receivables: 0,
        total_broker_freight: brokerFreight,
        broker_settled: brokerSettled
      });
    } catch (e) {
      console.error('Error fetching finance overview:', e);
    }
  }

  const handleExpenseChange = (e) => {
    const { name, value } = e.target;
    setExpenseForm(prev => ({ ...prev, [name]: value }));
  };

  const submitExpense = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = withTenantId({
      vehicle_number: expenseForm.vehicle_number,
      description: expenseForm.description,
      amount: parseFloat(expenseForm.amount)
    });
    const { error } = await supabase.from('branch_expenses').insert([payload]);

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
