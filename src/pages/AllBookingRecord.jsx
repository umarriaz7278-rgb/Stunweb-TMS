import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BookOpen, Search, RefreshCw } from 'lucide-react';
import { applyTenantFilter } from '../utils/tenantStorage';

const STATUS_OPTIONS = [
  'Karachi Warehouse',
  'In Transit',
  'Lahore Branch',
  'Islamabad Branch',
  'Rawalpindi Branch',
  'Delivered',
];

const STATUS_COLORS = {
  'Karachi Warehouse': { bg: '#dbeafe', color: '#1e40af' },
  'In Transit':        { bg: '#fef9c3', color: '#854d0e' },
  'Lahore Branch':     { bg: '#f3e8ff', color: '#6b21a8' },
  'Islamabad Branch':  { bg: '#ffedd5', color: '#9a3412' },
  'Rawalpindi Branch': { bg: '#d1fae5', color: '#065f46' },
  'Delivered':         { bg: '#dcfce7', color: '#15803d' },
};

export default function AllBookingRecord() {
  const [bilties, setBilties] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBranch, setFilterBranch] = useState('');

  useEffect(() => {
    fetchBranches();
    fetchBilties();
  }, []);

  async function fetchBranches() {
    const { data } = await supabase.from('branches').select('*');
    if (data) setBranches(data);
  }

  async function fetchBilties() {
    setLoading(true);
    let q = supabase
      .from('bilties')
      .select('*, branches(name)')
      .order('created_at', { ascending: false });
    q = applyTenantFilter(q);
    const { data, error } = await q;
    if (data) setBilties(data);
    setLoading(false);
  }

  const generateBiltyHTML = (b) => {
    const destName = b.branches?.name || '';
    const biltyDate = new Date(b.created_at || Date.now()).toLocaleDateString('en-PK');
    const localFreight = Number(b.local_freight || 0);
    const laborCharges = Number(b.labor_charges || 0);
    const customAmount = Number(b.custom_amount || 0);
    const ttExpense = Number(b.tt_expense || 0);
    const totalAmount = localFreight + laborCharges + customAmount + ttExpense;

    return `
      <div class="bilty-copy">
        <div class="header-img"><img src="${window.location.origin}/bilty-header.jpg" alt="Gul-e-Pakistan Header" /></div>
        <div class="route-bar">
          <div class="route-item"><span>From: </span><strong>Karachi</strong></div>
          <div class="route-item"><span>To: </span><strong>${destName}</strong></div>
          <div class="route-item"><span>Date: </span><strong>${biltyDate}</strong></div>
          <div class="route-item" style="background:#000 !important;padding:4px 10px;border-radius:3px;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;"><span style="color:#fff !important;">Bilty #: </span><strong style="color:#fff !important;font-size:14px;">${b.bilty_number}</strong></div>
          ${b.lcl_number ? `<div class="route-item"><span>LCL #: </span><strong>${b.lcl_number}</strong></div>` : ''}
          ${b.container_number ? `<div class="route-item"><span>Container #: </span><strong>${b.container_number}</strong></div>` : ''}
        </div>
        <div class="main-layout">
          <div class="left-col">
            <div class="card">
              <div class="sr-grid">
                <div class="sr-col"><div class="sr-label">SENDER</div><div class="sr-name"><strong>${b.sender_name || ''}</strong></div>${b.sender_phone ? `<div class="sr-phone">${b.sender_phone}</div>` : ''}</div>
                <div class="sr-col sr-right"><div class="sr-label">RECEIVER</div><div class="sr-name"><strong>${b.receiver_name || ''}</strong></div>${b.receiver_phone ? `<div class="sr-phone">${b.receiver_phone}</div>` : ''}</div>
              </div>
            </div>
            <div class="card">
              <div class="card-title">Goods Details</div>
              <table><thead><tr><th>#</th><th>Qty</th><th>Description</th><th>Weight (KG)</th></tr></thead>
              <tbody><tr><td><strong>1</strong></td><td><strong>${b.total_quantity || b.quantity || 0}</strong></td><td><strong>${b.description || ''}</strong></td><td><strong>${b.weight_kg || 0}</strong></td></tr></tbody></table>
              <p style="color:red !important; font-weight:800; margin-top:6px; font-size:12px; min-height:18px; padding:4px 0;">Note: ${b.note || ''}</p>
            </div>
          </div>
          <div class="right-col">
            <div class="card">
              <div class="card-title">Charges</div>
              <div class="charge-item"><span>Rent Amount</span><span>Rs. ${customAmount.toLocaleString()}</span></div>
              <div class="charge-item"><span>Loading</span><span>Rs. ${laborCharges.toLocaleString()}</span></div>
              <div class="charge-item"><span>Local Fare</span><span>Rs. ${localFreight.toLocaleString()}</span></div>
              <div class="charge-item"><span>TT Expense</span><span>Rs. ${ttExpense.toLocaleString()}</span></div>
              <div class="charge-total"><span>Total Amount</span><span>Rs. ${totalAmount.toLocaleString()}</span></div>
              <div class="sig-area"><div class="sig-label">Booking Clerk</div><div style="font-size:13px;font-weight:800;margin-top:4px;">${b.booking_clerk || ''}</div></div>
            </div>
          </div>
        </div>
        <div class="disclaimer"><strong>Note:</strong> The Company will not be responsible for damages caused by theft, robbery, vehicle hijacking, road accidents, fires, rains, floods and other natural disasters.</div>
      </div>`;
  };

  const biltyStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; font-weight: 900 !important; color: #000 !important; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 15px; }
    .bilty-copy { width: 100%; padding: 3mm; background: #fff; height: auto; display: flex; flex-direction: column; justify-content: space-between; page-break-inside: avoid; page-break-after: auto; }
    .header-img { margin-bottom: 2px; width: 100%; border-bottom: 2px solid #000; padding-bottom: 2px; }
    .header-img img { width: 100%; height: auto; display: block; }
    .route-bar { display: flex; justify-content: space-between; align-items: center; background: #f5f5f5; border: 1px solid #999; border-radius: 4px; padding: 6px 10px; margin-bottom: 8px; flex-wrap: wrap; gap: 4px; }
    .route-item { font-size: 12px; font-weight: 700; }
    .route-item strong { font-size: 13px; }
    .main-layout { display: grid; grid-template-columns: 1fr 220px; gap: 8px; margin-bottom: 6px; align-items: start; }
    .left-col { display: flex; flex-direction: column; gap: 6px; }
    .card { border: 1px solid #999; border-radius: 4px; padding: 8px 10px; }
    .card-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #ccc; }
    .sr-grid { display: grid; grid-template-columns: 1fr 1fr; }
    .sr-col { padding: 0 8px; } .sr-col:first-child { padding-left: 0; }
    .sr-right { border-left: 1px solid #999; }
    .sr-label { font-size: 11px; text-transform: uppercase; font-weight: 700; margin-bottom: 3px; }
    .sr-name { font-size: 13px; font-weight: 700; } .sr-phone { font-size: 12px; margin-top: 1px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #000; color: #fff !important; padding: 5px 6px; font-size: 11px; text-align: left; font-weight: 700; text-transform: uppercase; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    td { padding: 5px 6px; font-size: 13px; border-bottom: 1px solid #ccc; font-weight: 700; }
    .charge-item { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #ccc; font-size: 13px; }
    .charge-total { display: flex; justify-content: space-between; padding: 6px 0 0; margin-top: 4px; border-top: 2px solid #000; font-size: 14px; font-weight: 800; }
    .sig-area { margin-top: 6px; text-align: center; padding-top: 3px; border-top: 1px solid #999; }
    .sig-label { font-size: 10px; } .sig-line { width: 120px; margin: 18px auto 0; border-bottom: 1px solid #000; }
    .disclaimer { padding: 4px 8px; border: 1px solid #999; background: #f5f5f5; border-radius: 3px; font-size: 9px; line-height: 1.4; text-align: center; font-weight: 700; }
    .copy-label { text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3px; font-weight: 800; }
    .bilty-copy + .copy-label { margin-top: 4px; }
    .divider-line { height: 8px; border-bottom: 2px dashed #999; margin: 2px 10px; }
  `;

  const handlePrint = (b) => {
    const biltyHTML = generateBiltyHTML(b);
    const biltyHTMLOffice = biltyHTML.replace(/<div class="disclaimer">[\s\S]*?<\/div>/, '');
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset='utf-8'/><meta name='viewport' content='width=device-width, initial-scale=1'/><title>Bilty #${b.bilty_number}</title><style>
      @page { size: A4; margin: 3mm 5mm; }
      @media print { body { margin: 0; padding: 0; } }
      ${biltyStyles}
    </style></head><body>
      <div class="copy-label">CUSTOMER COPY</div>${biltyHTML}
      <div class="divider-line"></div>
      <div class="copy-label">OFFICE COPY</div>${biltyHTMLOffice}
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 600);
  };

  const handlePDF = async (b) => {
    const biltyHTML = generateBiltyHTML(b);
    const container = document.createElement('div');
    container.innerHTML = `<style>${biltyStyles}</style>${biltyHTML}`;
    document.body.appendChild(container);
    const { default: html2pdf } = await import('html2pdf.js');
    html2pdf().set({
      margin: [8, 10, 8, 10],
      filename: `Bilty_${b.bilty_number}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(container).save().then(() => {
      document.body.removeChild(container);
    });
  };

  const handleWhatsApp = (b) => {
    const destName = b.branches?.name || '';
    const totalFreight = (parseFloat(b.local_freight) || 0) + (parseFloat(b.labor_charges) || 0) + (parseFloat(b.tt_expense) || 0) + (parseFloat(b.custom_amount) || 0);
    const text = [
      `*GUL-E-PAKISTAN*`,
      `Plot no 174/A, Gate no 6, Street no 4, New Truck Stand, Hawksbay Road, Karachi`,
      ``,
      `*Bilty # ${b.bilty_number}*`,
      `Date: ${new Date(b.created_at).toLocaleDateString('en-PK')}`,
      `Route: Karachi → ${destName}`,
      ``,
      `*Sender:* ${b.sender_name || ''}`,
      `*Receiver:* ${b.receiver_name || ''}`,
      ``,
      `*Goods:* ${b.description || ''}`,
      `Qty: ${b.total_quantity || b.quantity || 0}`,
      ``,
      `*Total Amount: Rs. ${totalFreight.toLocaleString()}*`,
    ].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleDeleteBilty = async (b) => {
    if (!window.confirm(`Bilty #${b.bilty_number} delete karna chahte hain? Yeh action wapas nahi hoga.`)) return;
    const { error } = await supabase.from('bilties').delete().eq('id', b.id);
    if (!error) {
      setBilties(prev => prev.filter(item => item.id !== b.id));
    } else {
      alert(`Delete failed: ${error.message}`);
    }
  };

  const getBranchName = (bilty) => {
    if (bilty.branches?.name) return bilty.branches.name;
    return '—';
  };

  const filtered = bilties.filter(b => {
    const matchSearch =
      !search ||
      (b.bilty_number && String(b.bilty_number).toLowerCase().includes(search.toLowerCase())) ||
      (b.sender_name && b.sender_name.toLowerCase().includes(search.toLowerCase())) ||
      (b.receiver_name && b.receiver_name.toLowerCase().includes(search.toLowerCase()));

    const matchStatus = !filterStatus || (b.status || 'Karachi Warehouse') === filterStatus;

    const matchBranch = !filterBranch || getBranchName(b) === filterBranch;

    return matchSearch && matchStatus && matchBranch;
  });

  const uniqueBranches = [...new Set(bilties.map(b => getBranchName(b)).filter(n => n !== '—'))];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BookOpen size={26} color="var(--primary-color)" />
          <h1 className="page-title" style={{ marginBottom: 0 }}>All Booking Record</h1>
        </div>
        <button
          className="btn btn-secondary"
          onClick={fetchBilties}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }}
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 200px', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 12px', background: 'var(--bg-secondary)' }}>
            <Search size={15} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search by bilty no, sender, receiver..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-primary)', fontSize: '0.88rem' }}
            />
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.88rem', minWidth: '160px' }}
          >
            <option value="">All Status</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Branch Filter */}
          <select
            value={filterBranch}
            onChange={e => setFilterBranch(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.88rem', minWidth: '160px' }}
          >
            <option value="">All Branches</option>
            {uniqueBranches.map(br => <option key={br} value={br}>{br}</option>)}
          </select>

          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Total: <strong>{filtered.length}</strong> bilties
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No records found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                  {['#', 'Bilty No', 'Date', 'Sender', 'Receiver', 'Destination', 'Qty', 'Total Freight', 'Clerk', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, idx) => {
                  const totalFreight = (parseFloat(b.local_freight) || 0) +
                    (parseFloat(b.labor_charges) || 0) +
                    (parseFloat(b.tt_expense) || 0) +
                    (parseFloat(b.custom_amount) || 0);

                  return (
                    <tr
                      key={b.id}
                      style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <td style={{ padding: '11px 14px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--primary-color)' }}>
                        #{b.bilty_number || b.id}
                      </td>
                      <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                        {b.created_at ? new Date(b.created_at).toLocaleDateString('en-PK') : '—'}
                      </td>
                      <td style={{ padding: '11px 14px' }}>{b.sender_name || '—'}</td>
                      <td style={{ padding: '11px 14px' }}>{b.receiver_name || '—'}</td>
                      <td style={{ padding: '11px 14px' }}>{getBranchName(b)}</td>
                      <td style={{ padding: '11px 14px', textAlign: 'center' }}>{b.total_quantity || b.quantity || 0}</td>
                      <td style={{ padding: '11px 14px', fontWeight: 600 }}>
                        ₨ {totalFreight.toLocaleString('en-PK')}
                      </td>
                      <td style={{ padding: '11px 14px' }}>{b.booking_clerk || '—'}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap' }}>
                          <button onClick={() => handlePrint(b)} title="Print Bilty" style={{ padding: '4px 8px', fontSize: '0.72rem', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '5px', cursor: 'pointer', background: '#f1f5f9', color: '#334155', whiteSpace: 'nowrap' }}>Print</button>
                          <button onClick={() => handlePDF(b)} title="Download PDF" style={{ padding: '4px 8px', fontSize: '0.72rem', fontWeight: 600, border: 'none', borderRadius: '5px', cursor: 'pointer', background: '#3B82F6', color: '#fff', whiteSpace: 'nowrap' }}>PDF</button>
                          <button onClick={() => handleWhatsApp(b)} title="Share on WhatsApp" style={{ padding: '4px 8px', fontSize: '0.72rem', fontWeight: 600, border: 'none', borderRadius: '5px', cursor: 'pointer', background: '#25D366', color: '#fff', whiteSpace: 'nowrap' }}>WA</button>
                          <button onClick={() => handleDeleteBilty(b)} title="Delete Bilty" style={{ padding: '4px 8px', fontSize: '0.72rem', fontWeight: 600, border: 'none', borderRadius: '5px', cursor: 'pointer', background: '#ef4444', color: '#fff' }}>X</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
