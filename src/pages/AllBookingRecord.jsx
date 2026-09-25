import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BookOpen, Search, RefreshCw } from 'lucide-react';
import { applyTenantFilter, getTenantItem } from '../utils/tenantStorage';
import { useSettings } from '../context/SettingsContext';

const STATUS_OPTIONS = [
  'Karachi Warehouse',
  'In Transit',
  'Lahore Branch',
  'Islamabad Branch',
  'Rawalpindi Branch',
  'Delivered',
];

const STATUS_COLORS = {
  'Karachi Warehouse': 'badge-orange',
  'In Transit': 'badge-blue',
  'Lahore Branch': 'badge-purple',
  'Islamabad Branch': 'badge-teal',
  'Rawalpindi Branch': 'badge-yellow',
  'Delivered': 'badge-green',
};

export default function AllBookingRecord() {
  const { primaryBranchName, biltyHeaderUrl } = useSettings();
  const [bilties, setBilties] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBranch, setFilterBranch] = useState('');

  useEffect(() => {
    fetchBranches();
    fetchBilties();
  }, [primaryBranchName]);

  function fetchBranches() {
    const currentPrimary = (primaryBranchName || 'Islamabad').trim();
    const custom = getTenantItem('custom_branches', []) || [];
    const list = [
      { id: 'primary', name: currentPrimary },
      ...custom.map(c => ({ id: c.id, name: c.name }))
    ];
    setBranches(list);
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

  const getHeaderBase64 = async () => {
    const srcUrl = biltyHeaderUrl || '/bilty-header.jpg';
    if (srcUrl.startsWith('data:image/')) return srcUrl;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(srcUrl);
      img.src = srcUrl;
    });
  };

  const generateBiltyHTML = (b, headerBase64) => {
    const destName = b.destination || b.branches?.name || '';
    const biltyDate = new Date(b.created_at || Date.now()).toLocaleDateString('en-PK');
    const localFreight = Number(b.local_freight || 0);
    const laborCharges = Number(b.labor_charges || 0);
    const customAmount = Number(b.custom_amount || 0);
    const ttExpense = Number(b.tt_expense || 0);
    const totalAmount = localFreight + laborCharges + customAmount + ttExpense;
    const headerSrc = headerBase64 || biltyHeaderUrl || '/bilty-header.jpg';

    return `
      <div class="bilty-copy">
        <div class="header-img"><img src="${headerSrc}" alt="Bilty Header" /></div>
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
              <div class="sig-area"><div class="sig-label">Booking Clerk</div><div style="font-size:12px;font-weight:800;margin-top:4px;">${b.booking_clerk || ''}</div></div>
            </div>
          </div>
        </div>
        <div class="disclaimer"><strong>Note:</strong> The Company will not be responsible for damages caused by theft, robbery, vehicle hijacking, road accidents, fires, rains, floods and other natural disasters.</div>
      </div>`;
  };

  const biltyStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; font-weight: 900 !important; color: #000 !important; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13.5px; background: #fff; line-height: 1.35; }
    .bilty-copy { width: 100%; padding: 3mm 4mm 2mm 4mm; background: #fff; page-break-inside: avoid; }
    .header-img { margin-bottom: 3px; width: 100%; border-bottom: 2px solid #000; padding-bottom: 3px; }
    .header-img img { width: 100%; max-height: 85px; object-fit: contain; display: block; }
    .route-bar { display: flex; justify-content: space-between; align-items: center; background: #f5f5f5; border: 1.5px solid #666; border-radius: 4px; padding: 5px 12px; margin: 3px 0 5px 0; flex-wrap: wrap; gap: 6px; }
    .route-item { font-size: 13.5px; font-weight: 800; }
    .route-item strong { font-size: 14px; }
    .main-layout { display: grid; grid-template-columns: 1fr 260px; gap: 8px; margin-bottom: 5px; align-items: stretch; }
    .left-col { display: flex; flex-direction: column; gap: 6px; }
    .card { border: 1.5px solid #777; border-radius: 4px; padding: 6px 10px; background: #fff; }
    .card-title { font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1.5px solid #999; }
    .sr-grid { display: grid; grid-template-columns: 1fr 1fr; }
    .sr-col { padding: 0 8px; } .sr-col:first-child { padding-left: 0; }
    .sr-right { border-left: 1.5px solid #777; }
    .sr-label { font-size: 12px; text-transform: uppercase; font-weight: 800; margin-bottom: 3px; letter-spacing: 0.5px; }
    .sr-name { font-size: 13.5px; font-weight: 800; } .sr-phone { font-size: 12px; margin-top: 2px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #000; color: #fff !important; padding: 5px 8px; font-size: 12px; text-align: left; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    td { padding: 5px 8px; font-size: 13.5px; border-bottom: 1px solid #999; font-weight: 800; }
    .charge-item { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #ccc; font-size: 13px; font-weight: 800; }
    .charge-total { display: flex; justify-content: space-between; padding: 6px 0 2px; margin-top: 4px; border-top: 2px solid #000; font-size: 15px; font-weight: 900; }
    .sig-area { margin-top: 6px; text-align: center; padding-top: 4px; border-top: 1px solid #777; }
    .sig-label { font-size: 11px; } .sig-line { width: 120px; margin: 12px auto 0; border-bottom: 1px solid #000; }
    .disclaimer { padding: 4px 8px; border: 1px solid #999; background: #f5f5f5; border-radius: 3px; font-size: 9.5px; line-height: 1.3; text-align: center; font-weight: 800; margin-top: 4px; }
    .copy-label { text-align: center; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 2px 0 3px; font-weight: 900; }
    .divider-line { height: 0; border-bottom: 2px dashed #555; margin: 3mm 8px; }
    @media print {
      body { margin: 0; padding: 0; }
      @page { size: A4 portrait; margin: 3mm 6mm; }
    }
  `;

  const handlePrint = async (b) => {
    const headerBase64 = await getHeaderBase64();
    const biltyHTML = generateBiltyHTML(b, headerBase64);
    const biltyHTMLOffice = biltyHTML.replace(/<div class="disclaimer">[\s\S]*?<\/div>/, '');
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset='utf-8'/><meta name='viewport' content='width=device-width, initial-scale=1'/><title>Bilty #${b.bilty_number}</title><style>
      @page { size: A4 portrait; margin: 3mm 6mm; }
      ${biltyStyles}
    </style></head><body>
      <div class="copy-label">CUSTOMER COPY</div>${biltyHTML}
      <div class="divider-line"></div>
      <div class="copy-label">OFFICE COPY</div>${biltyHTMLOffice}
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const handlePDF = async (b) => {
    const headerBase64 = await getHeaderBase64();
    const biltyHTML = generateBiltyHTML(b, headerBase64);
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
