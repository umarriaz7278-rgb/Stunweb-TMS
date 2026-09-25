import { useState, useEffect } from 'react';
import { Truck, Plus, Trash2, X, ArrowLeft, Eye, DollarSign, Printer, Filter, Download, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { applyTenantFilter, withTenantId, getTenantItem, setTenantItem } from '../utils/tenantStorage';
import { useSettings } from '../context/SettingsContext';

const TRIPS_KEY = 'ftl_trips';
const BROKERS_KEY = 'ftl_brokers';
const RECEIVABLES_KEY = 'ftl_broker_receivables';

const formatCurrency = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return 'Rs. 0';
  return 'Rs. ' + num.toLocaleString('en-PK');
};

function formatTripRow(t) {
  const biltyFare = parseFloat(t.total_bilty_fare || t.totalBiltyFare) || 0;
  const vehFare = parseFloat(t.vehicle_fare || t.vehicleFare) || 0;
  const exps = Array.isArray(t.expenses) ? t.expenses : [];
  const totExp = exps.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const gp = biltyFare - vehFare;
  const np = (t.net_profit !== undefined && t.net_profit !== null) ? parseFloat(t.net_profit) : (gp - totExp);

  return {
    id: t.id,
    date: t.date ? String(t.date).slice(0, 10) : '',
    biltyNumber: t.bilty_number || t.biltyNumber || '',
    vehicleNumber: t.vehicle_number || t.vehicleNumber || '',
    from: t.from_location || t.from || 'Karachi',
    to: t.to_location || t.to || '',
    totalBiltyFare: biltyFare,
    vehicleFare: vehFare,
    grossProfit: gp,
    netProfit: np,
    totalExpenses: totExp,
    brokerName: t.broker_name || t.brokerName || '',
    expenses: exps,
    createdAt: t.created_at || t.createdAt || new Date().toISOString()
  };
}

export default function BrokerAccountsFTL() {
  const { companyName, companySubtitle } = useSettings();
  const activeCompanyName = companyName || 'GUL-E-PAKISTAN';
  const activeCompanySub = companySubtitle || 'Goods Transport (Regd.) — Container Transport FTL';
  const navigate = useNavigate();
  const [brokers, setBrokers] = useState(() => getTenantItem(BROKERS_KEY, []));
  const [trips, setTrips] = useState(() => getTenantItem(TRIPS_KEY, []));
  const [receivables, setReceivables] = useState(() => getTenantItem(RECEIVABLES_KEY, []));
  const [loading, setLoading] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ date: new Date().toISOString().slice(0, 10), description: '', vehicleNumber: '', amount: '' });

  // Date filter states
  const [filterType, setFilterType] = useState('all'); // 'all', 'month', 'custom'
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Fetch all broker data from Supabase
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch brokers
      let bQuery = supabase.from('ftl_brokers').select('*').order('created_at', { ascending: true });
      bQuery = applyTenantFilter(bQuery);
      const { data: bData } = await bQuery;
      if (bData) {
        const formattedBrokers = bData.map(b => ({
          id: b.id,
          fullName: b.full_name,
          address: b.address || '',
          cnic: b.cnic || '',
          phone: b.phone || '',
          ntn: b.ntn || '',
        }));
        setBrokers(formattedBrokers);
        setTenantItem(BROKERS_KEY, formattedBrokers);
      }

      // 2. Fetch trips
      let tQuery = supabase.from('ftl_trips').select('*').order('date', { ascending: false });
      tQuery = applyTenantFilter(tQuery);
      const { data: tData } = await tQuery;
      if (tData) {
        const formattedTrips = tData.map(formatTripRow);
        setTrips(formattedTrips);
        setTenantItem(TRIPS_KEY, formattedTrips);
      }

      // 3. Fetch broker receivables & auto-migrate if needed
      const localRecv = getTenantItem(RECEIVABLES_KEY, []);
      let rQuery = supabase.from('ftl_broker_receivables').select('*').order('date', { ascending: false });
      rQuery = applyTenantFilter(rQuery);
      const { data: rData, error: rErr } = await rQuery;

      if (!rErr && rData) {
        // Smart cloud auto-sync: upload any local payments that are not yet in Supabase
        const missingInCloud = Array.isArray(localRecv)
          ? localRecv.filter(lr => {
              return !rData.some(cr =>
                cr.broker_name === lr.brokerName &&
                cr.date === lr.date &&
                parseFloat(cr.amount) === parseFloat(lr.amount)
              );
            })
          : [];

        if (missingInCloud.length > 0) {
          const insertPayload = missingInCloud.map(lr => withTenantId({
            broker_name: lr.brokerName || '',
            date: lr.date || new Date().toISOString().slice(0, 10),
            description: lr.description || 'Payment Received',
            vehicle_number: lr.vehicleNumber || '',
            amount: parseFloat(lr.amount) || 0
          }));
          const { data: migratedRecv, error: migErr } = await supabase
            .from('ftl_broker_receivables')
            .insert(insertPayload)
            .select();

          if (!migErr && migratedRecv) {
            const combined = [...migratedRecv, ...rData];
            const formatted = combined.map(r => ({
              id: r.id,
              brokerName: r.broker_name,
              date: r.date ? String(r.date).slice(0, 10) : '',
              description: r.description || '',
              vehicleNumber: r.vehicle_number || '',
              amount: parseFloat(r.amount) || 0,
              createdAt: r.created_at || ''
            }));
            setReceivables(formatted);
            setTenantItem(RECEIVABLES_KEY, formatted);
            setLoading(false);
            return;
          }
        }

        const formatted = rData.map(r => ({
          id: r.id,
          brokerName: r.broker_name,
          date: r.date ? String(r.date).slice(0, 10) : '',
          description: r.description || '',
          vehicleNumber: r.vehicle_number || '',
          amount: parseFloat(r.amount) || 0,
          createdAt: r.created_at || ''
        }));
        setReceivables(formatted);
        setTenantItem(RECEIVABLES_KEY, formatted);
      }
    } catch (err) {
      console.error('Error fetching broker accounts data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Get broker trips (profit entries)
  const getBrokerTrips = (brokerName) => {
    return trips.filter(t => t.brokerName === brokerName);
  };

  // Get broker receivables (payments received)
  const getBrokerReceivables = (brokerName) => {
    return receivables.filter(r => r.brokerName === brokerName);
  };

  // Calculate broker summary
  const getBrokerSummary = (brokerName) => {
    const brokerTrips = getBrokerTrips(brokerName);
    const brokerRecv = getBrokerReceivables(brokerName);
    const totalProfit = brokerTrips.reduce((s, t) => s + (parseFloat(t.netProfit) || 0), 0);
    const totalReceived = brokerRecv.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const balance = totalProfit - totalReceived;
    return { totalProfit, totalReceived, balance, tripCount: brokerTrips.length };
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    const entryData = {
      brokerName: selectedBroker,
      date: paymentForm.date,
      description: paymentForm.description,
      vehicleNumber: paymentForm.vehicleNumber,
      amount: parseFloat(paymentForm.amount) || 0,
    };

    try {
      const payload = withTenantId({
        broker_name: entryData.brokerName,
        date: entryData.date,
        description: entryData.description,
        vehicle_number: entryData.vehicleNumber,
        amount: entryData.amount
      });

      let { data, error } = await supabase.from('ftl_broker_receivables').insert([payload]).select();
      if (error && error.message && error.message.includes('tenant_id')) {
        const { tenant_id, ...fallbackPayload } = payload;
        const retry = await supabase.from('ftl_broker_receivables').insert([fallbackPayload]).select();
        data = retry.data;
      }

      const newEntry = data && data[0] ? {
        id: data[0].id,
        brokerName: data[0].broker_name,
        date: data[0].date ? String(data[0].date).slice(0, 10) : entryData.date,
        description: data[0].description || '',
        vehicleNumber: data[0].vehicle_number || '',
        amount: parseFloat(data[0].amount) || 0,
        createdAt: data[0].created_at || new Date().toISOString()
      } : { id: Date.now().toString(), ...entryData, createdAt: new Date().toISOString() };

      setReceivables(prev => {
        const updated = [newEntry, ...prev];
        setTenantItem(RECEIVABLES_KEY, updated);
        return updated;
      });
    } catch (err) {
      console.error('Error saving payment to cloud:', err);
    }

    setPaymentForm({ date: new Date().toISOString().slice(0, 10), description: '', vehicleNumber: '', amount: '' });
    setShowPaymentForm(false);
  };

  const handleDeletePayment = async (id) => {
    if (window.confirm('Are you sure you want to delete this payment entry?')) {
      try {
        await supabase.from('ftl_broker_receivables').delete().eq('id', id);
      } catch (err) {
        console.warn('Delete payment warning:', err);
      }
      setReceivables(prev => {
        const updated = prev.filter(r => r.id !== id);
        setTenantItem(RECEIVABLES_KEY, updated);
        return updated;
      });
    }
  };

  // --- BROKER DETAIL VIEW ---
  if (selectedBroker) {
    const brokerTrips = getBrokerTrips(selectedBroker);
    const brokerRecv = getBrokerReceivables(selectedBroker);
    const summary = getBrokerSummary(selectedBroker);

    // Build combined ledger sorted by date
    const ledgerEntries = [
      ...brokerTrips.map(t => ({
        type: 'profit',
        date: t.date,
        description: `Trip: ${t.from} → ${t.to} | Bilty# ${t.biltyNumber}`,
        vehicleNumber: t.vehicleNumber || '—',
        amount: parseFloat(t.netProfit) || 0,
        id: t.id,
      })),
      ...brokerRecv.map(r => ({
        type: 'received',
        date: r.date,
        description: r.description || 'Payment Received',
        vehicleNumber: r.vehicleNumber || '—',
        amount: parseFloat(r.amount) || 0,
        id: r.id,
      })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Running balance (on ALL entries, then show only filtered)
    let runningBalance = 0;
    const allWithBalance = ledgerEntries.map(entry => {
      if (entry.type === 'profit') runningBalance += entry.amount;
      else runningBalance -= entry.amount;
      return { ...entry, balance: runningBalance };
    });

    // Get filtered entries with their correct running balance
    const ledgerWithBalance = allWithBalance.filter(entry => {
      if (filterType === 'month') return entry.date && entry.date.startsWith(filterMonth);
      if (filterType === 'custom') {
        if (filterDateFrom && entry.date < filterDateFrom) return false;
        if (filterDateTo && entry.date > filterDateTo) return false;
      }
      return true;
    });

    // Filtered totals for summary display
    const filteredProfit = ledgerWithBalance.filter(e => e.type === 'profit').reduce((s, e) => s + e.amount, 0);
    const filteredReceived = ledgerWithBalance.filter(e => e.type === 'received').reduce((s, e) => s + e.amount, 0);

    // Print invoice function
    const handlePrintInvoice = () => {
      const filterLabel = filterType === 'month'
        ? `Month: ${new Date(filterMonth + '-01').toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })}`
        : filterType === 'custom'
          ? `From: ${filterDateFrom || '—'}  To: ${filterDateTo || '—'}`
          : 'All Records';

      const rows = ledgerWithBalance.map(entry => `
        <tr>
          <td>${entry.date}</td>
          <td><span class="badge ${entry.type}">${entry.type === 'profit' ? 'Profit' : 'Received'}</span></td>
          <td>${entry.description}</td>
          <td>${entry.vehicleNumber}</td>
          <td class="profit-cell">${entry.type === 'profit' ? formatCurrency(entry.amount) : '—'}</td>
          <td class="received-cell">${entry.type === 'received' ? formatCurrency(entry.amount) : '—'}</td>
          <td class="balance-cell">${formatCurrency(entry.balance)}</td>
        </tr>`).join('');

      const printWindow = window.open('', '_blank', 'width=900,height=700');
      printWindow.document.write(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Broker Account - ${selectedBroker}</title><style>
        @page { size: A4; margin: 10mm 12mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; }
        .invoice { max-width: 100%; padding: 20px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e3a5f; padding-bottom: 16px; margin-bottom: 16px; }
        .company-name { font-size: 22px; font-weight: 900; color: #1e3a5f; letter-spacing: 1px; }
        .company-sub { font-size: 10px; color: #555; margin-top: 2px; }
        .invoice-title { text-align: right; }
        .invoice-title h2 { font-size: 18px; font-weight: 800; color: #1e3a5f; margin-bottom: 4px; }
        .invoice-title p { font-size: 10px; color: #666; }
        .broker-info { display: flex; justify-content: space-between; margin-bottom: 16px; padding: 12px 16px; background: #f0f4ff; border-radius: 6px; border-left: 4px solid #1e3a5f; }
        .broker-info .left h3 { font-size: 14px; font-weight: 800; color: #1e3a5f; margin-bottom: 2px; }
        .broker-info .left p { font-size: 10px; color: #666; }
        .broker-info .right { text-align: right; }
        .broker-info .right .label { font-size: 9px; color: #888; text-transform: uppercase; }
        .broker-info .right .value { font-size: 13px; font-weight: 800; }
        .summary-cards { display: flex; gap: 12px; margin-bottom: 16px; }
        .s-card { flex: 1; text-align: center; padding: 10px; border: 1.5px solid #ddd; border-radius: 6px; }
        .s-card .s-label { font-size: 9px; text-transform: uppercase; color: #888; font-weight: 700; }
        .s-card .s-value { font-size: 15px; font-weight: 900; margin-top: 2px; }
        .s-card.profit .s-value { color: #16a34a; }
        .s-card.received .s-value { color: #2563eb; }
        .s-card.balance .s-value { color: #f59e0b; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th { background: #1e3a5f; color: #fff; padding: 8px 6px; font-size: 9px; text-align: left; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        td { padding: 7px 6px; font-size: 11px; border-bottom: 1px solid #e5e5e5; }
        tr:nth-child(even) { background: #f9fafb; }
        .badge { padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 700; }
        .badge.profit { background: #dcfce7; color: #16a34a; }
        .badge.received { background: #dbeafe; color: #2563eb; }
        .profit-cell { font-weight: 700; color: #16a34a; }
        .received-cell { font-weight: 700; color: #2563eb; }
        .balance-cell { font-weight: 800; color: #f59e0b; }
        .footer { border-top: 2px solid #1e3a5f; padding-top: 10px; margin-top: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #888; }
        .footer .company { font-weight: 700; color: #1e3a5f; }
        @media print { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style></head><body>
        <div class="invoice">
          <div class="header">
            <div>
              <div class="company-name">${activeCompanyName}</div>
              <div class="company-sub">${activeCompanySub}</div>
            </div>
            <div class="invoice-title">
              <h2>Broker Account Statement</h2>
              <p>Printed: ${new Date().toLocaleDateString('en-PK')} | ${filterLabel}</p>
            </div>
          </div>
          <div class="broker-info">
            <div class="left">
              <h3>${selectedBroker}</h3>
              <p>Account Ledger</p>
            </div>
            <div class="right">
              <div class="label">Period</div>
              <div class="value">${filterLabel}</div>
            </div>
          </div>
          <div class="summary-cards">
            <div class="s-card profit"><div class="s-label">Total Commission</div><div class="s-value">${formatCurrency(filteredProfit)}</div></div>
            <div class="s-card received"><div class="s-label">Total Received</div><div class="s-value">${formatCurrency(filteredReceived)}</div></div>
            <div class="s-card balance"><div class="s-label">Balance</div><div class="s-value">${formatCurrency(filteredProfit - filteredReceived)}</div></div>
          </div>
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Vehicle #</th><th>Profit</th><th>Received</th><th>Balance</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="7" style="text-align:center;padding:20px">No entries found</td></tr>'}</tbody>
          </table>
          <div class="footer">
            <div class="company">${activeCompanyName} — Safe & Timely Delivery Guaranteed</div>
            <div>Page 1 | Generated on ${new Date().toLocaleString('en-PK')}</div>
          </div>
        </div>
      </body></html>`);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 600);
    };

    // PDF download function
    const handleDownloadPDF = async () => {
      const filterLabel = filterType === 'month'
        ? `Month: ${new Date(filterMonth + '-01').toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })}`
        : filterType === 'custom'
          ? `From: ${filterDateFrom || '—'}  To: ${filterDateTo || '—'}`
          : 'All Records';

      const rows = ledgerWithBalance.map(entry => `
        <tr>
          <td>${entry.date}</td>
          <td><span class="badge ${entry.type}">${entry.type === 'profit' ? 'Profit' : 'Received'}</span></td>
          <td>${entry.description}</td>
          <td>${entry.vehicleNumber}</td>
          <td class="profit-cell">${entry.type === 'profit' ? formatCurrency(entry.amount) : '—'}</td>
          <td class="received-cell">${entry.type === 'received' ? formatCurrency(entry.amount) : '—'}</td>
          <td class="balance-cell">${formatCurrency(entry.balance)}</td>
        </tr>`).join('');

      const container = document.createElement('div');
      container.innerHTML = `<style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; }
        .invoice { max-width: 100%; padding: 20px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e3a5f; padding-bottom: 16px; margin-bottom: 16px; }
        .company-name { font-size: 22px; font-weight: 900; color: #1e3a5f; letter-spacing: 1px; }
        .company-sub { font-size: 10px; color: #555; margin-top: 2px; }
        .invoice-title { text-align: right; }
        .invoice-title h2 { font-size: 18px; font-weight: 800; color: #1e3a5f; margin-bottom: 4px; }
        .invoice-title p { font-size: 10px; color: #666; }
        .broker-info { display: flex; justify-content: space-between; margin-bottom: 16px; padding: 12px 16px; background: #f0f4ff; border-radius: 6px; border-left: 4px solid #1e3a5f; }
        .broker-info .left h3 { font-size: 14px; font-weight: 800; color: #1e3a5f; margin-bottom: 2px; }
        .broker-info .left p { font-size: 10px; color: #666; }
        .broker-info .right { text-align: right; }
        .broker-info .right .label { font-size: 9px; color: #888; text-transform: uppercase; }
        .broker-info .right .value { font-size: 13px; font-weight: 800; }
        .summary-cards { display: flex; gap: 12px; margin-bottom: 16px; }
        .s-card { flex: 1; text-align: center; padding: 10px; border: 1.5px solid #ddd; border-radius: 6px; }
        .s-card .s-label { font-size: 9px; text-transform: uppercase; color: #888; font-weight: 700; }
        .s-card .s-value { font-size: 15px; font-weight: 900; margin-top: 2px; }
        .s-card.profit .s-value { color: #16a34a; }
        .s-card.received .s-value { color: #2563eb; }
        .s-card.balance .s-value { color: #f59e0b; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th { background: #1e3a5f; color: #fff; padding: 8px 6px; font-size: 9px; text-align: left; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        td { padding: 7px 6px; font-size: 11px; border-bottom: 1px solid #e5e5e5; }
        tr:nth-child(even) { background: #f9fafb; }
        .badge { padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 700; }
        .badge.profit { background: #dcfce7; color: #16a34a; }
        .badge.received { background: #dbeafe; color: #2563eb; }
        .profit-cell { font-weight: 700; color: #16a34a; }
        .received-cell { font-weight: 700; color: #2563eb; }
        .balance-cell { font-weight: 800; color: #f59e0b; }
        .footer { border-top: 2px solid #1e3a5f; padding-top: 10px; margin-top: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #888; }
        .footer .company { font-weight: 700; color: #1e3a5f; }
      </style>
      <div class="invoice">
        <div class="header">
          <div>
            <div class="company-name">${activeCompanyName}</div>
            <div class="company-sub">${activeCompanySub}</div>
          </div>
          <div class="invoice-title">
            <h2>Broker Account Statement</h2>
            <p>Printed: ${new Date().toLocaleDateString('en-PK')} | ${filterLabel}</p>
          </div>
        </div>
        <div class="broker-info">
          <div class="left">
            <h3>${selectedBroker}</h3>
            <p>Account Ledger</p>
          </div>
          <div class="right">
            <div class="label">Period</div>
            <div class="value">${filterLabel}</div>
          </div>
        </div>
        <div class="summary-cards">
          <div class="s-card profit"><div class="s-label">Total Commission</div><div class="s-value">${formatCurrency(filteredProfit)}</div></div>
          <div class="s-card received"><div class="s-label">Total Received</div><div class="s-value">${formatCurrency(filteredReceived)}</div></div>
          <div class="s-card balance"><div class="s-label">Balance</div><div class="s-value">${formatCurrency(filteredProfit - filteredReceived)}</div></div>
        </div>
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Vehicle #</th><th>Profit</th><th>Received</th><th>Balance</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="7" style="text-align:center;padding:20px">No entries found</td></tr>'}</tbody>
        </table>
        <div class="footer">
          <div class="company">${activeCompanyName} — Safe & Timely Delivery Guaranteed</div>
          <div>Page 1 | Generated on ${new Date().toLocaleString('en-PK')}</div>
        </div>
      </div>`;
      document.body.appendChild(container);

      const { default: html2pdf } = await import('html2pdf.js');
      html2pdf().set({
        margin: [10, 12, 10, 12],
        filename: `Broker_Account_${selectedBroker}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(container).save().then(() => {
        document.body.removeChild(container);
      });
    };

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <DollarSign size={28} color="var(--primary-color)" />
          <h1 className="page-title" style={{ marginBottom: 0 }}>{selectedBroker} — Account</h1>
          <button className="btn btn-secondary" onClick={() => setSelectedBroker(null)} style={{ marginLeft: 'auto', fontSize: '0.85rem', padding: '6px 16px' }}>
            <ArrowLeft size={16} style={{ marginRight: 4 }} /> Back
          </button>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid #16a34a' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Commission</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#16a34a' }}>{formatCurrency(summary.totalProfit)}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{summary.tripCount} trip(s)</div>
          </div>
          <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid #6366f1' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Received</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#6366f1' }}>{formatCurrency(summary.totalReceived)}</div>
          </div>
          <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: `4px solid ${summary.balance > 0 ? '#f59e0b' : '#16a34a'}` }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Balance (Pending)</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: summary.balance > 0 ? '#f59e0b' : '#16a34a' }}>{formatCurrency(summary.balance)}</div>
          </div>
        </div>

        {/* Add Payment Button */}
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={handlePrintInvoice} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
            <Printer size={16} /> Print Invoice
          </button>
          <button onClick={handleDownloadPDF} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '6px 16px', borderRadius: '8px', border: '1px solid var(--primary-color, #e85d04)', background: 'var(--primary-color, #e85d04)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            <Download size={16} /> Download PDF
          </button>
          <button className="btn btn-primary" onClick={() => setShowPaymentForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={18} /> Add Payment Received
          </button>
        </div>

        {/* Date Filter */}
        <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <Filter size={16} color="var(--text-muted)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Filter:</span>
            {['all', 'month', 'custom'].map(ft => (
              <button key={ft} onClick={() => setFilterType(ft)} style={{
                padding: '5px 14px', fontSize: '0.8rem', fontWeight: 600, borderRadius: '6px', border: '1px solid',
                borderColor: filterType === ft ? '#6366f1' : 'var(--border)',
                background: filterType === ft ? '#6366f1' : 'transparent',
                color: filterType === ft ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}>
                {ft === 'all' ? 'All' : ft === 'month' ? 'Monthly' : 'Custom Range'}
              </button>
            ))}
            {filterType === 'month' && (
              <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                style={{ padding: '5px 10px', fontSize: '0.85rem', border: '1px solid var(--border)', borderRadius: '6px' }} />
            )}
            {filterType === 'custom' && (
              <>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>From:</label>
                <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                  style={{ padding: '5px 10px', fontSize: '0.85rem', border: '1px solid var(--border)', borderRadius: '6px' }} />
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>To:</label>
                <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                  style={{ padding: '5px 10px', fontSize: '0.85rem', border: '1px solid var(--border)', borderRadius: '6px' }} />
              </>
            )}
          </div>
        </div>

        {/* Ledger Table */}
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 700 }}>Account Ledger</h2>
          {ledgerWithBalance.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No entries yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['Date', 'Type', 'Description', 'Vehicle #', 'Profit', 'Received', 'Balance'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                    <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.8rem', fontWeight: 700 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerWithBalance.map((entry, idx) => (
                    <tr key={`${entry.type}-${entry.id}-${idx}`} style={{ borderBottom: '1px solid var(--border)', background: entry.type === 'received' ? '#f0f4ff' : 'transparent' }}>
                      <td style={{ padding: '10px 8px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{entry.date}</td>
                      <td style={{ padding: '10px 8px', fontSize: '0.85rem' }}>
                        <span style={{
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: entry.type === 'profit' ? '#dcfce7' : '#dbeafe',
                          color: entry.type === 'profit' ? '#16a34a' : '#2563eb',
                        }}>
                          {entry.type === 'profit' ? 'Profit' : 'Received'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', fontSize: '0.85rem' }}>{entry.description}</td>
                      <td style={{ padding: '10px 8px', fontSize: '0.85rem' }}>{entry.vehicleNumber}</td>
                      <td style={{ padding: '10px 8px', fontSize: '0.85rem', fontWeight: 600, color: '#16a34a' }}>
                        {entry.type === 'profit' ? formatCurrency(entry.amount) : '—'}
                      </td>
                      <td style={{ padding: '10px 8px', fontSize: '0.85rem', fontWeight: 600, color: '#2563eb' }}>
                        {entry.type === 'received' ? formatCurrency(entry.amount) : '—'}
                      </td>
                      <td style={{ padding: '10px 8px', fontSize: '0.85rem', fontWeight: 700, color: entry.balance > 0 ? '#f59e0b' : '#16a34a' }}>
                        {formatCurrency(entry.balance)}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        {entry.type === 'received' && (
                          <button className="btn-icon" title="Delete Payment" onClick={() => handleDeletePayment(entry.id)} style={{ color: '#dc2626' }}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payment Form Modal */}
        {showPaymentForm && (
          <div className="modal-overlay" style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
            padding: '20px',
          }}>
            <div className="card" style={{ width: '480px', padding: '28px', animation: 'fadeIn 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Add Payment Received — {selectedBroker}</h3>
                <button className="btn-icon" onClick={() => setShowPaymentForm(false)}><X size={20} /></button>
              </div>
              <form onSubmit={handlePaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" value={paymentForm.date} onChange={e => setPaymentForm(p => ({ ...p, date: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <input type="text" value={paymentForm.description} onChange={e => setPaymentForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Cash received" />
                </div>
                <div className="form-group">
                  <label>Vehicle Number</label>
                  <input type="text" value={paymentForm.vehicleNumber} onChange={e => setPaymentForm(p => ({ ...p, vehicleNumber: e.target.value }))} placeholder="e.g. ABC-1234" />
                </div>
                <div className="form-group">
                  <label>Amount (Rs.)</label>
                  <input type="number" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" min="0" required />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Payment</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentForm(false)} style={{ flex: 1 }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- BROKER LIST VIEW ---
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <DollarSign size={28} color="var(--primary-color)" />
        <h1 className="page-title" style={{ marginBottom: 0 }}>Broker Accounts</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/container-transport-ftl')} style={{ marginLeft: 'auto', fontSize: '0.85rem', padding: '6px 16px' }}>← Back</button>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>All Broker Accounts</h2>
          <button
            onClick={fetchData}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '0.75rem' }}
            title="Refresh from cloud"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>

        {loading && brokers.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>Loading broker accounts from cloud...</p>
        ) : brokers.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>No brokers found. Add brokers in Broker Management first.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {brokers.map(broker => {
              const summary = getBrokerSummary(broker.fullName);
              return (
                <div
                  key={broker.id}
                  className="card"
                  onClick={() => { setSelectedBroker(broker.fullName); setFilterType('all'); setFilterDateFrom(''); setFilterDateTo(''); }}
                  style={{
                    cursor: 'pointer',
                    padding: '24px',
                    borderLeft: '5px solid #6366f1',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{broker.fullName}</h3>
                    <Eye size={18} color="#6366f1" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Net Profit:</span>
                      <span style={{ fontWeight: 600, color: '#16a34a' }}>{formatCurrency(summary.totalProfit)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Received:</span>
                      <span style={{ fontWeight: 600, color: '#6366f1' }}>{formatCurrency(summary.totalReceived)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '6px', marginTop: '4px' }}>
                      <span style={{ fontWeight: 700 }}>Balance:</span>
                      <span style={{ fontWeight: 800, color: summary.balance > 0 ? '#f59e0b' : '#16a34a' }}>{formatCurrency(summary.balance)}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{summary.tripCount} trip(s)</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
