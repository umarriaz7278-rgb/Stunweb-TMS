import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FileText, Search, RefreshCw, Printer, Download, Trash2 } from 'lucide-react';

export default function AllBookingReceipts() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchReceipts();
  }, []);

  async function fetchReceipts() {
    setLoading(true);
    const { data } = await supabase
      .from('booking_receipts')
      .select('*')
      .order('id', { ascending: false });
    if (data) setReceipts(data);
    setLoading(false);
  }

  const filtered = receipts.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (r.booking_number && r.booking_number.toLowerCase().includes(s)) ||
      (r.sender_name && r.sender_name.toLowerCase().includes(s)) ||
      (r.receiver_name && r.receiver_name.toLowerCase().includes(s)) ||
      (r.destination && r.destination.toLowerCase().includes(s)) ||
      (r.container_no && r.container_no.toLowerCase().includes(s))
    );
  });

  const formatCurrency = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return 'Rs. 0';
    return 'Rs. ' + num.toLocaleString('en-PK');
  };

  // Shared print styles (same as BookingReceipt)
  const printStyles = `
    @page { size: A4 landscape; margin: 5mm 8mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; font-weight: 900 !important; -webkit-text-stroke: 0.3px #000; color: #000 !important; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 18px; color: #000; padding: 0; background: #fff; }
    .bilty-section { padding: 8px 18px; page-break-inside: avoid; }
    .copy-label { display: none; }
    .header { text-align: center; padding-bottom: 6px; margin-bottom: 6px; border-bottom: 2px solid #000; }
    .header img { width: 100%; height: auto; display: block; }
    .route-bar { display: flex; justify-content: center; align-items: center; background: #f5f5f5; border: 1.5px solid #999; border-radius: 4px; padding: 8px 16px; margin-bottom: 8px; flex-wrap: wrap; gap: 12px; }
    .ref-row { display: flex; flex-wrap: wrap; gap: 4px 16px; background: #fff; border: 1px solid #ccc; border-radius: 3px; padding: 6px 16px; margin-bottom: 6px; font-size: 16px; font-weight: 700; }
    .route-bar .item { font-size: 17px; font-weight: 700; }
    .route-bar .item strong { color: #000; font-size: 17px; }
    .route-bar .item span { color: #000; }
    .route-bar .item.badge { background: #000 !important; padding: 5px 12px; border-radius: 3px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .route-bar .item.badge span, .route-bar .item.badge strong { color: #fff !important; }
    .two-col { display: grid; grid-template-columns: 1fr 300px; gap: 10px; margin-bottom: 8px; align-items: start; }
    .card { border: 1.5px solid #999; border-radius: 4px; padding: 10px 14px; background: #fff; }
    .card-title { font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #000; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #ccc; }
    .sr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
    .sr-col { padding: 0 14px; }
    .sr-col:first-child { border-right: 1px solid #999; padding-left: 0; }
    .sr-col:last-child { padding-right: 0; }
    .sr-col h5 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px; color: #000; margin-bottom: 4px; font-weight: 700; }
    .sr-col p { font-size: 17px; margin: 3px 0; font-weight: 700; color: #000; }
    .sr-col p span { color: #000; font-size: 16px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #000 !important; color: #fff !important; padding: 7px 10px; font-size: 14px; text-align: left; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; -webkit-text-stroke: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    td { padding: 7px 10px; font-size: 17px; border-bottom: 1px solid #ccc; font-weight: 700; color: #000; }
    .note-line { color: red !important; font-weight: 800; margin-top: 4px; font-size: 15px; min-height: 18px; padding: 3px 0; }
    .charge-item { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid #ccc; font-size: 17px; }
    .charge-item:last-of-type { border-bottom: none; }
    .charge-item span:first-child { color: #000; font-weight: 700; }
    .charge-item span:last-child { font-weight: 700; color: #000; }
    .charge-total { display: flex; justify-content: space-between; align-items: center; padding: 6px 0 0; margin-top: 6px; border-top: 2px solid #000; font-size: 19px; font-weight: 800; }
    .charge-total span:last-child { color: #000; }
    .broker-line { font-size: 16px; margin-top: 6px; padding-top: 6px; border-top: 1px solid #ccc; }
    .disclaimer { margin-top: 8px; padding: 8px 16px; border: 1.5px solid #999; background: #f5f5f5; border-radius: 3px; font-size: 13px; color: #000; line-height: 1.4; text-align: center; font-weight: 700; }
    .footer { text-align: center; margin-top: 6px; font-size: 13px; color: #000; padding-top: 4px; border-top: 1px solid #ccc; font-weight: 700; }
    @media print { body { padding: 0; } .bilty-section { padding: 8px 18px; } th { background: #000 !important; color: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; -webkit-text-stroke: 0 !important; } }
  `;

  function buildReceiptHTML(r) {
    const imgUrl = window.location.origin + '/booking-header.jpg';
    const totalFreight = (parseFloat(r.freight) || 0) + (parseFloat(r.local_freight) || 0) + (parseFloat(r.labour_charges) || 0);
    const refItems = [
      r.lc_number ? `<div class='item'><span>Local Container #: </span><strong>${r.lc_number}</strong></div>` : '',
      r.bl_number ? `<div class='item'><span>Local Vehicle #: </span><strong>${r.bl_number}</strong></div>` : '',
      r.order_number ? `<div class='item'><span>Local Weight: </span><strong>${r.order_number}</strong></div>` : '',
      r.gd_number ? `<div class='item'><span>GD #: </span><strong>${r.gd_number}</strong></div>` : '',
      r.vehicle_mobile ? `<div class='item'><span>Vehicle Mobile #: </span><strong>${r.vehicle_mobile}</strong></div>` : '',
    ].filter(Boolean).join('');

    const copyHTML = (copyLabel) => `
      <div class='bilty-section'>
        <div class='copy-label'>${copyLabel}</div>
        <div class='header'><img src='${imgUrl}' alt='Gul-e-Pakistan' /></div>
        <div class='route-bar'>
          <div class='item'><span>From: </span><strong>${r.loading_points || '-'}</strong></div>
          <div class='item'><span>To: </span><strong>${r.destination || '-'}</strong></div>
          <div class='item'><span>Date: </span><strong>${r.date || '-'}</strong></div>
          ${r.vehicle_number ? `<div class='item'><span>Vehicle Number: </span><strong>${r.vehicle_number}</strong></div>` : ''}
          <div class='item badge'><span>Booking #: </span><strong>${r.booking_number || '-'}</strong></div>
        </div>
        <div class='two-col'>
          <div>
            <div class='card' style='margin-bottom:8px;'>
              <div class='sr-grid'>
                <div class='sr-col'><h5>Sender</h5><p><strong>${r.sender_name || '-'}</strong></p><p><span>Mobile: </span>${r.mobile || '-'}</p></div>
                <div class='sr-col'><h5>Receiver</h5><p><strong>${r.receiver_name || '-'}</strong></p><p><span>Mobile: </span>${r.receiver_mobile || '-'}</p></div>
              </div>
            </div>
            <div class='card'>
              <div class='card-title'>Goods Details</div>
              <table>
                <thead><tr><th>#</th><th>Qty</th><th>Description</th><th>Weight (KG)</th><th>Seal No</th></tr></thead>
                <tbody><tr><td><strong>1</strong></td><td><strong>${r.qty || 0}</strong></td><td><strong>${r.description || '-'}</strong></td><td><strong>${r.weight_kg || '-'}</strong></td><td><strong>${r.cbm || '-'}</strong></td></tr></tbody>
              </table>
              <p class='note-line'>Note: ${r.additional_items || ''}</p>
            </div>
          </div>
          <div class='card'>
            <div class='card-title'>Charges</div>
            <div class='charge-item'><span>Freight</span><span>Rs. ${Number(r.freight || 0).toLocaleString()}</span></div>
            <div class='charge-item'><span>Labour Charges</span><span>Rs. ${Number(r.labour_charges || 0).toLocaleString()}</span></div>
            <div class='charge-item'><span>Other Expense</span><span>Rs. ${Number(r.other_expense || 0).toLocaleString()}</span></div>
            <div class='charge-total'><span>Total Amount</span><span>Rs. ${totalFreight.toLocaleString()}</span></div>
            ${r.broker_name ? `<div class='broker-line'><span>Broker:</span> <strong>${r.broker_name}</strong></div>` : ''}
          </div>
        </div>
        ${refItems ? `<div class='ref-row'>${refItems}</div>` : ''}
        <div class='disclaimer'><strong>Note:</strong> The Company will not be responsible for damages caused by theft, robbery, vehicle hijacking, road accidents, fires, rains, floods and other natural disasters. The party should insure its goods and assets.</div>
        <div class='footer'>Thank you for choosing Gul-e-Pakistan &mdash; Safe & Timely Delivery Guaranteed</div>
      </div>`;

    return { copyHTML, totalFreight };
  }

  function openPrintWindow(r) {
    const { copyHTML } = buildReceiptHTML(r);
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Booking Receipt ${r.booking_number}</title><style>${printStyles}</style></head><body>
      ${copyHTML('')}
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    const imgs = printWindow.document.images;
    let loaded = 0, printed = false;
    const tryPrint = () => { loaded++; if (!printed && loaded >= imgs.length) { printed = true; setTimeout(() => printWindow.print(), 400); } };
    if (imgs.length === 0) setTimeout(() => printWindow.print(), 400);
    else { for (let i = 0; i < imgs.length; i++) { if (imgs[i].complete) tryPrint(); else { imgs[i].onload = tryPrint; imgs[i].onerror = tryPrint; } } }
  }

  async function handleDelete(r) {
    const confirmed = window.confirm(`Are you sure you want to delete Receipt ${r.booking_number}? This will remove the record from everywhere.`);
    if (!confirmed) return;

    // Delete from Supabase
    const { error } = await supabase.from('booking_receipts').delete().eq('id', r.id);
    if (error) {
      alert('Error deleting: ' + error.message);
      return;
    }

    // Delete matching trip from localStorage
    try {
      const trips = JSON.parse(localStorage.getItem('ftl_trips') || '[]');
      const updatedTrips = trips.filter(t => t.biltyNumber !== r.booking_number);
      localStorage.setItem('ftl_trips', JSON.stringify(updatedTrips));
    } catch {}

    // Refresh list
    fetchReceipts();
  }

  async function downloadPDF(r) {
    const { copyHTML } = buildReceiptHTML(r);
    const container = document.createElement('div');
    container.innerHTML = `<style>${printStyles}</style>
      ${copyHTML('')}`;
    document.body.appendChild(container);

    // Wait for images to load
    const imgs = container.querySelectorAll('img');
    await Promise.all([...imgs].map(img => new Promise(resolve => {
      if (img.complete) resolve();
      else { img.onload = resolve; img.onerror = resolve; }
    })));

    const { default: html2pdf } = await import('html2pdf.js');
    html2pdf().set({
      margin: [5, 8, 5, 8],
      filename: `Booking_Receipt_${r.booking_number || r.id}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    }).from(container).save().then(() => {
      document.body.removeChild(container);
    });
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText size={22} color="var(--primary-color)" />
          <h1 className="page-title" style={{ marginBottom: 0, fontSize: '1.1rem' }}>All Booking Receipts</h1>
        </div>
        <button
          className="btn btn-secondary"
          onClick={fetchReceipts}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.82rem' }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="card" style={{ padding: '10px 16px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 250px', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px', background: 'var(--bg-secondary)' }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search by receipt #, sender, receiver, destination..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-primary)', fontSize: '0.84rem' }}
            />
          </div>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Total: <strong>{filtered.length}</strong>
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No receipts found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                {['#', 'Receipt #', 'Date', 'From → To', 'Sender', 'Receiver', 'Qty', 'Wt(KG)', 'Freight', 'Total', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => {
                const totalFreight = (parseFloat(r.freight) || 0) + (parseFloat(r.local_freight) || 0) + (parseFloat(r.labour_charges) || 0);
                return (
                  <tr
                    key={r.id}
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ padding: '7px 8px', fontWeight: 700, color: 'var(--primary-color)' }}>{r.booking_number || '—'}</td>
                    <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>{r.date || '—'}</td>
                    <td style={{ padding: '7px 8px' }}>{r.loading_points || '—'} → {r.destination || '—'}</td>
                    <td style={{ padding: '7px 8px' }}>{r.sender_name || '—'}</td>
                    <td style={{ padding: '7px 8px' }}>{r.receiver_name || '—'}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>{r.qty || 0}</td>
                    <td style={{ padding: '7px 8px' }}>{r.weight_kg || 0}</td>
                    <td style={{ padding: '7px 8px' }}>{formatCurrency(r.freight)}</td>
                    <td style={{ padding: '7px 8px', fontWeight: 700, color: 'var(--primary-color)' }}>{formatCurrency(totalFreight)}</td>
                    <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => openPrintWindow(r)}
                          title="Print"
                          style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '4px 8px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)' }}
                        >
                          <Printer size={13} /> Print
                        </button>
                        <button
                          onClick={() => downloadPDF(r)}
                          title="Download PDF"
                          style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '4px 8px', borderRadius: '5px', border: '1px solid var(--primary-color, #e85d04)', background: 'var(--primary-color, #e85d04)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, color: '#fff' }}
                        >
                          <Download size={13} /> PDF
                        </button>
                        <button
                          onClick={() => handleDelete(r)}
                          title="Delete"
                          style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '4px 8px', borderRadius: '5px', border: '1px solid #dc2626', background: '#dc2626', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, color: '#fff' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
