import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { MapPin, PackageOpen } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { getScopedKey, applyTenantFilter, withTenantId, getTenantItem, setTenantItem } from '../utils/tenantStorage';

export default function BranchOffice({ branchName }) {
  const navigate = useNavigate();
  const { primaryBranchName } = useSettings();
  // --------- shared states ---------
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // --------- Receiving States ---------
  const [incomingChallans, setIncomingChallans] = useState([]);
  const [selectedChallan, setSelectedChallan] = useState(null);
  const [viewChallan, setViewChallan] = useState(null);
  const [verificationData, setVerificationData] = useState({});

  // --------- Delivery States ---------
  const [warehouseInventory, setWarehouseInventory] = useState([]);
  const [selectedBilty, setSelectedBilty] = useState(null);
  const [deliveryFormData, setDeliveryFormData] = useState({
    customer_cnic: '', customer_phone: '', delivered_qty: 1,
    paid_amount: 0, extra_labor: 0, extra_unloading: 0, local_fare: 0, extra_other: 0
  });
  const [recentDelivery, setRecentDelivery] = useState(null);

  const deliveryTotal =
    (parseFloat(deliveryFormData.paid_amount) || 0) +
    (parseFloat(deliveryFormData.extra_labor) || 0) +
    (parseFloat(deliveryFormData.extra_unloading) || 0) +
    (parseFloat(deliveryFormData.local_fare) || 0) +
    (parseFloat(deliveryFormData.extra_other) || 0);


  useEffect(() => {
    // Reset selections on branch change
    setSelectedChallan(null);
    setSelectedBilty(null);
    setViewChallan(null);
    setRecentDelivery(null);
    setMessage('');
    
    fetchBranchData();
  }, [branchName]);

  async function fetchBranchData() {
    // 1. Fetch In-Transit vehicles for THIS tenant
    let challansQ = supabase
      .from('challans')
      .select(`
        *,
        challan_bilties (
          id, loaded_quantity, bilty_id,
          bilties ( id, bilty_number, destination, description, sender_name, receiver_name, receiver_phone, total_quantity, total_amount, local_freight, labor_charges, branches(name) )
        )
      `)
      .eq('status', 'in_transit');
    
    challansQ = applyTenantFilter(challansQ);
    const { data: challansData } = await challansQ;

    if (challansData) {
      const bTarget = (branchName || '').trim().toLowerCase();
      const filteredChallans = challansData.filter(ch => {
         if (!ch.challan_bilties || ch.challan_bilties.length === 0) return false;
         return ch.challan_bilties.some(cb => {
           const bName = (cb.bilties?.branches?.name || '').trim().toLowerCase();
           const bDest = (cb.bilties?.destination || '').trim().toLowerCase();
           return (bName && bName === bTarget) || (bDest && bDest === bTarget);
         });
      });
      setIncomingChallans(filteredChallans);
    }

    // 2. Fetch Arrived vehicles for THIS tenant to compute stock ready inventory
    let arrivedQ = supabase
      .from('challans')
      .select(`
        id, challan_number, challan_date, vehicle_number,
        challan_bilties (
          id, loaded_quantity, bilty_id,
          bilties ( id, bilty_number, destination, description, sender_name, receiver_name, receiver_phone, total_quantity, total_amount, local_freight, labor_charges, branches(name) )
        )
      `)
      .eq('status', 'arrived');
    arrivedQ = applyTenantFilter(arrivedQ);
    const { data: arrivedChallans } = await arrivedQ;

    // Also fetch deliveries for this tenant to subtract delivered items
    let deliveriesQ = supabase.from('deliveries').select('bilty_id, delivered_qty');
    deliveriesQ = applyTenantFilter(deliveriesQ);
    const { data: deliveriesData } = await deliveriesQ;

    const deliveredMap = {};
    if (deliveriesData) {
      deliveriesData.forEach(d => {
        deliveredMap[d.bilty_id] = (deliveredMap[d.bilty_id] || 0) + (parseInt(d.delivered_qty) || 0);
      });
    }

    const bTarget = (branchName || '').trim().toLowerCase();
    const invList = [];

    if (arrivedChallans) {
      arrivedChallans.forEach(ch => {
        if (ch.challan_bilties) {
          ch.challan_bilties.forEach(cb => {
            const b = cb.bilties;
            if (!b) return;
            const bName = (b.branches?.name || '').trim().toLowerCase();
            const bDest = (b.destination || '').trim().toLowerCase();
            if ((bName && bName === bTarget) || (bDest && bDest === bTarget)) {
              const loaded = parseInt(cb.loaded_quantity) || 0;
              const delivered = deliveredMap[cb.bilty_id] || 0;
              const remaining = Math.max(0, loaded - delivered);
              if (remaining > 0) {
                invList.push({
                  challan_bilty_id: cb.id,
                  bilty_id: cb.bilty_id,
                  challan_id: ch.id,
                  bilty_number: b.bilty_number,
                  sender_name: b.sender_name,
                  receiver_name: b.receiver_name,
                  receiver_phone: b.receiver_phone,
                  description: b.description,
                  total_amount: b.total_amount,
                  local_freight: b.local_freight,
                  labor_charges: b.labor_charges,
                  branch_available_qty: remaining,
                  loaded_quantity: loaded,
                  total_quantity: b.total_quantity,
                  destination_name: branchName,
                  vehicle_number: ch.vehicle_number,
                  challan_number: ch.challan_number,
                });
              }
            }
          });
        }
      });
    }
    setWarehouseInventory(invList);
  }

  /* ------------------------------------------------------------- 
     A. RECEIVING VERIFICATION LOGIC 
  ------------------------------------------------------------- */
  const handleSelectChallan = (challan) => {
    setViewChallan(null);
    setSelectedChallan(challan);
    const initialData = {};
    challan.challan_bilties.forEach(cb => {
      initialData[cb.id] = { received_qty: cb.loaded_quantity, short_qty: 0 };
    });
    setVerificationData(initialData);
  };

  const handlePrintChallan = async (ch) => {
    // Convert header image to base64
    const headerBase64 = await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve('');
      img.src = '/challan-header.jpg';
    });

    const biltyRows = ch.challan_bilties.map((cb, i) => {
      const b = cb.bilties;
      return `<tr>                                                                        
        <td>${i + 1}</td>
        <td><b>${b.bilty_number || '-'}</b></td>
        <td>${b.description || '-'}</td>
        <td>${b.sender_name || '-'}</td>
        <td>${b.receiver_name || '-'}</td>
        <td style='text-align:right'>${cb.loaded_quantity}</td>
        <td style='text-align:right'>Rs. ${Number(b.local_freight || 0).toLocaleString()}</td>
        <td style='text-align:right'>Rs. ${Number(b.labor_charges || 0).toLocaleString()}</td>
        <td style='text-align:right'>Rs. ${Number(b.total_amount || 0).toLocaleString()}</td>
      </tr>`;
    }).join('');

    // Calculate totals from bilties for financial summary
    const totalRent = Number(ch.total_bilty_amount || 0);
    const totalLocalFare = ch.challan_bilties.reduce((sum, cb) => sum + Number(cb.bilties?.local_freight || 0), 0);
    const totalLoading = ch.challan_bilties.reduce((sum, cb) => sum + Number(cb.bilties?.labor_charges || 0), 0);
    const netRent = totalRent - totalLocalFare - totalLoading;
    const commissionDed = Number(ch.commission_deduction || 0);
    const vehicleFreight = Number(ch.vehicle_freight || 0);
    const profit = netRent - commissionDed - vehicleFreight + totalLocalFare + totalLoading;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Challan #${ch.challan_number}</title><style>
      @page { size: A4; margin: 8mm 10mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; font-weight: 900 !important; -webkit-text-stroke: 0.3px #000; color: #000 !important; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #000; background: #f5f0e8; }
      .challan-copy { width: 100%; padding: 4mm 2mm 2mm 2mm; border: 2px solid #000; border-radius: 3px; overflow: hidden; page-break-inside: avoid; background: #f5f0e8; }
      .header-img { margin-bottom: 0; width: 100%; background: #fff; }
      .header-img img { width: 100%; height: auto; display: block; }
      .info-row { display: flex; justify-content: space-between; border: 1.5px solid #000; border-radius: 3px; padding: 5px 10px; margin-bottom: 6px; }
      .info-cell { display: flex; flex-direction: column; align-items: center; }
      .info-cell .label { font-size: 10px; text-transform: uppercase; color: #000 !important; font-weight: 900 !important; }
      .info-cell .value { font-size: 12px; font-weight: 900 !important; color: #000 !important; }
      .info-cell .value.bold { font-size: 14px; font-weight: 900 !important; }
      .section-title { font-size: 11px; font-weight: 900 !important; color: #000 !important; text-transform: uppercase; padding: 3px 8px; margin-bottom: 3px; border-bottom: 1.5px solid #000; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 6px; table-layout: fixed; }
      th { background: #f5f0e8; color: #000 !important; padding: 5px 8px; font-size: 10px; text-align: left; font-weight: 900 !important; border-bottom: 1.5px solid #000; white-space: nowrap; overflow: hidden; }
      td { padding: 5px 8px; font-size: 11px; border-bottom: 1px solid #999; font-weight: 900 !important; color: #000 !important; word-wrap: break-word; }
      .finance-box { padding: 8px 10px; border: 1.5px solid #000; border-radius: 3px; margin-bottom: 6px; }
      .fin-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; font-weight: 900 !important; color: #000 !important; }
      .fin-row.dim { color: #000 !important; }
      .fin-row.net { border-top: 1.5px solid #000; padding-top: 5px; margin-top: 3px; font-weight: 900 !important; }
      .fin-row.add { color: #000 !important; }
      .fin-row.profit { border-top: 2px solid #000; padding-top: 6px; margin-top: 4px; font-size: 15px; font-weight: 900 !important; }
      @media print { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    </style></head><body>
      <div class="challan-copy">
      <div class="header-img"><img src="${headerBase64}" alt="Header" /></div>
      <div class="info-row">
        <div class="info-cell"><span class="label">Challan #</span><span class="value bold">${ch.challan_number}</span></div>
        <div class="info-cell"><span class="label">Date</span><span class="value">${ch.challan_date ? new Date(ch.challan_date + 'T00:00:00').toLocaleDateString('en-PK') : '—'}</span></div>
        <div class="info-cell"><span class="label">Vehicle</span><span class="value">${ch.vehicle_number}</span></div>
        <div class="info-cell"><span class="label">Driver</span><span class="value">${ch.driver_name}</span></div>
        <div class="info-cell"><span class="label">Branch</span><span class="value bold">${branchName}</span></div>
        ${ch.broker_name ? `<div class="info-cell"><span class="label">Broker</span><span class="value">${ch.broker_name}</span></div>` : ''}
        ${ch.route_number ? `<div class="info-cell"><span class="label">Route #</span><span class="value">${ch.route_number}</span></div>` : ''}
      </div>
      <div class="section-title">Bilties in this Challan</div>
      <table>
        <thead><tr><th>#</th><th>Bilty #</th><th>Description</th><th>Sender</th><th>Receiver</th><th style='text-align:right'>Loaded Qty</th><th style='text-align:right'>Local Fare</th><th style='text-align:right'>Loading</th><th style='text-align:right'>Amount</th></tr></thead>
        <tbody>${biltyRows}</tbody>
      </table>
      <div class="section-title">Financial Summary</div>
      <div class="finance-box">
        <div class="fin-row"><span>Total Rent Amount:</span><strong>Rs. ${totalRent.toLocaleString()}</strong></div>
        <div class="fin-row dim"><span>Total Local Fare (all bilties):</span><strong>- Rs. ${totalLocalFare.toLocaleString()}</strong></div>
        <div class="fin-row dim"><span>Total Loading (all bilties):</span><strong>- Rs. ${totalLoading.toLocaleString()}</strong></div>
        <div class="fin-row net"><span>Net Rent Amount:</span><strong>Rs. ${netRent.toLocaleString()}</strong></div>
        <div class="fin-row dim"><span>Delivery:</span><strong>- Rs. ${commissionDed.toLocaleString()}</strong></div>
        <div class="fin-row add"><span>+ Add Local Fare:</span><strong>+ Rs. ${totalLocalFare.toLocaleString()}</strong></div>
        <div class="fin-row add"><span>+ Add Loading:</span><strong>+ Rs. ${totalLoading.toLocaleString()}</strong></div>
        <div class="fin-row dim"><span>Branch Deposit:</span><strong>- Rs. ${Number(ch.branch_deposit || 0).toLocaleString()}</strong></div>
        <div class="fin-row profit"><span>Topay:</span><strong style="color:#3B82F6">Rs. ${(netRent - commissionDed + totalLocalFare + totalLoading - Number(ch.branch_deposit || 0)).toLocaleString()}</strong></div>
      </div>

      </div>
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 600);
  };

  const handleQtyChange = (cb_id, field, value) => {
    const parsed = parseInt(value) || 0;
    setVerificationData(prev => {
      const current = prev[cb_id];
      const maxQty = selectedChallan.challan_bilties.find(c => c.id === cb_id).loaded_quantity;
      let received = current.received_qty;
      let short = current.short_qty;

      if (field === 'received_qty') { received = Math.min(parsed, maxQty); short = maxQty - received; } 
      else if (field === 'short_qty') { short = Math.min(parsed, maxQty); received = maxQty - short; }

      if(received < 0) received = 0; if(short < 0) short = 0;
      return { ...prev, [cb_id]: { received_qty: received, short_qty: short } };
    });
  };

  const submitVerification = async (e) => {
    e.preventDefault();
    setLoading(true); setMessage('');
    try {
      const verifications = selectedChallan.challan_bilties.map(cb => ({
        challan_id: selectedChallan.id, challan_bilty_id: cb.id, bilty_id: cb.bilty_id,
        expected_qty: cb.loaded_quantity, received_qty: verificationData[cb.id].received_qty, short_qty: verificationData[cb.id].short_qty
      }));

      const { data: insertedVerifications, error: verError } = await supabase.from('receiving_verifications').insert(verifications).select();
      if(verError) throw verError;

      const claimsToInsert = insertedVerifications.filter(ver => ver.short_qty > 0).map(ver => ({
        receiving_verification_id: ver.id, bilty_id: ver.bilty_id, short_qty: ver.short_qty, status: 'pending'
      }));

      if (claimsToInsert.length > 0) {
         const { error: claimError } = await supabase.from('short_claims').insert(claimsToInsert);
         if(claimError) throw claimError;
      }

      const { error: updateError } = await supabase.from('challans').update({ status: 'arrived' }).eq('id', selectedChallan.id);
      if(updateError) throw updateError;

      setMessage(`Vehicle ${selectedChallan.vehicle_number} Arrived safely! Data locked to ${branchName} Warehouse.`);
      setSelectedChallan(null); fetchBranchData();
    } catch (err) {
      console.error(err); setMessage(`Error verifying: ${err.message}`);
    }
    setLoading(false);
  };

  /* ------------------------------------------------------------- 
     B. DELIVERY HANDOVER LOGIC 
  ------------------------------------------------------------- */
  const handleSelectBilty = (item) => {
    setSelectedBilty(item);
    setRecentDelivery(null);
    setDeliveryFormData({
      customer_cnic: '', customer_phone: item.receiver_phone || '', delivered_qty: item.branch_available_qty,
      paid_amount: item.total_amount || 0, extra_labor: 0, extra_unloading: 0, local_fare: 0, extra_other: 0
    });
  };

  const handleDeliveryFormChange = (e) => setDeliveryFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const buildDeliveryReceiptHtml = (delivery) => {
    const biltyNumber = delivery.bilty_number || selectedBilty?.bilty_number || delivery.bilty_id;
    const totalAmount =
      (parseFloat(delivery.paid_amount) || 0) +
      (parseFloat(delivery.extra_labor) || 0) +
      (parseFloat(delivery.extra_unloading) || 0) +
      (parseFloat(delivery.local_fare) || 0) +
      (parseFloat(delivery.extra_other) || 0);

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Delivery Receipt</title><style>
      body { font-family: Arial, sans-serif; width: 80mm; margin: 0; padding: 8px; color: #000; }
      * { box-sizing: border-box; }
      .header { text-align: center; margin-bottom: 8px; }
      .header h1 { margin: 0; font-size: 16px; letter-spacing: 0.5px; }
      .header p { margin: 4px 0 0; font-size: 10px; }
      hr { border: none; border-top: 1px solid #000; margin: 8px 0; }
      .info { font-size: 11px; margin-bottom: 6px; }
      .info div { margin-bottom: 4px; }
      .amounts { width: 100%; font-size: 11px; }
      .amounts td { padding: 4px 0; }
      .total { font-weight: 700; font-size: 12px; }
      .footer { margin-top: 8px; font-size: 10px; line-height: 1.3; }
      @media print { body { width: 80mm; } }
    </style></head><body>
      <div class="header"><h1>Gul-e-Pakistan Goods Islamabad</h1></div>
      <hr />
      <div class="info"><div><strong>Bilty #:</strong> ${biltyNumber}</div>
      <div><strong>Customer CNIC:</strong> ${delivery.customer_cnic || '-'}</div>
      <div><strong>Customer Phone:</strong> ${delivery.customer_phone || '-'}</div>
      <div><strong>Delivered Qty:</strong> ${delivery.delivered_qty || '-'}</div></div>
      <hr />
      <table class="amounts">
        <tr><td>Freight</td><td style="text-align:right;">Rs. ${(parseFloat(delivery.paid_amount) || 0).toLocaleString()}</td></tr>
        <tr><td>Unloading</td><td style="text-align:right;">Rs. ${(parseFloat(delivery.extra_unloading) || 0).toLocaleString()}</td></tr>
        <tr><td>Loading</td><td style="text-align:right;">Rs. ${(parseFloat(delivery.extra_labor) || 0).toLocaleString()}</td></tr>
        <tr><td>Local Fare</td><td style="text-align:right;">Rs. ${(parseFloat(delivery.local_fare) || 0).toLocaleString()}</td></tr>
        <tr><td>Other Charges</td><td style="text-align:right;">Rs. ${(parseFloat(delivery.extra_other) || 0).toLocaleString()}</td></tr>
        <tr class="total"><td>Total</td><td style="text-align:right;">Rs. ${totalAmount.toLocaleString()}</td></tr>
      </table>
      <hr />
      <div class="footer">Thank you for choosing Gul-e-Pakistan. Please keep this receipt for reference.</div>
    </body></html>`;
  };

  const printDeliveryReceipt = (delivery) => {
    const printWindow = window.open('', '_blank', 'width=420,height=640');
    if (!printWindow) return;
    printWindow.document.write(buildDeliveryReceiptHtml(delivery));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 600);
  };

  const downloadDeliveryPdf = async (delivery) => {
    try {
      const temp = document.createElement('div');
      temp.style.width = '80mm';
      const fragmentHtml = buildDeliveryReceiptHtml(delivery)
        .replace(/^[\s\S]*?<body[^>]*>/i, '')
        .replace(/<\/body>[\s\S]*$/i, '');
      temp.innerHTML = fragmentHtml;
      document.body.appendChild(temp);
      const { default: html2pdf } = await import('html2pdf.js');
      await html2pdf().set({
        filename: `Delivery_${delivery.bilty_number || delivery.bilty_id || 'receipt'}.pdf`,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(temp).save();
      document.body.removeChild(temp);
    } catch (err) {
      console.error('PDF export failed:', err);
      setMessage(`PDF export failed: ${err.message || err}`);
    }
  };

  const savePendingLink = (link) => {
    const bClean = (branchName || 'Islamabad').trim().toLowerCase();
    const key1 = `${bClean}_account_statement_pending_link`;
    const key2 = 'islamabad_account_statement_pending_link';
    localStorage.setItem(key1, JSON.stringify(link));
    if (getScopedKey) localStorage.setItem(getScopedKey(key1), JSON.stringify(link));
    const prim = (primaryBranchName || 'Islamabad').trim().toLowerCase();
    if (bClean === 'islamabad' || bClean === prim) {
      localStorage.setItem(key2, JSON.stringify(link));
      if (getScopedKey) localStorage.setItem(getScopedKey(key2), JSON.stringify(link));
    }
  };

  const handleLinkAccountStatement = () => {
    const confirmed = window.confirm(
      `Before linking this bill to a customer account, please confirm permission.\n\n` +
      `This will create a debit entry on the ${branchName} Account Statement page for the total bill amount (Rs. ${deliveryTotal.toLocaleString('en-PK')}).`
    );
    if (!confirmed) {
      setMessage('Linking canceled.');
      return;
    }

    if (!selectedBilty) {
      setMessage('No selected bilty to link.');
      return;
    }

    const pendingLink = {
      bilty_number: selectedBilty?.bilty_number || selectedBilty?.bilty_id || 'N/A',
      total_amount: deliveryTotal,
      description: `Bilty #${selectedBilty?.bilty_number || selectedBilty?.bilty_id} - ${new Date().toLocaleDateString('en-PK')}`,
      date: new Date().toISOString().split('T')[0]
    };
    savePendingLink(pendingLink);
    setMessage('Pending bill saved. Open Account Statement to assign it to a customer account.');

    const bClean = (branchName || 'Islamabad').trim().toLowerCase();
    const prim = (primaryBranchName || 'Islamabad').trim().toLowerCase();
    if (bClean === 'islamabad' || bClean === prim) {
      navigate('/branch/islamabad/account-statement');
    } else {
      navigate(`/branch/${bClean}/account-statement`);
    }
  };

  const submitDelivery = async (e, printAfter = false) => {
    if (e?.preventDefault) e.preventDefault();
    
    // Calculate total income collected
    const totalIncome = deliveryTotal;
    
    // Request confirmation before submitting
    const confirmed = window.confirm(
      `Please confirm handover:\n\n` +
      `Bilty: ${selectedBilty?.bilty_number || '-'}\n` +
      `Receiver: ${selectedBilty?.receiver_name || '-'}\n` +
      `Quantity: ${deliveryFormData.delivered_qty}\n\n` +
      `Total Income Collected:\n` +
      `Freight: Rs. ${parseFloat(deliveryFormData.paid_amount || 0).toLocaleString()}\n` +
      `Unloading: Rs. ${parseFloat(deliveryFormData.extra_unloading || 0).toLocaleString()}\n` +
      `Loading: Rs. ${parseFloat(deliveryFormData.extra_labor || 0).toLocaleString()}\n` +
      `Local Fare: Rs. ${parseFloat(deliveryFormData.local_fare || 0).toLocaleString()}\n` +
      `Other Charges: Rs. ${parseFloat(deliveryFormData.extra_other || 0).toLocaleString()}\n\n` +
      `Total: Rs. ${totalIncome.toLocaleString()}\n\n` +
      `This amount will be added to ${branchName} Branch Finance automatically.`
    );
    
    if (!confirmed) {
      setMessage('Handover canceled.');
      return;
    }
    
    setLoading(true); setMessage('');
    setRecentDelivery(null);
    try {
      const payload = {
        bilty_id: selectedBilty.bilty_id, customer_cnic: deliveryFormData.customer_cnic, customer_phone: deliveryFormData.customer_phone,
        delivered_qty: parseInt(deliveryFormData.delivered_qty), paid_amount: parseFloat(deliveryFormData.paid_amount || 0),
        extra_labor: parseFloat(deliveryFormData.extra_labor || 0), extra_unloading: parseFloat(deliveryFormData.extra_unloading || 0), local_fare: parseFloat(deliveryFormData.local_fare || 0), extra_other: parseFloat(deliveryFormData.extra_other || 0)
      };

      const { data, error } = await supabase.from('deliveries').insert([withTenantId(payload)]).select().single();
      if (error) throw error;

      // Automatically add income entry to branch_ledgers if total income > 0
      if (totalIncome > 0) {
        const bKey = (branchName || 'Islamabad').trim().toLowerCase();
        const localEntry = {
          id: 'ledger_' + Date.now(),
          branch_name: branchName,
          entry_date: new Date().toISOString().split('T')[0],
          entry_type: 'income',
          description: `Delivery collected - Bilty #${selectedBilty?.bilty_number || 'N/A'}`,
          amount: totalIncome,
          created_at: new Date().toISOString()
        };

        const currentLocal = getTenantItem(`${bKey}_branch_ledgers`, []) || [];
        setTenantItem(`${bKey}_branch_ledgers`, [localEntry, ...currentLocal]);

        try {
          const payload = {
            branch_name: branchName,
            entry_date: localEntry.entry_date,
            entry_type: 'income',
            description: localEntry.description,
            amount: totalIncome
          };
          let { error: incomeError } = await supabase.from('branch_ledgers').insert([withTenantId(payload)]);
          if (incomeError && incomeError.message && incomeError.message.includes('tenant_id')) {
            await supabase.from('branch_ledgers').insert([payload]);
          }
        } catch (e) {
          console.warn('DB branch ledger sync notice:', e);
        }
      }

      const savedDelivery = {
        ...payload,
        ...data,
        bilty_number: selectedBilty?.bilty_number,
        receiver_name: selectedBilty?.receiver_name,
        description: selectedBilty?.description
      };

      setMessage(`Delivered ${payload.delivered_qty} items to customer! Income of Rs. ${totalIncome.toLocaleString()} added to ${branchName} Branch Finance.`);
      setRecentDelivery(savedDelivery);
      setSelectedBilty(null);
      fetchBranchData();
      if (printAfter) printDeliveryReceipt(savedDelivery);
    } catch (err) {
      console.error(err); setMessage(`Error submitting delivery: ${err.message}`);
    }
    setLoading(false);
  };


  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <MapPin size={32} color="#2563eb" />
        <h1 className="page-title" style={{ marginBottom: 0, color: '#1e40af', fontWeight: 800 }}>{branchName} Operations Hub</h1>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Securely manage isolated inventory and deliveries destined only for {branchName}.</p>

      {message && (
        <div style={{ padding: '12px', marginBottom: '20px', borderRadius: '6px', backgroundColor: message.includes('Error') ? '#fee2e2' : '#d1fae5', color: message.includes('Error') ? '#991b1b' : '#065f46' }}>
          {message}
        </div>
      )}

      {/* --- SECTION 1: INCOMING VEHICLES --- */}
      <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', color: '#2563eb', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
        🚛 1. Incoming Vehicles (Arrival Verification)
      </h2>
      {!selectedChallan ? (
        <div className="card" style={{ marginBottom: '32px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                <th style={{ padding: '12px 10px', color: '#2563eb', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Challan #</th>
                <th style={{ padding: '12px 10px', color: '#0f172a', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Date</th>
                <th style={{ padding: '12px 10px', color: '#0284c7', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Vehicle #</th>
                <th style={{ padding: '12px 10px', color: '#7c3aed', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Driver</th>
                <th style={{ padding: '12px 10px', color: '#0f172a', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {incomingChallans.map(ch => (
                <tr key={ch.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 10px', fontWeight: 700, color: '#2563eb' }}>{ch.challan_number}</td>
                  <td style={{ padding: '12px 10px' }}>{ch.challan_date ? new Date(ch.challan_date + 'T00:00:00').toLocaleDateString('en-PK') : '—'}</td>
                  <td style={{ padding: '12px 10px', fontWeight: 600, color: '#0284c7' }}>{ch.vehicle_number}</td>
                  <td style={{ padding: '12px 10px', fontWeight: 600, color: '#7c3aed' }}>{ch.driver_name}</td>
                  <td style={{ padding: '12px 10px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem', fontWeight: 600 }} onClick={() => setViewChallan(viewChallan?.id === ch.id ? null : ch)}>📋 View Bilties</button>
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem', fontWeight: 600 }} onClick={() => handlePrintChallan(ch)}>🖨️ Print</button>
                      <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.82rem', fontWeight: 600, backgroundColor: '#2563eb' }} onClick={() => handleSelectChallan(ch)}>✅ Verify Arrival</button>
                    </div>
                  </td>
                </tr>
              ))}
              {incomingChallans.length === 0 && <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No vehicles en-route to {branchName} right now.</td></tr>}
            </tbody>
          </table>
          {viewChallan && (
            <div style={{ marginTop: '16px', border: '1.5px solid #2563eb', borderRadius: '10px', padding: '16px', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ color: '#2563eb', fontSize: '1rem', fontWeight: 800, margin: 0 }}>📋 Challan #{viewChallan.challan_number} — Bilties Detail</h4>
                <button onClick={() => setViewChallan(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b', fontWeight: 700 }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px', fontSize: '0.85rem', color: '#475569' }}>
                <span>🚛 Vehicle: <strong style={{ color: '#0f172a' }}>{viewChallan.vehicle_number}</strong></span>
                <span>👤 Driver: <strong style={{ color: '#0f172a' }}>{viewChallan.driver_name}</strong></span>
                {viewChallan.route_number && <span>🛣️ Route: <strong style={{ color: '#0f172a' }}>{viewChallan.route_number}</strong></span>}
                {viewChallan.road_permit_number && <span>📄 Permit: <strong style={{ color: '#0f172a' }}>{viewChallan.road_permit_number}</strong></span>}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#e2e8f0', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#0f172a', fontWeight: 800 }}>#</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#2563eb', fontWeight: 800 }}>Bilty #</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#0284c7', fontWeight: 800 }}>Destination</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#475569', fontWeight: 800 }}>Description</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', color: '#059669', fontWeight: 800 }}>Loaded Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {viewChallan.challan_bilties.map((cb, i) => (
                    <tr key={cb.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px 10px' }}>{i + 1}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#2563eb' }}>{cb.bilties?.bilty_number}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{cb.bilties?.branches?.name || '-'}</td>
                      <td style={{ padding: '8px 10px' }}>{cb.bilties?.description}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>{cb.loaded_quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ border: '2px solid #2563eb', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
             <h3 style={{ margin: 0, color: '#2563eb', fontWeight: 800, fontSize: '1.2rem' }}>Verifying Challan #{selectedChallan.challan_number}</h3>
             <button className="btn btn-secondary" onClick={() => setSelectedChallan(null)} style={{ fontWeight: 600 }}>Cancel</button>
          </div>
          <form onSubmit={submitVerification}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '24px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '12px 10px', color: '#2563eb', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Bilty #</th>
                  <th style={{ padding: '12px 10px', color: '#0284c7', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Expected</th>
                  <th style={{ padding: '12px 10px', color: '#059669', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Received</th>
                  <th style={{ padding: '12px 10px', color: '#dc2626', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Short</th>
                </tr>
              </thead>
              <tbody>
                {selectedChallan.challan_bilties.map(cb => {
                  const bInfo = cb.bilties; const vData = verificationData[cb.id];
                  return (
                    <tr key={cb.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 10px', fontWeight: 700, color: '#2563eb' }}>{bInfo.bilty_number}</td>
                      <td style={{ padding: '12px 10px', fontWeight: 800, color: '#0284c7' }}>{cb.loaded_quantity}</td>
                      <td style={{ padding: '12px 10px' }}><input type="number" min="0" max={cb.loaded_quantity} value={vData.received_qty} onChange={(e) => handleQtyChange(cb.id, 'received_qty', e.target.value)} style={{ width: '100px', height: '38px', padding: '6px 10px', fontSize: '0.95rem', fontWeight: 700, borderRadius: '6px', border: '1.5px solid #059669' }} /></td>
                      <td style={{ padding: '12px 10px' }}><input type="number" min="0" max={cb.loaded_quantity} value={vData.short_qty} onChange={(e) => handleQtyChange(cb.id, 'short_qty', e.target.value)} style={{ width: '100px', height: '38px', padding: '6px 10px', fontSize: '0.95rem', fontWeight: 700, borderRadius: '6px', border: '1.5px solid #dc2626', color: vData.short_qty > 0 ? '#dc2626' : 'inherit' }} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px', fontWeight: 700, fontSize: '0.95rem', backgroundColor: '#2563eb' }} disabled={loading}>{loading ? 'Processing...' : 'Confirm Arrival'}</button>
          </form>
        </div>
      )}

      {/* --- SECTION 2: BRANCH WAREHOUSE & DELIVERY --- */}
      <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', color: '#059669', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
         <PackageOpen size={22} color="#059669" /> 2. {branchName} Warehouse (Customer Deliveries)
      </h2>
      {!selectedBilty ? (
        <>
          {recentDelivery && (
            <div className="card" style={{ marginBottom: '20px', padding: '16px', border: '1px solid #d1d5db', backgroundColor: '#f8fafc' }}>
              <div style={{ marginBottom: '12px', fontWeight: 700, color: '#111827' }}>Delivery recorded successfully. Print or download the receipt:</div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" style={{ padding: '10px 16px', fontWeight: 700 }} onClick={() => printDeliveryReceipt(recentDelivery)}>Print Receipt</button>
                <button className="btn btn-primary" style={{ padding: '10px 16px', backgroundColor: '#3b82f6', border: 'none', fontWeight: 700 }} onClick={() => downloadDeliveryPdf(recentDelivery)}>Download PDF</button>
              </div>
            </div>
          )}
          <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                <th style={{ padding: '12px 10px', color: '#2563eb', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Bilty #</th>
                <th style={{ padding: '12px 10px', color: '#0f172a', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Receiver</th>
                <th style={{ padding: '12px 10px', color: '#64748b', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Desc</th>
                <th style={{ padding: '12px 10px', color: '#059669', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', textAlign: 'right' }}>Stock Ready</th>
                <th style={{ padding: '12px 10px', color: '#0f172a', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {warehouseInventory.map(item => (
                <tr key={item.bilty_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 10px', fontWeight: 700, color: '#2563eb' }}>{item.bilty_number}</td>
                  <td style={{ padding: '12px 10px', fontWeight: 600 }}>{item.receiver_name}</td>
                  <td style={{ padding: '12px 10px', color: '#475569' }}>{item.description}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 800, color: '#059669', fontSize: '1rem' }}>{item.branch_available_qty}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'center' }}><button className="btn btn-secondary" style={{ padding: '6px 14px', fontWeight: 700, color: '#059669', borderColor: '#86efac' }} onClick={() => handleSelectBilty(item)}>Handover</button></td>
                </tr>
              ))}
              {warehouseInventory.length === 0 && <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>Warehouse is empty.</td></tr>}
            </tbody>
          </table>
        </div>
        </>
      ) : (
        <div className="card" style={{ border: '2px solid #10b981', boxShadow: '0 4px 16px rgba(16, 185, 129, 0.12)', borderRadius: '12px' }}>
          {/* Card Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '14px', borderBottom: '2px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
               <span style={{ fontSize: '1.4rem' }}>📦</span>
               <div>
                 <h3 style={{ margin: 0, color: '#059669', fontWeight: 900, fontSize: '1.3rem' }}>
                   Delivering Bilty #{selectedBilty.bilty_number}
                 </h3>
                 <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                   Receiver: <strong style={{ color: '#0f172a' }}>{selectedBilty.receiver_name}</strong> | Item: <strong style={{ color: '#0f172a' }}>{selectedBilty.description}</strong>
                 </span>
               </div>
             </div>
             <button className="btn btn-secondary" onClick={() => setSelectedBilty(null)} style={{ fontWeight: 700, padding: '8px 16px' }}>✕ Cancel</button>
          </div>

          <form onSubmit={submitDelivery}>
            {/* Top 2-Column Responsive Grid: Delivering Details (Left) and Income Collection (Right) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '22px', alignItems: 'stretch' }}>
              
              {/* Left Column: Customer & Delivery Info */}
              <div style={{ padding: '18px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1.5px solid #cbd5e1', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ margin: '0 0 14px 0', color: '#2563eb', fontSize: '1.08rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    👤 Customer & Delivery Info
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px', display: 'block' }}>
                        Customer CNIC
                      </label>
                      <input
                        type="text"
                        name="customer_cnic"
                        value={deliveryFormData.customer_cnic}
                        onChange={handleDeliveryFormChange}
                        placeholder="e.g. 37405-1234567-1"
                        style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: '#fff' }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px', display: 'block' }}>
                        Customer Phone <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        name="customer_phone"
                        value={deliveryFormData.customer_phone}
                        onChange={handleDeliveryFormChange}
                        placeholder="e.g. 0321-1234567"
                        required
                        style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: '#fff' }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                          Deliver Qty <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#059669', background: '#dcfce7', padding: '2px 8px', borderRadius: '6px' }}>
                          Max: {selectedBilty.branch_available_qty}
                        </span>
                      </div>
                      <input
                        type="number"
                        min="1"
                        max={selectedBilty.branch_available_qty}
                        name="delivered_qty"
                        value={deliveryFormData.delivered_qty}
                        onChange={handleDeliveryFormChange}
                        required
                        style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1.05rem', fontWeight: 800, borderRadius: '8px', border: '2px solid #10b981', background: '#f0fdf4' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Income Collection (Beside Customer Details, No Scrolling needed!) */}
              <div style={{ padding: '18px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1.5px solid #86efac', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h4 style={{ margin: 0, color: '#15803d', fontSize: '1.08rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      💰 Income Collection
                    </h4>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534', background: '#dcfce7', padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                      Auto Ledger Post
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1d4ed8', marginBottom: '4px', display: 'block' }}>Freight (Rent)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="paid_amount"
                        value={deliveryFormData.paid_amount}
                        onChange={handleDeliveryFormChange}
                        style={{ width: '100%', height: '42px', padding: '9px 12px', fontSize: '1rem', fontWeight: 700, borderRadius: '8px', border: '1.5px solid #93c5fd', background: '#fff' }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#d97706', marginBottom: '4px', display: 'block' }}>Unloading</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="extra_unloading"
                        value={deliveryFormData.extra_unloading}
                        onChange={handleDeliveryFormChange}
                        style={{ width: '100%', height: '42px', padding: '9px 12px', fontSize: '1rem', fontWeight: 700, borderRadius: '8px', border: '1.5px solid #fde68a', background: '#fff' }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#b45309', marginBottom: '4px', display: 'block' }}>Loading</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="extra_labor"
                        value={deliveryFormData.extra_labor}
                        onChange={handleDeliveryFormChange}
                        style={{ width: '100%', height: '42px', padding: '9px 12px', fontSize: '1rem', fontWeight: 700, borderRadius: '8px', border: '1.5px solid #fde68a', background: '#fff' }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#7c3aed', marginBottom: '4px', display: 'block' }}>Local Fare</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="local_fare"
                        value={deliveryFormData.local_fare}
                        onChange={handleDeliveryFormChange}
                        style={{ width: '100%', height: '42px', padding: '9px 12px', fontSize: '1rem', fontWeight: 700, borderRadius: '8px', border: '1.5px solid #c4b5fd', background: '#fff' }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>Other Charges</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="extra_other"
                        value={deliveryFormData.extra_other}
                        onChange={handleDeliveryFormChange}
                        style={{ width: '100%', height: '42px', padding: '9px 12px', fontSize: '1rem', fontWeight: 700, borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#fff' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Live Total Amount Box */}
                <div style={{ padding: '12px 16px', borderRadius: '10px', background: '#ffffff', border: '2px solid #86efac', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Amount</span>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Rent + Unloading + Loading + Fare + Other</div>
                  </div>
                  <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#15803d' }}>
                    Rs. {deliveryTotal.toLocaleString('en-PK')}
                  </span>
                </div>
              </div>

            </div>

            {/* Bottom Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, minWidth: '180px', padding: '12px 18px', backgroundColor: '#10b981', border: 'none', fontWeight: 800, fontSize: '0.98rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} disabled={loading}>
                {loading ? 'Processing...' : '✅ Confirm Delivery'}
              </button>
              <button type="button" className="btn btn-secondary" style={{ flex: 1, minWidth: '180px', padding: '12px 18px', fontWeight: 800, fontSize: '0.98rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} disabled={loading} onClick={(e) => submitDelivery(e, true)}>
                {loading ? 'Processing...' : '🖨️ Confirm & Print'}
              </button>
              <button type="button" className="btn btn-secondary" style={{ flex: 1, minWidth: '180px', padding: '12px 18px', backgroundColor: '#f59e0b', color: '#fff', border: 'none', fontWeight: 800, fontSize: '0.98rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} disabled={loading} onClick={handleLinkAccountStatement}>
                {loading ? 'Processing...' : '🔗 Link Account Statement'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
