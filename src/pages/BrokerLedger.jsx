import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Truck } from 'lucide-react';

export default function BrokerLedger() {
  const [ledgers, setLedgers] = useState([]);
  const [brokersSummary, setBrokersSummary] = useState([]);
  const [loading, setLoading] = useState(false);

  const [paymentForm, setPaymentForm] = useState({
    broker_name: '',
    amount: '',
    transaction_type: 'paid_to_broker',
    description: ''
  });

  useEffect(() => {
    fetchLedgers();
  }, []);

  async function fetchLedgers() {
    const { data, error } = await supabase.from('broker_ledgers').select('*').order('created_at', { ascending: false });
    if (data) {
      setLedgers(data);
      
      // Calculate balances per broker
      const summary = {};
      data.forEach(txn => {
        if (!summary[txn.broker_name]) summary[txn.broker_name] = 0;
        
        if (txn.transaction_type === 'freight_payable') {
          summary[txn.broker_name] += txn.amount; // We owe broker
        } else {
          summary[txn.broker_name] -= txn.amount; // We paid broker or broker paid karachi (settlement)
        }
      });
      setBrokersSummary(Object.entries(summary).map(([name, balance]) => ({ name, balance })));
    }
  }

  const handlePaymentChange = (e) => {
    setPaymentForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('broker_ledgers').insert([{
      broker_name: paymentForm.broker_name,
      transaction_type: paymentForm.transaction_type,
      amount: parseFloat(paymentForm.amount),
      description: paymentForm.description
    }]);

    if (!error) {
      setPaymentForm({ broker_name: '', amount: '', transaction_type: 'paid_to_broker', description: '' });
      fetchLedgers();
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Truck size={28} color="var(--primary-color)" />
        <h1 className="page-title" style={{ marginBottom: 0 }}>Broker Ledgers & Settlement</h1>
      </div>

      <div className="stats-grid">
         {brokersSummary.map(b => (
            <div className="stat-card" key={b.name} style={{ borderLeft: `4px solid ${b.balance > 0 ? '#ef4444' : '#10b981'}` }}>
              <div className="stat-title">Broker: {b.name}</div>
              <div className="stat-value" style={{ fontSize: '1.4rem' }}>
                {b.balance > 0 ? `Payable: ${b.balance.toLocaleString()}` : `Settled / Adv: ${Math.abs(b.balance).toLocaleString()}`}
              </div>
            </div>
         ))}
         {brokersSummary.length === 0 && <div className="stat-card"><div className="stat-title">No Brokers Found</div></div>}
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <h3>Settle Broker Account</h3>
        <form onSubmit={submitPayment} style={{ marginTop: '16px' }} className="form-grid">
          <div className="form-group">
            <label>Broker Name</label>
            <input type="text" name="broker_name" value={paymentForm.broker_name} onChange={handlePaymentChange} required />
          </div>
          <div className="form-group">
            <label>Transaction Type</label>
            <select name="transaction_type" value={paymentForm.transaction_type} onChange={handlePaymentChange}>
              <option value="paid_to_broker">Paid to Broker (Cash/Bank)</option>
              <option value="broker_paid_karachi">Broker Paid Karachi Directly</option>
              <option value="freight_payable">Log Manual Freight (Credit Broker)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Amount</label>
            <input type="number" min="0" step="0.01" name="amount" value={paymentForm.amount} onChange={handlePaymentChange} required />
          </div>
          <div className="form-group">
            <label>Description / Ref</label>
            <input type="text" name="description" value={paymentForm.description} onChange={handlePaymentChange} />
          </div>
          <div className="form-group full-width">
             <button type="submit" className="btn btn-primary" disabled={loading}>
               {loading ? 'Processing...' : 'Settle Account'}
             </button>
          </div>
        </form>
      </div>

      <div className="card">
         <h3>Recent Ledger Entries</h3>
         <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginTop: '16px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '12px' }}>Date</th>
                <th style={{ padding: '12px' }}>Broker</th>
                <th style={{ padding: '12px' }}>Type</th>
                <th style={{ padding: '12px' }}>Description</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {ledgers.slice(0, 50).map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px' }}>{new Date(l.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{l.broker_name}</td>
                  <td style={{ padding: '12px' }}>
                     <span style={{ 
                        padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem',
                        backgroundColor: l.transaction_type === 'freight_payable' ? '#fee2e2' : '#d1fae5',
                        color: l.transaction_type === 'freight_payable' ? '#991b1b' : '#065f46'
                      }}>
                       {l.transaction_type.replace(/_/g, ' ').toUpperCase()}
                     </span>
                  </td>
                  <td style={{ padding: '12px' }}>{l.description || '-'}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>{l.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
         </table>
      </div>
    </div>
  );
}
