import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Truck } from 'lucide-react';

export default function ChallanCreate() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [savedChallan, setSavedChallan] = useState(null);

  // Branch filter (not printed)
  const [selectedBranch, setSelectedBranch] = useState('');

  // Form Fields
  const [formData, setFormData] = useState({
    vehicle_number: '',
    route_number: '',
    broker_name: '',
    driver_name: '',
    commission_deduction: 0,
    vehicle_freight: 0,
    branch_deposit: 0
  });

  // Commission percentage state
  const [commissionPct, setCommissionPct] = useState('');

  // Challan Date
  const [challanDate, setChallanDate] = useState(new Date().toISOString().split('T')[0]);

  // Selected Bilties: { bilty_id: { loaded_quantity, total_amount, remaining_quantity } }
  const [selectedBilties, setSelectedBilties] = useState({});

  // Store bilty charges keyed by bilty id
  const [biltyCharges, setBiltyCharges] = useState({});

  useEffect(() => {
    async function fetchInventory() {
      const { data } = await supabase
        .from('pending_warehouse_inventory')
        .select('*');
      if (data) {
        setInventory(data);
        // Fetch charges for each bilty from bilties table
        const ids = data.map(d => d.id);
        if (ids.length > 0) {
          const { data: chargesData } = await supabase
            .from('bilties')
            .select('id, custom_amount, local_freight, labor_charges, tt_expense')
            .in('id', ids);
          if (chargesData) {
            const chargesMap = {};
            chargesData.forEach(b => { chargesMap[b.id] = b; });
            setBiltyCharges(chargesMap);
          }
        }
      }
    }
    fetchInventory();
  }, []);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelection = (item, checked) => {
    if (checked) {
      setSelectedBilties(prev => ({
        ...prev,
        [item.id]: {
          loaded_quantity: item.remaining_quantity, // default full remaining
          remaining_quantity: item.remaining_quantity,
          total_amount: item.total_amount,
          total_quantity: item.total_quantity
        }
      }));
    } else {
      setSelectedBilties(prev => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
    }
  };

  const handleQuantityChange = (id, newQty) => {
    setSelectedBilties(prev => ({
      ...prev,
      [id]: { ...prev[id], loaded_quantity: parseInt(newQty) || 0 }
    }));
  };

  // Calculations
  // Filtered inventory based on selected branch
  const filteredInventory = selectedBranch
    ? inventory.filter(item => item.destination_name === selectedBranch)
    : [];

  const calculatedTotalBiltyAmount = Object.values(selectedBilties).reduce((acc, b) => {
    const ratio = b.loaded_quantity / b.total_quantity;
    return acc + (b.total_amount * ratio);
  }, 0);

  // Sum of all selected bilties' Local Fare
  const totalLocalFare = Object.keys(selectedBilties).reduce((acc, bid) => {
    const charges = biltyCharges[bid] || {};
    return acc + Number(charges.local_freight || 0);
  }, 0);

  // Sum of all selected bilties' Loading charges
  const totalLoading = Object.keys(selectedBilties).reduce((acc, bid) => {
    const charges = biltyCharges[bid] || {};
    return acc + Number(charges.labor_charges || 0);
  }, 0);

  // Net Rent Amount = Total Rent Amount - (Total Local Fare + Total Loading)
  const netRentAmount = calculatedTotalBiltyAmount - (totalLocalFare + totalLoading);

  // Commission Deduction on Net Rent Amount
  const commissionDeduction = parseFloat(formData.commission_deduction || 0);

  // After Commission = Net Rent Amount - Commission Deduction
  const afterCommission = netRentAmount - commissionDeduction;

  // After Vehicle Freight
  const afterVehicleFreight = afterCommission - parseFloat(formData.vehicle_freight || 0);

  // Profit = After Vehicle Freight + Total Local Fare + Total Loading
  const profit = afterVehicleFreight + totalLocalFare + totalLoading;

  // Receivable from Broker = Profit - Branch Deposit
  const branchDeposit = parseFloat(formData.branch_deposit || 0);
  const receivableFromBroker = profit - branchDeposit;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (Object.keys(selectedBilties).length === 0) {
      setMessage('Error: Please select at least one bilty to create a challan.');
      return;
    }
    if (formData.broker_name && formData.broker_name.trim()) {
      const confirmed = window.confirm(`Broker name entered: ${formData.broker_name}\n\nPlease confirm you have obtained permission from this broker before dispatching.`);
      if (!confirmed) {
        setMessage('Dispatch canceled. Please obtain broker permission before proceeding.');
        return;
      }
    }
    setLoading(true);
    setMessage('');

    // 1. Create Challan
    const { data: challanData, error: challanError } = await supabase
      .from('challans')
      .insert([{
        vehicle_number: formData.vehicle_number,
        route_number: formData.route_number,
        broker_name: formData.broker_name,
        driver_name: formData.driver_name,
        challan_date: challanDate,
        total_bilty_amount: calculatedTotalBiltyAmount,
        labor_deduction: 0,
        commission_deduction: commissionDeduction,
        other_deduction: 0,
        vehicle_freight: parseFloat(formData.vehicle_freight || 0),
        branch_deposit: branchDeposit,
        status: 'in_transit'
      }])
      .select();

    if (challanError) {
      setMessage(`Error creating challan: ${challanError.message}`);
      setLoading(false);
      return;
    }

    const challanId = challanData[0].id;
    const challanNum = challanData[0].challan_number;

    // 2. Create Challan Bilties link
    const links = Object.entries(selectedBilties).map(([bilty_id, obj]) => ({
      challan_id: challanId,
      bilty_id: bilty_id,
      loaded_quantity: obj.loaded_quantity
    }));

    const { error: linkError } = await supabase.from('challan_bilties').insert(links);

    if (linkError) {
      setMessage(`Details error: ${linkError.message}`);
    } else {
      setMessage(`Challan #${challanNum} Created Successfully and dispatched!`);
      // Snapshot for print
      const biltySnapshot = Object.entries(selectedBilties).map(([bid, obj]) => {
        const inv = inventory.find(i => String(i.id) === String(bid));
        const charges = biltyCharges[bid] || {};
        return { ...obj, bilty_number: inv?.bilty_number, destination: inv?.destination_name, description: inv?.description, sender: inv?.sender_name, receiver: inv?.receiver_name, local_fare: Number(charges.local_freight || 0), loading: Number(charges.labor_charges || 0) };
      });
      setSavedChallan({
        challan_number: challanNum,
        date: new Date(challanDate + 'T00:00:00').toLocaleDateString('en-PK'),
        vehicle_number: formData.vehicle_number,
        driver_name: formData.driver_name,
        route_number: formData.route_number,
        broker_name: formData.broker_name,
        branch: selectedBranch,
        bilties: biltySnapshot,
        total_bilty_amount: calculatedTotalBiltyAmount,
        total_local_fare: totalLocalFare,
        total_loading: totalLoading,
        net_rent_amount: netRentAmount,
        commission_deduction: commissionDeduction,
        vehicle_freight: parseFloat(formData.vehicle_freight || 0),
        branch_deposit: branchDeposit,
        receivable_from_broker: receivableFromBroker,
        profit
      });
      // Update inventory list locally to remove loaded quantities
      setInventory(prev => prev.map(inv => {
        if(selectedBilties[inv.id]) {
          return { ...inv, remaining_quantity: inv.remaining_quantity - selectedBilties[inv.id].loaded_quantity };
        }
        return inv;
      }).filter(inv => inv.remaining_quantity > 0));
      setSelectedBilties({});
      setSelectedBranch('');
      setCommissionPct('');
      setChallanDate(new Date().toISOString().split('T')[0]);
      setFormData({
        vehicle_number: '', route_number: '', broker_name: '', driver_name: '',
        commission_deduction: 0, vehicle_freight: 0, branch_deposit: 0
      });
    }
    setLoading(false);
  };

  const handlePrint = async () => {
    if (!savedChallan) return;
    const c = savedChallan;

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

    const biltyRows = c.bilties.map((b, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><b>${b.bilty_number || '-'}</b></td>
        <td>${b.description || '-'}</td>
        <td>${b.sender || '-'}</td>
        <td>${b.receiver || '-'}</td>
        <td style='text-align:right'>${b.loaded_quantity} / ${b.total_quantity}</td>
        <td style='text-align:right'>Rs. ${Number(b.local_fare || 0).toLocaleString()}</td>
        <td style='text-align:right'>Rs. ${Number(b.loading || 0).toLocaleString()}</td>
        <td style='text-align:right'>Rs. ${Number(b.total_amount * (b.loaded_quantity / b.total_quantity)).toLocaleString()}</td>
      </tr>`).join('');

    const challanHTML = `
      <div class="challan-copy">
        <div class="header-img"><img src="${headerBase64}" alt="Header" /></div>
        <div class="info-row">
          <div class="info-cell"><span class="label">Challan #</span><span class="value bold">${c.challan_number}</span></div>
          <div class="info-cell"><span class="label">Date</span><span class="value">${c.date}</span></div>
          <div class="info-cell"><span class="label">Vehicle</span><span class="value">${c.vehicle_number}</span></div>
          <div class="info-cell"><span class="label">Driver</span><span class="value">${c.driver_name}</span></div>
          ${c.route_number ? `<div class="info-cell"><span class="label">Route #</span><span class="value">${c.route_number}</span></div>` : ''}
          ${c.broker_name ? `<div class="info-cell"><span class="label">Broker</span><span class="value">${c.broker_name}</span></div>` : ''}
          ${c.branch ? `<div class="info-cell"><span class="label">Branch</span><span class="value bold">${c.branch}</span></div>` : ''}
        </div>
        <div class="section-title">Bilties in this Challan</div>
        <table>
          <thead><tr><th>#</th><th>Bilty #</th><th>Description</th><th>Sender</th><th>Receiver</th><th>Loaded/Total</th><th>Local Fare</th><th>Loading</th><th class="total-col">Amount</th></tr></thead>
          <tbody>${biltyRows}</tbody>
        </table>
        <div class="section-title">Financial Summary</div>
        <div class="finance-box">
          <div class="fin-row"><span>Total Rent Amount:</span><strong>Rs. ${c.total_bilty_amount.toLocaleString()}</strong></div>
          <div class="fin-row dim"><span>Total Local Fare (all bilties):</span><strong>- Rs. ${c.total_local_fare.toLocaleString()}</strong></div>
          <div class="fin-row dim"><span>Total Loading (all bilties):</span><strong>- Rs. ${c.total_loading.toLocaleString()}</strong></div>
          <div class="fin-row net"><span>Net Rent Amount:</span><strong>Rs. ${c.net_rent_amount.toLocaleString()}</strong></div>
          <div class="fin-row dim"><span>Delivery:</span><strong>- Rs. ${c.commission_deduction.toLocaleString()}</strong></div>
          <div class="fin-row add"><span>+ Add Local Fare:</span><strong>+ Rs. ${c.total_local_fare.toLocaleString()}</strong></div>
          <div class="fin-row add"><span>+ Add Loading:</span><strong>+ Rs. ${c.total_loading.toLocaleString()}</strong></div>
          <div class="fin-row dim"><span>Branch Deposit:</span><strong>- Rs. ${(c.branch_deposit || 0).toLocaleString()}</strong></div>
          <div class="fin-row profit"><span>Topay:</span><strong style="color:#3B82F6">Rs. ${(c.net_rent_amount - c.commission_deduction + c.total_local_fare + c.total_loading - (c.branch_deposit || 0)).toLocaleString()}</strong></div>
        </div>

      </div>`;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Challan #${c.challan_number}</title><style>
      @page { size: A4; margin: 8mm 10mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; font-weight: 900 !important; -webkit-text-stroke: 0.3px #000; color: #000 !important; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #000; background: #f5f0e8; }
      .challan-copy { width: 100%; padding: 4mm 2mm 2mm 2mm; border: 2px solid #000; border-radius: 3px; overflow: hidden; page-break-inside: avoid; background: #f5f0e8; }
      .challan-copy + .challan-copy { margin-top: 3vh; }
      .header-img { margin-bottom: 0; width: 100%; background: #fff; }
      .header-img img { width: 100%; height: auto; display: block; }
      .info-row { display: flex; justify-content: space-between; border: 1.5px solid #000; border-radius: 3px; padding: 5px 10px; margin-bottom: 6px; }
      .info-cell { display: flex; flex-direction: column; align-items: center; }
      .info-cell .label { font-size: 10px; text-transform: uppercase; color: #000 !important; font-weight: 900 !important; }
      .info-cell .value { font-size: 12px; font-weight: 900 !important; color: #000 !important; }
      .info-cell .value.bold { font-size: 14px; font-weight: 900 !important; }
      .section-title { font-size: 11px; font-weight: 900 !important; color: #000 !important; text-transform: uppercase; padding: 3px 8px; margin-bottom: 3px; border-bottom: 1.5px solid #000; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
      th { background: #f5f0e8; color: #000 !important; padding: 5px 6px; font-size: 10px; text-align: left; font-weight: 900 !important; border-bottom: 1.5px solid #000; }
      td { padding: 5px 6px; font-size: 11px; border-bottom: 1px solid #999; font-weight: 900 !important; color: #000 !important; }
      .total-col { text-align: right; font-size: 13px; color: #c0392b !important; font-weight: 900 !important; }
      th.total-col { color: #000 !important; text-align: right; }
      .profit-col { text-align: right; font-size: 12px; color: ${c.profit >= 0 ? '#16a34a' : '#dc2626'} !important; font-weight: 900 !important; }
      th.profit-col { color: #000 !important; text-align: right; }
      .signatures { display: flex; justify-content: space-between; margin-top: 6px; padding-top: 4px; }
      .sig-box { text-align: center; width: 28%; }
      .sig-line { border-bottom: 1.5px solid #000; margin-bottom: 3px; height: 20px; }
      .sig-box span { font-size: 9px; color: #000 !important; text-transform: uppercase; font-weight: 800 !important; }
      .finance-box { padding: 8px 10px; border: 1.5px solid #000; border-radius: 3px; margin-bottom: 6px; }
      .fin-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; font-weight: 900 !important; color: #000 !important; }
      .fin-row.dim { color: #000 !important; }
      .fin-row.net { border-top: 1.5px solid #000; padding-top: 5px; margin-top: 3px; font-weight: 900 !important; }
      .fin-row.add { color: #000 !important; }
      .fin-row.profit { border-top: 2px solid #000; padding-top: 6px; margin-top: 4px; font-size: 15px; font-weight: 900 !important; }
      @media print { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    </style></head><body>
      ${challanHTML}
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 600);
  };

  const handleWhatsApp = () => {
    if (!savedChallan) return;
    const c = savedChallan;
    const biltyLines = c.bilties.map((b, i) =>
      `${i + 1}. Bilty #${b.bilty_number || '-'} | ${b.destination || '-'} | ${b.description || '-'} | Qty: ${b.loaded_quantity}/${b.total_quantity} | Rs. ${Number(b.total_amount * (b.loaded_quantity / b.total_quantity)).toLocaleString()}`
    ).join('\n');

    const text = [
      `*GUL-E-PAKISTAN*`,
      `Challan Dispatch`,
      ``,
      `*Challan #:* ${c.challan_number}`,
      `*Date:* ${c.date}`,
      `*Vehicle:* ${c.vehicle_number}`,
      `*Driver:* ${c.driver_name}`,
      c.route_number ? `*Route #:* ${c.route_number}` : '',
      c.broker_name ? `*Broker:* ${c.broker_name}` : '',
      ``,
      `*--- Loaded Bilties ---*`,
      biltyLines,
      ``,
      `*--- Financial Summary ---*`,
      `Total Rent Amount: Rs. ${c.total_bilty_amount.toLocaleString()}`,
      `Total Local Fare: Rs. ${c.total_local_fare.toLocaleString()}`,
      `Total Loading: Rs. ${c.total_loading.toLocaleString()}`,
      `Net Rent Amount: Rs. ${c.net_rent_amount.toLocaleString()}`,
      `Delivery: Rs. ${c.commission_deduction.toLocaleString()}`,
      `Vehicle Freight: Rs. ${c.vehicle_freight.toLocaleString()}`,
      `*Profit: Rs. ${c.profit.toLocaleString()}*`,
      `Branch Deposit: Rs. ${(c.branch_deposit || 0).toLocaleString()}`,
      `*Receivable from Broker: Rs. ${(c.receivable_from_broker || 0).toLocaleString()}*`,
    ].filter(Boolean).join('\n');

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Truck size={28} color="var(--primary-color)" />
          <h1 className="page-title" style={{ marginBottom: 0 }}>Create Challan (Dispatch)</h1>
        </div>
        {savedChallan && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={handlePrint} style={{ padding: '7px 16px', fontSize: '0.85rem', fontWeight: 700, border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', background: '#f1f5f9', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ðŸ–¨ï¸ Print Challan #{savedChallan.challan_number}
            </button>
            <button type="button" onClick={handleWhatsApp} style={{ padding: '7px 16px', fontSize: '0.85rem', fontWeight: 700, border: 'none', borderRadius: '8px', cursor: 'pointer', background: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ðŸ’¬ WhatsApp
            </button>
          </div>
        )}
      </div>

      {message && (
        <div style={{ padding: '12px', marginBottom: '20px', borderRadius: '6px', backgroundColor: message.includes('Error') ? '#fee2e2' : '#d1fae5', color: message.includes('Error') ? '#991b1b' : '#065f46' }}>
          {message}
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()}>
        <div className="card no-print" style={{ marginBottom: '24px' }}>
          <h3>Select Destination Branch</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '8px 0 12px 0' }}>Choose the branch to filter bilties by destination.</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {['Lahore', 'Islamabad', 'Rawalpindi'].map(branch => (
              <button
                key={branch}
                type="button"
                onClick={() => { setSelectedBranch(branch); setSelectedBilties({}); }}
                style={{
                  padding: '10px 28px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: selectedBranch === branch ? '2px solid var(--primary-color)' : '2px solid var(--border-color)',
                  background: selectedBranch === branch ? 'var(--primary-color)' : '#fff',
                  color: selectedBranch === branch ? '#fff' : 'var(--text-color)',
                  transition: 'all 0.2s'
                }}
              >
                {branch}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: '24px' }}>
          <h3>Vehicle & Driver Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '14px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Vehicle Number</label>
              <input type="text" name="vehicle_number" value={formData.vehicle_number} onChange={handleFormChange} placeholder="e.g. TLA-123" required style={{ padding: '9px 12px', fontSize: '0.98rem', height: '42px', width: '100%' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Driver Name</label>
              <input type="text" name="driver_name" value={formData.driver_name} onChange={handleFormChange} placeholder="Driver name" required style={{ padding: '9px 12px', fontSize: '0.98rem', height: '42px', width: '100%' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Challan Date</label>
              <input type="date" value={challanDate} onChange={e => setChallanDate(e.target.value)} required style={{ padding: '9px 12px', fontSize: '0.98rem', height: '42px', width: '100%' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Broker Name</label>
              <input type="text" name="broker_name" value={formData.broker_name} onChange={handleFormChange} placeholder="Broker name (optional)" style={{ padding: '9px 12px', fontSize: '0.98rem', height: '42px', width: '100%' }} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '24px' }}>
          <h3>Step 2: Select Bilties from Warehouse</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '8px 0 16px 0' }}>Select bilties and specify how many packages you are loading. You can dispatch partial quantities.</p>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '8px' }}>Select</th>
                <th style={{ padding: '8px' }}>Bilty #</th>
                <th style={{ padding: '8px' }}>Destination</th>
                <th style={{ padding: '8px' }}>Available Qty</th>
                <th style={{ padding: '8px' }}>Rent Amount</th>
                <th style={{ padding: '8px' }}>Local Fare</th>
                <th style={{ padding: '8px' }}>Loading</th>
                <th style={{ padding: '8px' }}>TT</th>
                <th style={{ padding: '8px' }}>Load Qty</th>
              </tr>
            </thead>
            <tbody>
              {!selectedBranch && <tr><td colSpan="9" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Please select a destination branch above to view bilties.</td></tr>}
              {filteredInventory.map(item => {
                const charges = biltyCharges[item.id] || {};
                return (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '8px' }}>
                    <input 
                      type="checkbox" 
                      onChange={(e) => handleSelection(item, e.target.checked)}
                      checked={!!selectedBilties[item.id]}
                    />
                  </td>
                  <td style={{ padding: '8px', fontWeight: 600 }}>{item.bilty_number}</td>
                  <td style={{ padding: '8px' }}>{item.destination_name}</td>
                  <td style={{ padding: '8px' }}>{item.remaining_quantity}</td>
                  <td style={{ padding: '8px', color: '#c0392b', fontWeight: 600 }}>{Number(charges.custom_amount || 0).toLocaleString()}</td>
                  <td style={{ padding: '8px' }}>{Number(charges.local_freight || 0).toLocaleString()}</td>
                  <td style={{ padding: '8px' }}>{Number(charges.labor_charges || 0).toLocaleString()}</td>
                  <td style={{ padding: '8px' }}>{Number(charges.tt_expense || 0).toLocaleString()}</td>
                  <td style={{ padding: '8px' }}>
                     <input 
                        type="number" 
                        min="1" 
                        max={item.remaining_quantity}
                        value={selectedBilties[item.id]?.loaded_quantity || ''}
                        disabled={!selectedBilties[item.id]}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        style={{ width: '80px', padding: '4px 8px' }}
                     />
                  </td>
                </tr>
                );
              })}
              {selectedBranch && filteredInventory.length === 0 && <tr><td colSpan="9" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No bilties found for {selectedBranch}.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ marginBottom: '24px' }}>
          <h3>Step 3: Financial Calculations</h3>
          <div className="form-grid" style={{ marginTop: '16px' }}>
            <div className="form-group">
              <label>Delivery (-)</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="%"
                  value={commissionPct}
                  onChange={e => {
                    const pct = e.target.value;
                    setCommissionPct(pct);
                    const calcAmt = (netRentAmount * (parseFloat(pct) || 0)) / 100;
                    setFormData(prev => ({ ...prev, commission_deduction: parseFloat(calcAmt.toFixed(2)) }));
                  }}
                  style={{ width: '80px' }}
                />
                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>%</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="commission_deduction"
                  value={formData.commission_deduction}
                  onChange={e => {
                    setCommissionPct('');
                    handleFormChange(e);
                  }}
                  placeholder="Amount"
                  style={{ flex: 1 }}
                />
              </div>
            </div>
            <div className="form-group"><label>Vehicle Freight (-)</label><input type="number" min="0" step="0.01" name="vehicle_freight" value={formData.vehicle_freight} onChange={handleFormChange} /></div>
          </div>
          
          <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Total Rent Amount:</span>
              <strong>Rs. {calculatedTotalBiltyAmount.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-muted)' }}>
              <span>Total Local Fare (all bilties):</span>
              <strong>- Rs. {totalLocalFare.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-muted)' }}>
              <span>Total Loading (all bilties):</span>
              <strong>- Rs. {totalLoading.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderTop: '1px solid #cbd5e1', paddingTop: '8px' }}>
              <span style={{ fontWeight: 600 }}>Net Rent Amount:</span>
              <strong style={{ color: 'var(--primary-color)' }}>Rs. {netRentAmount.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-muted)' }}>
              <span>Delivery:</span>
              <strong>- Rs. {commissionDeduction.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#059669' }}>
              <span>+ Add Local Fare:</span>
              <strong>+ Rs. {totalLocalFare.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#059669' }}>
              <span>+ Add Loading:</span>
              <strong>+ Rs. {totalLoading.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-muted)' }}>
              <span>Vehicle Freight:</span>
              <strong>- Rs. {parseFloat(formData.vehicle_freight || 0).toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '1.2rem', fontWeight: 700, borderTop: '2px solid #cbd5e1', paddingTop: '12px' }}>
              <span>Profit:</span>
              <span style={{ color: profit >= 0 ? '#10b981' : '#ef4444' }}>Rs. {profit.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', marginBottom: '8px' }}>
              <span style={{ fontWeight: 600 }}>Branch Deposit (-):</span>
              <input type="number" min="0" step="0.01" name="branch_deposit" value={formData.branch_deposit} onChange={handleFormChange} style={{ width: '180px', padding: '6px 10px', fontSize: '0.95rem', textAlign: 'right' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '1.1rem', fontWeight: 700, borderTop: '2px solid #cbd5e1', paddingTop: '12px' }}>
              <span>Receivable from Broker:</span>
              <span style={{ color: receivableFromBroker >= 0 ? '#3B82F6' : '#ef4444' }}>Rs. {receivableFromBroker.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <button type="button" className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }} disabled={loading} onClick={() => {
          if (Object.keys(selectedBilties).length === 0) {
            setMessage('Error: Please select at least one bilty to create a challan.');
            return;
          }
          handleSubmit();
        }}>
            {loading ? 'Dispatching Vehicle...' : 'Create Challan & Dispatch Vehicle'}
        </button>

      </form>
    </div>
  );
}
