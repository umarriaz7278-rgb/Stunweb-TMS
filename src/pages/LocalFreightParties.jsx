import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ArrowLeft, Plus, Save, Trash2, Calendar, CreditCard, User, History, Download, Lock } from 'lucide-react';
import { applyTenantFilter, withTenantId } from '../utils/tenantStorage';
import { useSettings } from '../context/SettingsContext';

export default function LocalFreightParties() {
  const { companyName } = useSettings();
  const activeCompanyName = companyName || 'GUL-E-PAKISTAN GOODS';
  const [parties, setParties] = useState([]);
  const [selectedParty, setSelectedParty] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthClosedList, setMonthClosedList] = useState([]);
  const [paymentData, setPaymentData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    description: 'Cash Paid'
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchParties();
  }, []);

  useEffect(() => {
    if (selectedParty) {
      fetchTransactions(selectedParty.id);
    }
  }, [selectedParty]);

  const fetchParties = async () => {
    setLoading(true);
    // Fetch parties and their transaction totals
    let q = supabase
      .from('local_freight_parties')
      .select('*');
    q = applyTenantFilter(q);
    const { data: partiesData, error: pError } = await q;

    if (pError) {
      console.error(pError);
    } else {
      // For each party, calculate totals
      const partiesWithTotals = await Promise.all(partiesData.map(async (party) => {
        const { data: transData, error: tError } = await supabase
          .from('local_freight_transactions')
          .select('amount, type')
          .eq('party_id', party.id);
        
        let totalFreight = 0;
        let totalPaid = 0;

        if (transData) {
          transData.forEach(t => {
            if (t.type === 'freight') totalFreight += parseFloat(t.amount || 0);
            else if (t.type === 'payment') totalPaid += parseFloat(t.amount || 0);
          });
        }

        return {
          ...party,
          totalFreight,
          totalPaid,
          balance: totalFreight - totalPaid
        };
      }));
      setParties(partiesWithTotals);
    }
    setLoading(false);
  };

  const fetchTransactions = async (partyId) => {
    const { data, error } = await supabase
      .from('local_freight_transactions')
      .select(`
        *,
        bilties (bilty_number)
      `)
      .eq('party_id', partyId)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error(error);
    } else {
      setTransactions(data);
      // Load closed months
      fetchClosedMonths(partyId);
    }
  };

  const fetchClosedMonths = async (partyId) => {
    const { data, error } = await supabase
      .from('closed_months')
      .select('year_month')
      .eq('party_id', partyId);
    
    if (data) {
      setMonthClosedList(data.map(m => m.year_month));
    }
  };

  const getFilteredTransactions = () => {
    return transactions.filter(t => t.date.startsWith(selectedMonth));
  };

  const getMonthSummary = () => {
    const filtered = getFilteredTransactions();
    let totalFreight = 0;
    let totalPaid = 0;
    
    filtered.forEach(t => {
      if (t.type === 'freight') totalFreight += parseFloat(t.amount || 0);
      else if (t.type === 'payment') totalPaid += parseFloat(t.amount || 0);
    });
    
    return { totalFreight, totalPaid, balance: totalFreight - totalPaid };
  };

  const closeMonth = async () => {
    if (!selectedParty || !selectedMonth) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('closed_months')
      .insert([{
        party_id: selectedParty.id,
        year_month: selectedMonth
      }]);
    
    if (error) {
      setMessage(`Error closing month: ${error.message}`);
    } else {
      setMessage(`Month ${selectedMonth} closed successfully!`);
      fetchClosedMonths(selectedParty.id);
    }
    setLoading(false);
  };

  const downloadPDF = async () => {
    // Confirm before generating PDF
    const proceed = window.confirm(`Print/Download ledger for ${selectedParty.name} (${selectedMonth})?\n\nThis will generate a printable PDF with account details and amounts.`);
    if (!proceed) return;

    const filtered = getFilteredTransactions();
    const summary = getMonthSummary();

    // Build HTML for PDF (header required by user)
    let htmlContent = `
      <div style="font-family: Arial, Helvetica, sans-serif; padding: 16px;">
        <div style="text-align:center; margin-bottom:12px;">
          <h1 style="margin:0; font-size:20px;">${activeCompanyName} KARACHI</h1>
          <div style="font-weight:700; margin-top:6px;">Account Holder: ${selectedParty.name}</div>
          <div style="color:#666; margin-top:4px;">Ledger Month: ${selectedMonth} &nbsp; | &nbsp; Generated: ${new Date().toLocaleDateString()}</div>
        </div>
        <table style="width:100%; border-collapse:collapse; margin-top:12px;">
          <thead>
            <tr>
              <th style="border:1px solid #ddd; padding:8px; text-align:left;">Date</th>
              <th style="border:1px solid #ddd; padding:8px; text-align:left;">Description</th>
              <th style="border:1px solid #ddd; padding:8px; text-align:left;">Bilty #</th>
              <th style="border:1px solid #ddd; padding:8px; text-align:right;">Freight</th>
              <th style="border:1px solid #ddd; padding:8px; text-align:right;">Paid</th>
            </tr>
          </thead>
          <tbody>
    `;

    filtered.forEach(t => {
      htmlContent += `
        <tr>
          <td style="border:1px solid #ddd; padding:8px;">${new Date(t.date).toLocaleDateString()}</td>
          <td style="border:1px solid #ddd; padding:8px;">${t.description}</td>
          <td style="border:1px solid #ddd; padding:8px;">${t.bilties?.bilty_number || '-'}</td>
          <td style="border:1px solid #ddd; padding:8px; text-align:right;">${t.type === 'freight' ? Number(t.amount).toLocaleString() : '-'}</td>
          <td style="border:1px solid #ddd; padding:8px; text-align:right;">${t.type === 'payment' ? Number(t.amount).toLocaleString() : '-'}</td>
        </tr>
      `;
    });

    htmlContent += `
          </tbody>
        </table>

        <div style="display:flex; gap:16px; margin-top:18px;">
          <div style="flex:1; padding:12px; border:1px solid #eee; background:#fafafa; text-align:center;">
            <div style="color:#777;">Total Local Freight</div>
            <div style="font-size:18px; font-weight:700; color:#ef4444; margin-top:6px;">${summary.totalFreight.toLocaleString()}</div>
          </div>
          <div style="flex:1; padding:12px; border:1px solid #eee; background:#fafafa; text-align:center;">
            <div style="color:#777;">Total Paid</div>
            <div style="font-size:18px; font-weight:700; color:#10b981; margin-top:6px;">${summary.totalPaid.toLocaleString()}</div>
          </div>
          <div style="flex:1; padding:12px; border:1px solid #eee; background:#f3f4f6; text-align:center;">
            <div style="color:#777;">Amount Payable</div>
            <div style="font-size:18px; font-weight:700; margin-top:6px;">${summary.balance.toLocaleString()}</div>
          </div>
        </div>

        <div style="text-align:center; color:#999; font-size:12px; margin-top:24px;">This is an auto-generated report from ${activeCompanyName} System</div>
      </div>
    `;

    // Create container and use html2pdf to export as PDF
    const container = document.createElement('div');
    container.style.width = '210mm';
    container.style.padding = '8px';
    container.innerHTML = htmlContent;
    document.body.appendChild(container);
    try {
      const { default: html2pdf } = await import('html2pdf.js');
      await html2pdf().set({
        margin: [10, 10, 10, 10],
        filename: `${selectedParty.name.replace(/\s+/g, '_')}_${selectedMonth}.pdf`,
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
  };

  const handleReceivePayment = async (e) => {
    e.preventDefault();
    if (!selectedParty || !paymentData.amount) return;

    setLoading(true);
    const { error } = await supabase
      .from('local_freight_transactions')
      .insert([{
        party_id: selectedParty.id,
        date: paymentData.date,
        amount: parseFloat(paymentData.amount),
        description: paymentData.description,
        type: 'payment'
      }]);

    if (error) {
      setMessage(`Error recording payment: ${error.message}`);
    } else {
      setMessage('Payment recorded successfully!');
      setPaymentData({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        description: 'Cash Paid'
      });
      setShowPaymentForm(false);
      fetchTransactions(selectedParty.id);
      fetchParties(); // Refresh main list too
    }
    setLoading(false);
  };

  const calculateRunningBalance = (index) => {
    let balance = 0;
    for (let i = 0; i <= index; i++) {
      const t = transactions[i];
      if (t.type === 'freight') balance += parseFloat(t.amount);
      else balance -= parseFloat(t.amount);
    }
    return balance;
  };

  if (selectedParty) {
    return (
      <div className="animate-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button className="btn btn-secondary" onClick={() => setSelectedParty(null)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowLeft size={18} /> Back to Parties
          </button>
          <h1 className="page-title" style={{ marginBottom: 0 }}>{selectedParty.name} Ledger</h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" onClick={() => setShowPaymentForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} /> Pay Amount
            </button>
            <button className="btn btn-secondary" onClick={downloadPDF} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Download size={18} /> PDF
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 600 }}>Select Month:</label>
            <input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
          <button 
            className="btn btn-warning" 
            onClick={closeMonth}
            disabled={monthClosedList.includes(selectedMonth)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Lock size={18} /> {monthClosedList.includes(selectedMonth) ? 'Month Closed' : 'Close Month'}
          </button>
        </div>

        {message && (
          <div style={{ 
            padding: '12px', 
            marginBottom: '20px', 
            borderRadius: '6px', 
            backgroundColor: message.includes('Error') ? '#fee2e2' : '#d1fae5',
            color: message.includes('Error') ? '#991b1b' : '#065f46' 
          }}>
            {message}
          </div>
        )}

        {monthClosedList.includes(selectedMonth) && (
          <div style={{ 
            padding: '12px', 
            marginBottom: '20px', 
            borderRadius: '6px', 
            backgroundColor: '#dbeafe',
            color: '#1e40af',
            border: '1px solid #0ea5e9'
          }}>
            ⚠️ This month is closed and cannot be edited. No new transactions can be added.
          </div>
        )}

        {showPaymentForm && !monthClosedList.includes(selectedMonth) && (
          <div className="card" style={{ marginBottom: '24px', border: '1px solid var(--primary-light)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Pay Amount</h3>
            <form onSubmit={handleReceivePayment} className="form-grid">
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={paymentData.date} onChange={(e) => setPaymentData({...paymentData, date: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Amount Paid</label>
                <input type="number" step="0.01" value={paymentData.amount} onChange={(e) => setPaymentData({...paymentData, amount: e.target.value})} required />
              </div>
              <div className="form-group full-width">
                <label>Description (Cash/Bank etc.)</label>
                <input type="text" value={paymentData.description} onChange={(e) => setPaymentData({...paymentData, description: e.target.value})} required />
              </div>
              <div className="form-group full-width" style={{ display: 'flex', gap: '12px' }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>Save Payment</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Bilty #</th>
                <th>Freight</th>
                <th>Paid</th>
                <th>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredTransactions().length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>No transactions found for selected month.</td>
                </tr>
              ) : (
                getFilteredTransactions().map((t, index) => (
                  <tr key={t.id}>
                    <td>{new Date(t.date).toLocaleDateString()}</td>
                    <td>{t.description}</td>
                    <td>{t.bilties?.bilty_number || '-'}</td>
                    <td style={{ color: t.type === 'freight' ? '#ef4444' : 'inherit' }}>
                      {t.type === 'freight' ? t.amount.toLocaleString() : '-'}
                    </td>
                    <td style={{ color: t.type === 'payment' ? '#10b981' : 'inherit' }}>
                      {t.type === 'payment' ? t.amount.toLocaleString() : '-'}
                    </td>
                    <td style={{ fontWeight: 600 }}>{getFilteredTransactions().slice(0, getFilteredTransactions().indexOf(t) + 1).reduce((acc, curr) => {
                      if (curr.type === 'freight') acc += parseFloat(curr.amount || 0);
                      else acc -= parseFloat(curr.amount || 0);
                      return acc;
                    }, 0).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="form-grid" style={{ marginTop: '24px' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>Total Local Freight ({selectedMonth})</p>
            <h2 style={{ color: '#ef4444', margin: 0 }}>{getMonthSummary().totalFreight.toLocaleString()}</h2>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>Total Paid ({selectedMonth})</p>
            <h2 style={{ color: '#10b981', margin: 0 }}>{getMonthSummary().totalPaid.toLocaleString()}</h2>
          </div>
          <div className="card" style={{ textAlign: 'center', backgroundColor: 'var(--primary-light)', color: 'white' }}>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', marginBottom: '4px' }}>Amount Payable ({selectedMonth})</p>
            <h2 style={{ margin: 0 }}>{getMonthSummary().balance.toLocaleString()}</h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Local Freight Parties</h1>
      
      {loading && parties.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading parties...</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Party Name</th>
                <th>Phone</th>
                <th>Total Freight</th>
                <th>Total Paid</th>
                <th>Balance</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {parties.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>No freight parties found. Use Bilty Management to add freight entries.</td>
                </tr>
              ) : (
                parties.map(party => (
                  <tr key={party.id}>
                    <td style={{ fontWeight: 600 }}>{party.name}</td>
                    <td>{party.phone || '-'}</td>
                    <td>{party.totalFreight.toLocaleString()}</td>
                    <td>{party.totalPaid.toLocaleString()}</td>
                    <td style={{ fontWeight: 700, color: party.balance > 0 ? '#ef4444' : '#10b981' }}>
                      {party.balance.toLocaleString()}
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setSelectedParty(party)}>
                        View Ledger
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
