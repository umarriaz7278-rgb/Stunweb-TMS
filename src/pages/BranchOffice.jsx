import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { MapPin, PackageOpen } from 'lucide-react';

export default function BranchOffice({ branchName }) {
  const navigate = useNavigate();
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
    // 1. Fetch In-Transit vehicles. 
    // Filter locally to ensure we only grab vehicles sent to THIS branch.
    const { data: challansData } = await supabase
      .from('challans')
      .select(`
        *,
        challan_bilties (
          id, loaded_quantity, bilty_id,
          bilties ( bilty_number, description, sender_name, receiver_name, total_quantity, total_amount, local_freight, labor_charges, branches(name) )
        )
      `)
      .eq('status', 'in_transit');

    if (challansData) {
      const filteredChallans = challansData.filter(ch => {
         if (!ch.challan_bilties || ch.challan_bilties.length === 0) return false;
         // Check the branch of the first bilty (vehicles are branch-specific)
         return ch.challan_bilties[0].bilties.branches?.name === branchName;
      });
      setIncomingChallans(filteredChallans);
    }

    // 2. Fetch Branch Warehouse Inventory for Handover
    const { data: inventoryData } = await supabase
      .from('branch_warehouse_inventory')
      .select('*')
      .eq('destination_name', branchName);

    if (inventoryData) setWarehouseInventory(inventoryData);
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
    localStorage.setItem('islamabad_account_statement_pending_link', JSON.stringify(link));
  };

  const handleLinkAccountStatement = () => {
    const confirmed = window.confirm(
      `Before linking this bill to a customer account, please confirm permission.\n\n` +
      `This will create a debit entry on the Islamabad Account Statement page for the total bill amount.`
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
    navigate('/branch/islamabad/account-statement');
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

      const { data, error } = await supabase.from('deliveries').insert([payload]).select().single();
      if (error) throw error;

      // Automatically add income entry to branch_ledgers if total income > 0
      if (totalIncome > 0) {
        const incomeEntry = {
          branch_name: branchName,
          entry_date: new Date().toISOString().split('T')[0],
          entry_type: 'income',
          description: `Delivery collected - Bilty #${selectedBilty?.bilty_number || 'N/A'}`,
          amount: totalIncome
        };
        const { error: incomeError } = await supabase.from('branch_ledgers').insert([incomeEntry]);
        if (incomeError) console.error('Warning: Failed to add income entry to ledger:', incomeError);
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
        <MapPin size={32} color="var(--primary-color)" />
        <h1 className="page-title" style={{ marginBottom: 0 }}>{branchName} Operations Hub</h1>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Securely manage isolated inventory and deliveries destined only for {branchName}.</p>

      {message && (
        <div style={{ padding: '12px', marginBottom: '20px', borderRadius: '6px', backgroundColor: message.includes('Error') ? '#fee2e2' : '#d1fae5', color: message.includes('Error') ? '#991b1b' : '#065f46' }}>
          {message}
        </div>
      )}

      {/* --- SECTION 1: INCOMING VEHICLES --- */}
      <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--primary-color)' }}>1. Incoming Vehicles (Arrival Verification)</h2>
      {!selectedChallan ? (
        <div className="card" style={{ marginBottom: '32px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '12px' }}>Challan #</th>
                <th style={{ padding: '12px' }}>Date</th>
                <th style={{ padding: '12px' }}>Vehicle #</th>
                <th style={{ padding: '12px' }}>Driver</th>
                <th style={{ padding: '12px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {incomingChallans.map(ch => (
                <tr key={ch.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{ch.challan_number}</td>
                  <td style={{ padding: '12px' }}>{ch.challan_date ? new Date(ch.challan_date + 'T00:00:00').toLocaleDateString('en-PK') : '—'}</td>
                  <td style={{ padding: '12px' }}>{ch.vehicle_number}</td>
                  <td style={{ padding: '12px' }}>{ch.driver_name}</td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '0.8rem' }} onClick={() => setViewChallan(viewChallan?.id === ch.id ? null : ch)}>📋 View Bilties</button>
                      <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '0.8rem' }} onClick={() => handlePrintChallan(ch)}>🖨️ Print</button>
                      <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '0.8rem' }} onClick={() => handleSelectChallan(ch)}>✅ Verify Arrival</button>
                    </div>
                  </td>
                </tr>
              ))}
              {incomingChallans.length === 0 && <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No vehicles en-route to {branchName} right now.</td></tr>}
            </tbody>
          </table>
          {viewChallan && (
            <div style={{ marginTop: '16px', border: '1px solid var(--primary-color)', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ color: 'var(--primary-color)', fontSize: '0.95rem' }}>📋 Challan #{viewChallan.challan_number} — Bilties Detail</h4>
                <button onClick={() => setViewChallan(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <span>🚛 Vehicle: <strong style={{ color: 'var(--text-main)' }}>{viewChallan.vehicle_number}</strong></span>
                <span>👤 Driver: <strong style={{ color: 'var(--text-main)' }}>{viewChallan.driver_name}</strong></span>
                {viewChallan.route_number && <span>🛣️ Route: <strong style={{ color: 'var(--text-main)' }}>{viewChallan.route_number}</strong></span>}
                {viewChallan.road_permit_number && <span>📄 Permit: <strong style={{ color: 'var(--text-main)' }}>{viewChallan.road_permit_number}</strong></span>}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '7px 10px', textAlign: 'left' }}>#</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left' }}>Bilty #</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left' }}>Destination</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left' }}>Description</th>
                    <th style={{ padding: '7px 10px', textAlign: 'right' }}>Loaded Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {viewChallan.challan_bilties.map((cb, i) => (
                    <tr key={cb.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '7px 10px' }}>{i + 1}</td>
                      <td style={{ padding: '7px 10px', fontWeight: 700, color: 'var(--primary-color)' }}>{cb.bilties?.bilty_number}</td>
                      <td style={{ padding: '7px 10px' }}>{cb.bilties?.branches?.name || '-'}</td>
                      <td style={{ padding: '7px 10px' }}>{cb.bilties?.description}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>{cb.loaded_quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ border: '1px solid var(--primary-color)', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
             <h3>Verifying Challan #{selectedChallan.challan_number}</h3>
             <button className="btn btn-secondary" onClick={() => setSelectedChallan(null)}>Cancel</button>
          </div>
          <form onSubmit={submitVerification}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '24px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '12px' }}>Bilty #</th>
                  <th style={{ padding: '12px' }}>Expected</th>
                  <th style={{ padding: '12px' }}>Received</th>
                  <th style={{ padding: '12px' }}>Short</th>
                </tr>
              </thead>
              <tbody>
                {selectedChallan.challan_bilties.map(cb => {
                  const bInfo = cb.bilties; const vData = verificationData[cb.id];
                  return (
                    <tr key={cb.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{bInfo.bilty_number}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{cb.loaded_quantity}</td>
                      <td style={{ padding: '12px' }}><input type="number" min="0" max={cb.loaded_quantity} value={vData.received_qty} onChange={(e) => handleQtyChange(cb.id, 'received_qty', e.target.value)} style={{ width: '80px', padding: '6px' }} /></td>
                      <td style={{ padding: '12px' }}><input type="number" min="0" max={cb.loaded_quantity} value={vData.short_qty} onChange={(e) => handleQtyChange(cb.id, 'short_qty', e.target.value)} style={{ width: '80px', padding: '6px', color: vData.short_qty > 0 ? '#ef4444' : 'inherit' }} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Processing...' : 'Confirm Arrival'}</button>
          </form>
        </div>
      )}

      {/* --- SECTION 2: BRANCH WAREHOUSE & DELIVERY --- */}
      <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
         <PackageOpen size={20} /> 2. {branchName} Warehouse (Customer Deliveries)
      </h2>
      {!selectedBilty ? (
        <>
          {recentDelivery && (
            <div className="card" style={{ marginBottom: '20px', padding: '16px', border: '1px solid #d1d5db', backgroundColor: '#f8fafc' }}>
              <div style={{ marginBottom: '12px', fontWeight: 700, color: '#111827' }}>Delivery recorded successfully. Print or download the receipt:</div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" style={{ padding: '10px 16px' }} onClick={() => printDeliveryReceipt(recentDelivery)}>Print Receipt</button>
                <button className="btn btn-primary" style={{ padding: '10px 16px', backgroundColor: '#3b82f6', border: 'none' }} onClick={() => downloadDeliveryPdf(recentDelivery)}>Download PDF</button>
              </div>
            </div>
          )}
          <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '12px' }}>Bilty #</th>
                <th style={{ padding: '12px' }}>Receiver</th>
                <th style={{ padding: '12px' }}>Desc</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Stock Ready</th>
                <th style={{ padding: '12px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {warehouseInventory.map(item => (
                <tr key={item.bilty_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{item.bilty_number}</td>
                  <td style={{ padding: '12px' }}>{item.receiver_name}</td>
                  <td style={{ padding: '12px' }}>{item.description}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#10b981' }}>{item.branch_available_qty}</td>
                  <td style={{ padding: '12px' }}><button className="btn btn-secondary" onClick={() => handleSelectBilty(item)}>Handover</button></td>
                </tr>
              ))}
              {warehouseInventory.length === 0 && <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>Warehouse is empty.</td></tr>}
            </tbody>
          </table>
        </div>
        </>
      ) : (
        <div className="card" style={{ border: '1px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
             <h3>Delivering Bilty #{selectedBilty.bilty_number}</h3>
             <button className="btn btn-secondary" onClick={() => setSelectedBilty(null)}>Cancel</button>
          </div>
          <form onSubmit={submitDelivery}>
            <div className="form-grid" style={{ marginBottom: '20px' }}>
              <div className="form-group"><label>Customer CNIC</label><input type="text" name="customer_cnic" value={deliveryFormData.customer_cnic} onChange={handleDeliveryFormChange} /></div>
              <div className="form-group"><label>Customer Phone</label><input type="text" name="customer_phone" value={deliveryFormData.customer_phone} onChange={handleDeliveryFormChange} required /></div>
              <div className="form-group full-width"><label>Deliver Qty (Max: {selectedBilty.branch_available_qty})</label><input type="number" min="1" max={selectedBilty.branch_available_qty} name="delivered_qty" value={deliveryFormData.delivered_qty} onChange={handleDeliveryFormChange} required style={{ border: '2px solid #10b981' }} /></div>
            </div>
            <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '16px' }}>Income Collection</h4>
              <div className="form-grid">
                 <div className="form-group"><label>Freight</label><input type="number" step="0.01" min="0" name="paid_amount" value={deliveryFormData.paid_amount} onChange={handleDeliveryFormChange} /></div>
                 <div className="form-group"><label>Unloading</label><input type="number" step="0.01" min="0" name="extra_unloading" value={deliveryFormData.extra_unloading} onChange={handleDeliveryFormChange} /></div>
                 <div className="form-group"><label>Loading</label><input type="number" step="0.01" min="0" name="extra_labor" value={deliveryFormData.extra_labor} onChange={handleDeliveryFormChange} /></div>
                 <div className="form-group"><label>Local Fare</label><input type="number" step="0.01" min="0" name="local_fare" value={deliveryFormData.local_fare} onChange={handleDeliveryFormChange} /></div>
                 <div className="form-group"><label>Other Charges</label><input type="number" step="0.01" min="0" name="extra_other" value={deliveryFormData.extra_other} onChange={handleDeliveryFormChange} /></div>
              </div>
              <div style={{ gridColumn: '1 / -1', marginTop: '10px', padding: '10px 14px', borderRadius: '8px', background: '#ffffff', border: '1px solid #d1d5db' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontWeight: 700, color: '#111827' }}>Total Amount</span>
                  <span style={{ fontWeight: 900, color: '#10b981' }}>Rs. {deliveryTotal.toLocaleString('en-PK')}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, minWidth: '200px', padding: '12px', backgroundColor: '#10b981', border: 'none' }} disabled={loading}>{loading ? 'Processing...' : 'Confirm Delivery'}</button>
              <button type="button" className="btn btn-secondary" style={{ flex: 1, minWidth: '200px', padding: '12px' }} disabled={loading} onClick={(e) => submitDelivery(e, true)}>{loading ? 'Processing...' : 'Confirm & Print'}</button>
              {branchName === 'Islamabad' && (
                <button type="button" className="btn btn-secondary" style={{ flex: 1, minWidth: '200px', padding: '12px', backgroundColor: '#f59e0b', color: '#fff', border: 'none' }} disabled={loading} onClick={handleLinkAccountStatement}>
                  {loading ? 'Processing...' : 'Link Account Statement'}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
