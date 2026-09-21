import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Truck, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { applyTenantFilter } from '../utils/tenantStorage';
import { useSettings } from '../context/SettingsContext';

export default function AllChallanRecord() {
  const { challanHeaderUrl } = useSettings();
  const [challans, setChallans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [challanBilties, setChallanBilties] = useState({});
  const [challanDestinations, setChallanDestinations] = useState({});

  useEffect(() => {
    fetchChallans();
    // Re-fetch when user navigates back to this page
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchChallans();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  async function fetchChallans() {
    setLoading(true);
    let q = supabase
      .from('challans')
      .select('*')
      .order('id', { ascending: false });
    q = applyTenantFilter(q);
    const { data, error } = await q;
    if (data) setChallans(data);
    if (error) {
      console.error('Error fetching challans:', error.message);
      alert('Error loading challans: ' + error.message);
    }
    // Fetch destinations for all challans
    const { data: cbData } = await supabase
      .from('challan_bilties')
      .select('challan_id, bilties(destination, destination_branch_id, branches:destination_branch_id(name))');
    if (cbData) {
      const destMap = {};
      cbData.forEach(item => {
        const dest = item.bilties?.branches?.name || item.bilties?.destination;
        if (dest) {
          if (!destMap[item.challan_id]) destMap[item.challan_id] = new Set();
          destMap[item.challan_id].add(dest);
        }
      });
      // Convert sets to comma-separated strings
      const destStrings = {};
      Object.entries(destMap).forEach(([id, set]) => {
        destStrings[id] = [...set].join(', ');
      });
      setChallanDestinations(destStrings);
    }
    setLoading(false);
  }

  async function fetchChallanBilties(challanId) {
    if (challanBilties[challanId]) return challanBilties[challanId];
    const { data, error } = await supabase
      .from('challan_bilties')
      .select('id, challan_id, bilty_id, loaded_quantity, bilties!bilty_id(bilty_number, sender_name, receiver_name, destination, description, total_quantity, total_amount, local_freight, labor_charges)')
      .eq('challan_id', challanId);
    if (data && !error) {
      setChallanBilties(prev => ({ ...prev, [challanId]: data }));
      return data;
    }
    if (error) {
      console.error('Error fetching challan bilties:', error.message);
      // Try alternative: fetch bilties separately
      const { data: cbData } = await supabase
        .from('challan_bilties')
        .select('*')
        .eq('challan_id', challanId);
      if (cbData && cbData.length > 0) {
        const biltyIds = cbData.map(cb => cb.bilty_id);
        const { data: biltyData } = await supabase
          .from('bilties')
          .select('id, bilty_number, sender_name, receiver_name, destination, description, total_quantity, total_amount, local_freight, labor_charges')
          .in('id', biltyIds);
        const biltyMap = {};
        (biltyData || []).forEach(b => { biltyMap[b.id] = b; });
        const merged = cbData.map(cb => ({
          ...cb,
          bilties: biltyMap[cb.bilty_id] || {}
        }));
        setChallanBilties(prev => ({ ...prev, [challanId]: merged }));
        return merged;
      }
    }
    return [];
  }

  const handleExpand = (challanId) => {
    if (expandedId === challanId) {
      setExpandedId(null);
    } else {
      setExpandedId(challanId);
      fetchChallanBilties(challanId);
    }
  };

  const filteredChallans = challans.filter(c => {
    const q = search.toLowerCase();
    return (
      String(c.challan_number || '').toLowerCase().includes(q) ||
      String(c.vehicle_number || '').toLowerCase().includes(q) ||
      String(c.driver_name || '').toLowerCase().includes(q) ||
      String(c.broker_name || '').toLowerCase().includes(q) ||
      String(c.route_number || '').toLowerCase().includes(q)
    );
  });

  const getHeaderBase64 = async () => {
    const srcUrl = challanHeaderUrl || '/challan-header.jpg';
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

  // Generate challan HTML for print/PDF
  function generateChallanHTML(challan, bilties, headerBase64) {
    const biltyRows = (bilties || []).map((b, i) => {
      const bilty = b.bilties || {};
      const ratio = b.loaded_quantity / (bilty.total_quantity || 1);
      const amount = (bilty.total_amount || 0) * ratio;
      return `<tr>
        <td>${i + 1}</td>
        <td><b>${bilty.bilty_number || '-'}</b></td>
        <td>${bilty.description || '-'}</td>
        <td>${bilty.sender_name || '-'}</td>
        <td>${bilty.receiver_name || '-'}</td>
        <td style="text-align:right">${b.loaded_quantity} / ${bilty.total_quantity || '-'}</td>
        <td style="text-align:right">Rs. ${Number(bilty.local_freight || 0).toLocaleString()}</td>
        <td style="text-align:right">Rs. ${Number(bilty.labor_charges || 0).toLocaleString()}</td>
        <td style="text-align:right">Rs. ${Number(amount).toLocaleString()}</td>
      </tr>`;
    }).join('');

    const deductions = (parseFloat(challan.labor_deduction) || 0) + 
                       (parseFloat(challan.commission_deduction) || 0) + 
                       (parseFloat(challan.other_deduction) || 0);
    const netRecoverable = (parseFloat(challan.total_bilty_amount) || 0) - deductions;
    const profit = netRecoverable - (parseFloat(challan.vehicle_freight) || 0);
    const challanDate = challan.challan_date ? new Date(challan.challan_date + 'T00:00:00').toLocaleDateString('en-PK') : '-';
    const headerSrc = headerBase64 || challanHeaderUrl || '/challan-header.jpg';

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Challan #${challan.challan_number}</title><style>
      @page { size: A4; margin: 8mm 10mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; font-weight: 700 !important; -webkit-text-stroke: 0.2px #000; color: #000 !important; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #000; background: #fff; }
      .challan-copy { width: 100%; padding: 6mm 4mm; border: 2px solid #000; border-radius: 3px; overflow: hidden; page-break-inside: avoid; }
      .header-img { margin: 0 0 3px 0; width: 100%; background: #fff; border-bottom: 1.5px solid #000; padding-bottom: 2px; }
      .header-img img { width: 100%; height: auto; display: block; margin: 0; }
      .info-row { display: flex; justify-content: space-between; border: 1.5px solid #000; border-radius: 3px; padding: 4px 8px; margin-top: 2px; margin-bottom: 5px; flex-wrap: wrap; }
      .info-cell { display: flex; flex-direction: column; align-items: center; padding: 2px 6px; }
      .info-cell .label { font-size: 9px; text-transform: uppercase; color: #000 !important; font-weight: 800 !important; }
      .info-cell .value { font-size: 11px; font-weight: 900 !important; color: #000 !important; }
      .section-title { font-size: 10px; font-weight: 900 !important; color: #000 !important; text-transform: uppercase; padding: 3px 8px; margin-bottom: 3px; border-bottom: 1.5px solid #000; }
      .finance-box { padding: 8px 12px; border: 1.5px solid #000; border-radius: 4px; margin-bottom: 8px; }
      .fin-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; font-weight: 800 !important; color: #000 !important; }
      .fin-row.net { font-weight: 900 !important; font-size: 12px; border-bottom: 1.5px solid #000; padding-bottom: 4px; margin-bottom: 4px; }
      .fin-row.dim { color: #000 !important; }
      .fin-row.add { color: #000 !important; }
      .fin-row.profit { font-weight: 900 !important; font-size: 12px; border-top: 1.5px solid #000; padding-top: 4px; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
      th { background: #f5f0e8; color: #000 !important; padding: 4px 5px; font-size: 9px; text-align: left; font-weight: 900 !important; border-bottom: 1.5px solid #000; }
      td { padding: 4px 5px; font-size: 10px; border-bottom: 1px solid #999; font-weight: 800 !important; color: #000 !important; }
      .total-col { text-align: right; font-size: 12px; color: #c0392b !important; font-weight: 900 !important; }
      th.total-col { color: #000 !important; text-align: right; }
      .profit-col { text-align: right; font-size: 12px; color: ${profit >= 0 ? '#16a34a' : '#dc2626'} !important; font-weight: 900 !important; }
      th.profit-col { color: #000 !important; text-align: right; }
      .signatures { display: flex; justify-content: space-between; margin-top: 10px; padding-top: 4px; }
      .sig-box { text-align: center; width: 28%; }
      .sig-line { border-bottom: 1.5px solid #000; margin-bottom: 3px; height: 20px; }
      .sig-box span { font-size: 9px; color: #000 !important; text-transform: uppercase; font-weight: 800 !important; }
    </style></head><body>
      <div class="challan-copy">
        <div class="header-img"><img src="${headerSrc}" alt="Challan Header" /></div>
        <div class="info-row">
          <div class="info-cell"><span class="label">Challan #</span><span class="value">${challan.challan_number || '-'}</span></div>
          <div class="info-cell"><span class="label">Date</span><span class="value">${challanDate}</span></div>
          <div class="info-cell"><span class="label">Vehicle</span><span class="value">${challan.vehicle_number || '-'}</span></div>
          <div class="info-cell"><span class="label">Driver</span><span class="value">${challan.driver_name || '-'}</span></div>
          ${challan.route_number ? `<div class="info-cell"><span class="label">Route #</span><span class="value">${challan.route_number}</span></div>` : ''}
          ${challan.broker_name ? `<div class="info-cell"><span class="label">Broker</span><span class="value">${challan.broker_name}</span></div>` : ''}
          ${challan.road_permit_number ? `<div class="info-cell"><span class="label">Permit #</span><span class="value">${challan.road_permit_number}</span></div>` : ''}
        </div>
        <div class="section-title">Loaded Bilties</div>
        <table>
          <thead><tr><th>#</th><th>Bilty #</th><th>Description</th><th>Sender</th><th>Receiver</th><th>Loaded/Total</th><th>Local Fare</th><th>Loading</th><th class="total-col">Amount</th></tr></thead>
          <tbody>${biltyRows || '<tr><td colspan="9" style="text-align:center">No bilties data</td></tr>'}</tbody>
        </table>
        <div class="section-title">Financial Summary</div>
        <div class="finance-box">
          <div class="fin-row"><span>Total Rent Amount:</span><strong>Rs. ${Number(challan.total_bilty_amount || 0).toLocaleString()}</strong></div>
          <div class="fin-row dim"><span>Total Local Fare (all bilties):</span><strong>- Rs. ${(bilties || []).reduce((s, b) => s + Number(b.bilties?.local_freight || 0), 0).toLocaleString()}</strong></div>
          <div class="fin-row dim"><span>Total Loading (all bilties):</span><strong>- Rs. ${(bilties || []).reduce((s, b) => s + Number(b.bilties?.labor_charges || 0), 0).toLocaleString()}</strong></div>
          <div class="fin-row net"><span>Net Rent Amount:</span><strong>Rs. ${Number(netRecoverable + (parseFloat(challan.commission_deduction) || 0)).toLocaleString()}</strong></div>
          <div class="fin-row dim"><span>Delivery:</span><strong>- Rs. ${Number(challan.commission_deduction || 0).toLocaleString()}</strong></div>
          <div class="fin-row add"><span>+ Add Local Fare:</span><strong>+ Rs. ${(bilties || []).reduce((s, b) => s + Number(b.bilties?.local_freight || 0), 0).toLocaleString()}</strong></div>
          <div class="fin-row add"><span>+ Add Loading:</span><strong>+ Rs. ${(bilties || []).reduce((s, b) => s + Number(b.bilties?.labor_charges || 0), 0).toLocaleString()}</strong></div>
          <div class="fin-row dim"><span>Branch Deposit:</span><strong>- Rs. ${Number(challan.branch_deposit || 0).toLocaleString()}</strong></div>
          <div class="fin-row profit"><span>Topay:</span><strong style="color:#3B82F6">Rs. ${(Number(netRecoverable + (parseFloat(challan.commission_deduction) || 0)) - Number(challan.commission_deduction || 0) + (bilties || []).reduce((s, b) => s + Number(b.bilties?.local_freight || 0), 0) + (bilties || []).reduce((s, b) => s + Number(b.bilties?.labor_charges || 0), 0) - Number(challan.branch_deposit || 0)).toLocaleString()}</strong></div>
        </div>
        <div class="signatures">
          <div class="sig-box"><div class="sig-line"></div><span>Prepared By</span></div>
          <div class="sig-box"><div class="sig-line"></div><span>Driver Signature</span></div>
          <div class="sig-box"><div class="sig-line"></div><span>Authorized By</span></div>
        </div>
      </div>
    </body></html>`;
  }

  const handlePrint = async (challan) => {
    const headerBase64 = await getHeaderBase64();
    const bilties = await fetchChallanBilties(challan.id);
    const html = generateChallanHTML(challan, bilties, headerBase64);
    const w = window.open('', '_blank', 'width=900,height=700');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 600);
  };

  const handlePDF = async (challan) => {
    const headerBase64 = await getHeaderBase64();
    const bilties = await fetchChallanBilties(challan.id);
    const fullHTML = generateChallanHTML(challan, bilties, headerBase64);
    // Extract style and body content for proper PDF rendering
    const styleMatch = fullHTML.match(/<style>([\s\S]*?)<\/style>/);
    const bodyMatch = fullHTML.match(/<body>([\s\S]*?)<\/body>/);
    const container = document.createElement('div');
    if (styleMatch) {
      const styleEl = document.createElement('style');
      styleEl.textContent = styleMatch[1];
      container.appendChild(styleEl);
    }
    const content = document.createElement('div');
    content.innerHTML = bodyMatch ? bodyMatch[1] : '';
    container.appendChild(content);
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '210mm';
    document.body.appendChild(container);
    const { default: html2pdf } = await import('html2pdf.js');
    html2pdf().set({
      margin: 5,
      filename: `Challan-${challan.challan_number}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(container).save().then(() => {
      document.body.removeChild(container);
    });
  };

  const handleWhatsApp = (challan) => {
    const bilties = challanBilties[challan.id] || [];
    const biltyLines = bilties.map((b, i) => {
      const bilty = b.bilties || {};
      return `${i + 1}. Bilty #${bilty.bilty_number || '-'} | ${bilty.destination || '-'} | Qty: ${b.loaded_quantity}/${bilty.total_quantity || '-'}`;
    }).join('\n');

    const deductions = (parseFloat(challan.labor_deduction) || 0) + 
                       (parseFloat(challan.commission_deduction) || 0) + 
                       (parseFloat(challan.other_deduction) || 0);
    const netRecoverable = (parseFloat(challan.total_bilty_amount) || 0) - deductions;
    const profit = netRecoverable - (parseFloat(challan.vehicle_freight) || 0);
    const challanDate = challan.challan_date ? new Date(challan.challan_date + 'T00:00:00').toLocaleDateString('en-PK') : '-';

    const text = [
      `*GUL-E-PAKISTAN*`,
      `Challan Record`,
      ``,
      `*Challan #:* ${challan.challan_number}`,
      `*Date:* ${challanDate}`,
      `*Vehicle:* ${challan.vehicle_number}`,
      `*Driver:* ${challan.driver_name}`,
      challan.route_number ? `*Route #:* ${challan.route_number}` : '',
      ``,
      `*--- Loaded Bilties ---*`,
      biltyLines || 'No bilties loaded',
      ``,
      `*--- Financial Summary ---*`,
      `Total Rent Amount: Rs. ${Number(challan.total_bilty_amount || 0).toLocaleString()}`,
      `Labor Deduction: Rs. ${Number(challan.labor_deduction || 0).toLocaleString()}`,
      `Commission Deduction: Rs. ${Number(challan.commission_deduction || 0).toLocaleString()}`,
      `Other Deductions: Rs. ${Number(challan.other_deduction || 0).toLocaleString()}`,
      `Vehicle Freight: Rs. ${Number(challan.vehicle_freight || 0).toLocaleString()}`,
      `*Net Recoverable: Rs. ${Number(netRecoverable).toLocaleString()}*`,
      `*Profit: Rs. ${Number(profit).toLocaleString()}*`,
    ].filter(Boolean).join('\n');

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
        <div style={{ background: '#eff6ff', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Truck size={28} color="#2563eb" />
        </div>
        <div>
          <h1 className="page-title" style={{ marginBottom: 0, color: '#1e293b', fontWeight: 800 }}>All Challan Record</h1>
        </div>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search by challan #, vehicle, driver, route..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.9rem' }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflowX: 'auto' }}>
        {loading ? (
          <p style={{ padding: '20px', textAlign: 'center' }}>Loading challans...</p>
        ) : filteredChallans.length === 0 ? (
          <p style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No challans found.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                <th style={{ padding: '10px 8px', color: '#0f172a', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>#</th>
                <th style={{ padding: '10px 8px', color: '#2563eb', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Challan No</th>
                <th style={{ padding: '10px 8px', color: '#0f172a', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</th>
                <th style={{ padding: '10px 8px', color: '#d97706', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vehicle</th>
                <th style={{ padding: '10px 8px', color: '#7c3aed', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Broker</th>
                <th style={{ padding: '10px 8px', color: '#0f172a', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Driver</th>
                <th style={{ padding: '10px 8px', color: '#2563eb', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Destination</th>
                <th style={{ padding: '10px 8px', color: '#0f172a', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Route</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', color: '#c0392b', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rent Amount</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', color: '#16a34a', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Profit</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', color: '#0f172a', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredChallans.map((challan, idx) => {
                const deductions = (parseFloat(challan.labor_deduction) || 0) + 
                                   (parseFloat(challan.commission_deduction) || 0) + 
                                   (parseFloat(challan.other_deduction) || 0);
                const netRecoverable = (parseFloat(challan.total_bilty_amount) || 0) - deductions;
                const profit = netRecoverable - (parseFloat(challan.vehicle_freight) || 0);
                const isExpanded = expandedId === challan.id;

                return (
                  <tr key={challan.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>{idx + 1}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 700, verticalAlign: 'top' }}>{challan.challan_number}</td>
                    <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>{challan.challan_date ? new Date(challan.challan_date + 'T00:00:00').toLocaleDateString('en-PK') : '-'}</td>
                    <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>{challan.vehicle_number || '-'}</td>
                    <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>{challan.broker_name || '-'}</td>
                    <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>{challan.driver_name || '-'}</td>
                    <td style={{ padding: '10px 8px', verticalAlign: 'top', fontWeight: 600 }}>{challanDestinations[challan.id] || '-'}</td>
                    <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>{challan.route_number || '-'}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', verticalAlign: 'top' }}>Rs. {Number(challan.total_bilty_amount || 0).toLocaleString()}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: profit >= 0 ? '#16a34a' : '#dc2626', verticalAlign: 'top' }}>Rs. {Number(profit).toLocaleString()}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button onClick={() => handlePrint(challan)} style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '5px', cursor: 'pointer', background: '#f1f5f9', color: '#334155', whiteSpace: 'nowrap' }}>Print</button>
                        <button onClick={() => handlePDF(challan)} style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, border: 'none', borderRadius: '5px', cursor: 'pointer', background: '#3B82F6', color: '#fff', whiteSpace: 'nowrap' }}>PDF</button>
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
