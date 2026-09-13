import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useSettings } from '../context/SettingsContext';
import { withTenantId } from '../utils/tenantStorage';

export default function BiltyCreate() {
  const { biltyHeaderUrl } = useSettings();
  const [branches, setBranches] = useState([]);
  
  // Function to get Pakistan timezone date (UTC+5)
  const getPakistanDate = () => {
    const now = new Date();
    const pkTime = new Date(now.getTime() + (5 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60 * 1000));
    return pkTime.toISOString().split('T')[0];
  };
  
  const [formData, setFormData] = useState({
    destination_branch_id: '',
    bilty_number: '',
    sender_name: '',
    sender_phone: '',
    receiver_name: '',
    receiver_phone: '',
    description: '',
    note: '',
    quantity: 1,
    weight_kg: '',
    cbm: '',
    lcl_number: '',
    container_number: '',
    local_freight: 0,
    labor_charges: 0,
    other_charges: 0,
    tt_expense: 0,
    custom_amount: 0,
    order_number: '',
    expense_name: '',
    booking_clerk: '',
    bilty_date: getPakistanDate()
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [addToAccount, setAddToAccount] = useState(false);
  const [localFreightPartyName, setLocalFreightPartyName] = useState('');
  const [savedBilty, setSavedBilty] = useState(null);
  const [nextBiltyNumber, setNextBiltyNumber] = useState(null);
  const [isManualDest, setIsManualDest] = useState(false);
  const [manualDestName, setManualDestName] = useState('');
  const [karachiBranchId, setKarachiBranchId] = useState(null);
  const [excludeChargesFromPrint, setExcludeChargesFromPrint] = useState(false);

  async function fetchNextBiltyNumber() {
    const { data, error } = await supabase.rpc('get_next_bilty_number');
    if (data) setNextBiltyNumber(data);
  }

  useEffect(() => {
    async function loadBranches() {
      try {
        const { data, error } = await supabase.from('branches').select('*');
        if (error) {
          console.error('Error loading branches:', error);
          setMessage('Error loading branches: ' + error.message);
          return;
        }
        if (data && data.length > 0) {
          const karachiBranch = data.find(b => b.name.toLowerCase() === 'karachi');
          if (karachiBranch) setKarachiBranchId(karachiBranch.id);

          // Exclude Karachi (origin), include all other destination branches (both built-in and custom)
          const destinationBranches = data.filter(b => b.name.toLowerCase() !== 'karachi');
          const priorityBranches = ['islamabad'];
          const sortedBranches = [...destinationBranches].sort((a, b) => {
            const aIndex = priorityBranches.indexOf(a.name.toLowerCase());
            const bIndex = priorityBranches.indexOf(b.name.toLowerCase());
            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;
            return a.name.localeCompare(b.name);
          });
          setBranches(sortedBranches);
          // Set first branch as default
          if (sortedBranches.length > 0) {
            setFormData(prev => ({...prev, destination_branch_id: sortedBranches[0].id, bilty_date: getPakistanDate()}));
          }
        } else {
          console.error('No branches found in database');
          setMessage('No branches found. Please add branches first.');
        }
      } catch (err) {
        console.error('Exception loading branches:', err);
        setMessage('Exception: ' + err.message);
      }
    }
    loadBranches();
    fetchNextBiltyNumber();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const totalAmount = parseFloat(formData.local_freight || 0) + 
                      parseFloat(formData.labor_charges || 0) + 
                      parseFloat(formData.tt_expense || 0) +
                      parseFloat(formData.custom_amount || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // اگر charges exclude کریں تو confirmation لیں
    if (excludeChargesFromPrint) {
      const confirmed = window.confirm('⚠️ آپ نے Charges کو Print سے EXCLUDE کر دیا ہے۔\n\nیہ Bilty print میں charges نہیں دکھائے گی لیکن سافٹویئر میں charges محفوظ رہیں گے۔\n\nکیا یہ صحیح ہے؟');
      if (!confirmed) {
        setExcludeChargesFromPrint(false);
        return;
      }
    }

    // Validate destination_branch_id
    let destBranchId = formData.destination_branch_id;
    if (isManualDest) {
      destBranchId = karachiBranchId || branches[0]?.id;
    }
    
    if (!destBranchId || destBranchId.trim() === '') {
      setMessage('Error: Please select a valid destination branch');
      return;
    }

    setLoading(true);
    setMessage('');

    const isManual = isManualDest;
    const manualDest = manualDestName.trim();

    const insertData = {
      destination_branch_id: destBranchId,
      sender_name: formData.sender_name,
      sender_phone: formData.sender_phone,
      receiver_name: formData.receiver_name,
      receiver_phone: formData.receiver_phone,
      description: formData.description,
      note: formData.note,
      total_quantity: parseInt(formData.quantity) || 1,
      weight_kg: parseFloat(formData.weight_kg) || 0,
      cbm: parseFloat(formData.cbm) || 0,
      lcl_number: formData.lcl_number,
      container_number: formData.container_number,
      local_freight: parseFloat(formData.local_freight) || 0,
      labor_charges: parseFloat(formData.labor_charges) || 0,
      other_charges: parseFloat(formData.other_charges) || 0,
      tt_expense: parseFloat(formData.tt_expense) || 0,
      custom_amount: parseFloat(formData.custom_amount) || 0,
      total_amount: (parseFloat(formData.local_freight) || 0) + (parseFloat(formData.labor_charges) || 0) + (parseFloat(formData.other_charges) || 0) + (parseFloat(formData.tt_expense) || 0) + (parseFloat(formData.custom_amount) || 0),
      booking_clerk: formData.booking_clerk || '',
      exclude_charges_from_print: excludeChargesFromPrint,
      bilty_date: formData.bilty_date,
    };
    if (isManual && manualDest) {
      insertData.destination = manualDest;
    }
    if (formData.bilty_number.trim()) {
      insertData.bilty_number = formData.bilty_number.trim();
    }

    const { data, error } = await supabase
      .from('bilties')
      .insert([withTenantId(insertData)])
      .select();

    if (error) {
      console.error(error);
      setMessage(`Error creating bilty: ${error.message}`);
    } else {
      const createdBilty = data[0];
      const destBranch = isManual ? null : branches.find(b => String(b.id) === String(formData.destination_branch_id));
      const printCharges = {
        rentAmount: parseFloat(formData.custom_amount) || 0,
        loading: parseFloat(formData.labor_charges) || 0,
        localFare: parseFloat(formData.local_freight) || 0,
        ttExpense: parseFloat(formData.tt_expense) || 0
      };
      printCharges.total = printCharges.rentAmount + printCharges.loading + printCharges.localFare + printCharges.ttExpense;
      setSavedBilty({ 
        ...createdBilty, 
        quantity: createdBilty.total_quantity || parseInt(formData.quantity) || 1,
        printCharges, 
        destBranchName: manualDest || createdBilty.destination || (destBranch?.name || ''), 
        expenseName: formData.expense_name, 
        snapshotForm: { ...formData }, 
        excludeChargesFromPrint 
      });
      setMessage(`Bilty created successfully! Bilty Number: ${createdBilty.bilty_number}`);
      fetchNextBiltyNumber();

      // Handle Local Freight Party Account
      if (addToAccount && parseFloat(formData.local_freight) > 0) {
        try {
          const partyNameToUse = localFreightPartyName.trim() || formData.sender_name;
          // 1. Check if party exists
          let { data: party, error: pError } = await supabase
            .from('local_freight_parties')
            .select('id')
            .eq('name', partyNameToUse)
            .maybeSingle();

          if (!party) {
            // 2. Create party if not exists
            const { data: newParty, error: npError } = await supabase
              .from('local_freight_parties')
              .insert([{ 
                name: partyNameToUse, 
                phone: formData.sender_phone 
              }])
              .select('id')
              .single();
            
            if (newParty) party = newParty;
          }

          if (party) {
            // 3. Create transaction
            await supabase
              .from('local_freight_transactions')
              .insert([{
                party_id: party.id,
                bilty_id: createdBilty.id,
                date: new Date().toISOString().split('T')[0],
                description: `Bilty #${createdBilty.bilty_number} - Local Freight`,
                amount: parseFloat(formData.local_freight),
                type: 'freight'
              }]);
          }
        } catch (err) {
          console.error('Error recording local freight transaction:', err);
          // We don't want to fail the whole bilty creation if this fails, but maybe log it.
        }
      }

      // Reset form
        setFormData(prev => ({
          ...prev,
          bilty_number: '',
          sender_name: '',
          sender_phone: '',
          receiver_name: '',
          receiver_phone: '',
          description: '',
          note: '',
          quantity: 1,
          weight_kg: '',
          cbm: '',
          lcl_number: '',
          container_number: '',
          local_freight: 0,
          labor_charges: 0,
          other_charges: 0,
          tt_expense: 0,
          custom_amount: 0,
          order_number: '',
          expense_name: '',
          booking_clerk: ''
        }));
        setAddToAccount(false);
        setLocalFreightPartyName('');
        setExcludeChargesFromPrint(false);
      }
    setLoading(false);
  };

  const handlePrint = () => {
    if (!savedBilty) return;
    const b = savedBilty;
    const c = b.printCharges || { rentAmount: 0, loading: 0, localFare: 0, ttExpense: 0, total: 0 };
    const imgUrl = biltyHeaderUrl || (window.location.origin + '/bilty-header.jpg');
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Bilty #${b.bilty_number}</title><style>
      @page { size: A4; margin: 1mm 5mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; font-weight: 900 !important; -webkit-text-stroke: 0.3px #000; color: #000 !important; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #000; padding: 0; background: #fff; }
      .bilty-section { padding: 3px 12px; height: 73.5mm; display: flex; flex-direction: column; overflow: hidden; }
      .bilty-separator { border-bottom: 2px dashed #999; margin: 0px 10px; height: 0px; }
      .charge-total, .charge-total span { font-weight: 900 !important; }
      .header { text-align: center; padding-bottom: 4px; margin-bottom: 4px; border-bottom: 2px solid #000; flex-shrink: 0; }
      .header img { width: 100%; height: auto; display: block; }
      .route-bar { display: flex; justify-content: space-between; align-items: center; background: #f5f5f5; border: 1px solid #999; border-radius: 4px; padding: 4px 10px; margin-bottom: 4px; flex-wrap: wrap; gap: 6px; flex-shrink: 0; }
      .route-bar .item { font-size: 12px; font-weight: 700; }
      .route-bar .item strong { color: #000; font-size: 12px; }
      .route-bar .item span { color: #000; }
      .two-col { display: grid; grid-template-columns: 1fr 220px; gap: 8px; margin-bottom: 4px; align-items: start; flex: 1; min-height: 0; overflow: hidden; }
      .card { border: 1px solid #999; border-radius: 4px; padding: 6px 8px; background: #fff; }
      .card-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #000; margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px solid #ccc; }
      .sr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
      .sr-col { padding: 0 10px; }
      .sr-col:first-child { border-right: 1px solid #999; padding-left: 0; }
      .sr-col:last-child { padding-right: 0; }
      .sr-col h5 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #000; margin-bottom: 3px; font-weight: 700; }
      .sr-col p { font-size: 12px; margin: 2px 0; font-weight: 700; color: #000; }
      .sr-col p span { color: #000; font-size: 11px; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #000 !important; color: #fff !important; padding: 4px 6px; font-size: 10px; text-align: left; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; -webkit-text-stroke: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      td { padding: 4px 6px; font-size: 12px; border-bottom: 1px solid #ccc; font-weight: 700; color: #000; }
      .charge-item { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; border-bottom: 1px solid #ccc; font-size: 12px; }
      .charge-item:last-of-type { border-bottom: none; }
      .charge-item span:first-child { color: #000; font-weight: 700; }
      .charge-item span:last-child { font-weight: 700; color: #000; }
      .charge-total { display: flex; justify-content: space-between; align-items: center; padding: 4px 0 0; margin-top: 4px; border-top: 2px solid #000; font-size: 13px; font-weight: 800; }
      .charge-total span:last-child { color: #000; }
      .sig-box { margin-top: 6px; padding-top: 3px; border-top: 1px solid #999; text-align: center; }
      .sig-box p { font-size: 10px; color: #000; margin-bottom: 2px; }
      .sig-line { width: 120px; margin: 14px auto 0; border-bottom: 1px solid #000; }
      .disclaimer { margin-top: 3px; padding: 3px 10px; border: 1px solid #999; background: #f5f5f5; border-radius: 3px; font-size: 9px; color: #000; line-height: 1.3; text-align: center; font-weight: 700; flex-shrink: 0; }
      .footer { text-align: center; margin-top: 4px; font-size: 9px; color: #000; padding-top: 3px; border-top: 1px solid #ccc; font-weight: 700; }
      .copy-label { text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #000; margin-bottom: 2px; font-weight: 800; flex-shrink: 0; }
      @media print { body { padding: 0; } .bilty-section { padding: 3px 12px; height: 73.5mm; } th { background: #000 !important; color: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; -webkit-text-stroke: 0 !important; } }
    </style></head><body>
      <div class='bilty-section'>
      <div class='copy-label'>CUSTOMER COPY</div>
      <div class='header'>
        <img src='${imgUrl}' alt='Gul-e-Pakistan' />
      </div>

      <div class='route-bar'>
        <div class='item'><span>From: </span><strong>Karachi</strong></div>
        <div class='item'><span>To: </span><strong>${b.destBranchName}</strong></div>
        <div class='item'><span>Date: </span><strong>${new Date(b.bilty_date || b.created_at || Date.now()).toLocaleDateString('en-PK')}</strong></div>
        <div class='item' style='background:#000 !important;padding:4px 10px;border-radius:3px;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;'><span style='color:#fff !important;'>Bilty #: </span><strong style='color:#fff !important;font-size:14px;'>${b.bilty_number}</strong></div>
        ${b.snapshotForm.lcl_number ? `<div class='item'><span>LCL #: </span><strong>${b.snapshotForm.lcl_number}</strong></div>` : ''}
        ${b.snapshotForm.container_number ? `<div class='item'><span>Container #: </span><strong>${b.snapshotForm.container_number}</strong></div>` : ''}
      </div>

      <div class='two-col'>
        <div>
          <div class='card' style='margin-bottom:8px;'>
            <div class='sr-grid'>
              <div class='sr-col'>
                <h5>Sender</h5>
                <p><strong>${b.sender_name}</strong></p>
                <p><span>Phone: </span>${b.sender_phone || 'â€”'}</p>
              </div>
              <div class='sr-col'>
                <h5>Receiver</h5>
                <p><strong>${b.receiver_name}</strong></p>
                <p><span>Phone: </span>${b.receiver_phone || 'â€”'}</p>
              </div>
            </div>
          </div>
          <div class='card'>
            <div class='card-title'>Goods Details</div>
            <table>
              <thead><tr><th>#</th><th>Qty</th><th>Description</th><th>Weight (KG)</th></tr></thead>
              <tbody><tr><td><strong>1</strong></td><td><strong>${b.quantity}</strong></td><td><strong>${b.description}</strong></td><td><strong>${b.weight_kg || '—'}</strong></td></tr></tbody>
            </table>
            <p style="color:red !important; font-weight:800; margin-top:6px; font-size:12px; min-height:18px; padding:4px 0;">Note: ${b.snapshotForm.note || ""}</p>
          </div>
        </div>
        <div class='card' style='${b.excludeChargesFromPrint ? 'display: none;' : ''}'>
          <div class='card-title'>Charges</div>
          <div class='charge-item'><span>Rent Amount</span><span>Rs. ${c.rentAmount.toLocaleString()}</span></div>
          <div class='charge-item'><span>Loading</span><span>Rs. ${c.loading.toLocaleString()}</span></div>
          <div class='charge-item'><span>Local Fare</span><span>Rs. ${c.localFare.toLocaleString()}</span></div>
          <div class='charge-item'><span>TT Expense</span><span>Rs. ${c.ttExpense.toLocaleString()}</span></div>
          <div class='charge-total'><span>Total Amount</span><span>Rs. ${c.total.toLocaleString()}</span></div>
          <div class='sig-box'>
            <p>Booking Clerk</p>
            <p style='font-size:13px;font-weight:800;margin-top:4px;'>${b.booking_clerk || b.snapshotForm?.booking_clerk || ''}</p>
          </div>
        </div>
      </div>

      <div class='disclaimer'>
        <strong>Note:</strong> The Company will not be responsible for damages caused by theft, robbery, vehicle hijacking, road accidents, fires, rains, floods and other natural disasters. The party should insure its goods and assets.
      </div>
      </div>

      <div class='bilty-separator'></div>

      <div class='bilty-section'>
      <div class='copy-label'>OFFICE COPY</div>
      <div class='header'>
        <img src='${imgUrl}' alt='Gul-e-Pakistan' />
      </div>

      <div class='route-bar'>
        <div class='item'><span>From: </span><strong>Karachi</strong></div>
        <div class='item'><span>To: </span><strong>${b.destBranchName}</strong></div>
        <div class='item'><span>Date: </span><strong>${new Date(b.bilty_date || b.created_at || Date.now()).toLocaleDateString('en-PK')}</strong></div>
        <div class='item' style='background:#000 !important;padding:4px 10px;border-radius:3px;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;'><span style='color:#fff !important;'>Bilty #: </span><strong style='color:#fff !important;font-size:14px;'>${b.bilty_number}</strong></div>
        ${b.snapshotForm.lcl_number ? `<div class='item'><span>LCL #: </span><strong>${b.snapshotForm.lcl_number}</strong></div>` : ''}
        ${b.snapshotForm.container_number ? `<div class='item'><span>Container #: </span><strong>${b.snapshotForm.container_number}</strong></div>` : ''}
      </div>

      <div class='two-col'>
        <div>
          <div class='card' style='margin-bottom:8px;'>
            <div class='sr-grid'>
              <div class='sr-col'>
                <h5>Sender</h5>
                <p><strong>${b.sender_name}</strong></p>
                <p><span>Phone: </span>${b.sender_phone || 'â€"'}</p>
              </div>
              <div class='sr-col'>
                <h5>Receiver</h5>
                <p><strong>${b.receiver_name}</strong></p>
                <p><span>Phone: </span>${b.receiver_phone || 'â€"'}</p>
              </div>
            </div>
          </div>
          <div class='card'>
            <div class='card-title'>Goods Details</div>
            <table>
              <thead><tr><th>#</th><th>Qty</th><th>Description</th><th>Weight (KG)</th></tr></thead>
              <tbody><tr><td><strong>1</strong></td><td><strong>${b.quantity}</strong></td><td><strong>${b.description}</strong></td><td><strong>${b.weight_kg || '—'}</strong></td></tr></tbody>
            </table>
            <p style="color:red !important; font-weight:800; margin-top:6px; font-size:12px; min-height:18px; padding:4px 0;">Note: ${b.snapshotForm.note || ""}</p>
          </div>
        </div>
        <div class='card' style='${b.excludeChargesFromPrint ? 'display: none;' : ''}'>
          <div class='card-title'>Charges</div>
          <div class='charge-item'><span>Rent Amount</span><span>Rs. ${c.rentAmount.toLocaleString()}</span></div>
          <div class='charge-item'><span>Loading</span><span>Rs. ${c.loading.toLocaleString()}</span></div>
          <div class='charge-item'><span>Local Fare</span><span>Rs. ${c.localFare.toLocaleString()}</span></div>
          <div class='charge-item'><span>TT Expense</span><span>Rs. ${c.ttExpense.toLocaleString()}</span></div>
          <div class='charge-total'><span>Total Amount</span><span>Rs. ${c.total.toLocaleString()}</span></div>
          <div class='sig-box'>
            <p>Booking Clerk</p>
            <p style='font-size:13px;font-weight:800;margin-top:4px;'>${b.booking_clerk || b.snapshotForm?.booking_clerk || ''}</p>
          </div>
        </div>
      </div>

      <div class='disclaimer'>
        <strong>Note:</strong> The Company will not be responsible for damages caused by theft, robbery, vehicle hijacking, road accidents, fires, rains, floods and other natural disasters. The party should insure its goods and assets.
      </div>
      </div>
    </body></html>`);

    printWindow.focus();
    const imgs = printWindow.document.images;
    let loaded = 0;
    let printed = false;
    const tryPrint = () => { loaded++; if (!printed && loaded >= imgs.length) { printed = true; setTimeout(() => printWindow.print(), 400); } };
    if (imgs.length === 0) { setTimeout(() => printWindow.print(), 400); }
    else { for (let i = 0; i < imgs.length; i++) { if (imgs[i].complete) tryPrint(); else { imgs[i].onload = tryPrint; imgs[i].onerror = tryPrint; } } }
  };

  const handleWhatsApp = () => {
    if (!savedBilty) return;
    const b = savedBilty;
    const c = b.printCharges || { rentAmount: 0, loading: 0, localFare: 0, ttExpense: 0, total: 0 };
    const date = new Date(b.bilty_date || b.created_at || Date.now()).toLocaleDateString('en-PK');
    const text = [
      `*GUL-E-PAKISTAN*`,
      `Plot #12, Phase II, Port Qasim, Karachi`,
      ``,
      `*Bilty # ${b.bilty_number}*`,
      `Date: ${date}`,
      `Route: Karachi â†’ ${b.destBranchName}`,
      b.snapshotForm.lcl_number ? `LCL #: ${b.snapshotForm.lcl_number}` : '',
      b.snapshotForm.container_number ? `Container #: ${b.snapshotForm.container_number}` : '',
      ``,
      `*Sender:* ${b.sender_name}${b.sender_phone ? ' | ' + b.sender_phone : ''}`,
      `*Receiver:* ${b.receiver_name}${b.receiver_phone ? ' | ' + b.receiver_phone : ''}`,
      ``,
      `*Goods:* ${b.description}`,
      `Qty: ${b.quantity} | Weight: ${b.weight_kg || 0} KG`,
      ``,
      `*Charges:*`,
      `Local Fare: Rs. ${c.localFare.toLocaleString()}`,
      `Loading: Rs. ${c.loading.toLocaleString()}`,
      `TT Expense: Rs. ${c.ttExpense.toLocaleString()}`,
      `Rent Amount: Rs. ${c.rentAmount.toLocaleString()}`,
      `*Total: Rs. ${c.total.toLocaleString()}*`,
    ].filter(line => line !== '').join('\n');
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return (
    <div className="bilty-page">
      {savedBilty && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '12px' }}>
          <button type="button" onClick={handlePrint} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '5px' }}>Print Bilty</button>
          <button type="button" onClick={handleWhatsApp} style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: 600, border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', gap: '5px' }}>WhatsApp</button>
        </div>
      )}

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

      <form onSubmit={handleSubmit}>

        {/* Section: Route & Trip Details */}
        <div className="card bilty-section">
          <h3 className="bilty-section-title">Route & Trip Details</h3>
          <div className="bilty-grid bilty-grid-5">
            <div className="form-group">
              <label>From Booking</label>
              <input type="text" value="Karachi" readOnly style={{ backgroundColor: 'var(--bg-main)' }} />
            </div>
            <div className="form-group">
              <label>Destination</label>
              <select 
                name="destination_branch_id" 
                value={isManualDest ? 'manual' : (formData.destination_branch_id || '')} 
                onChange={(e) => {
                  if (e.target.value === 'manual') {
                    setIsManualDest(true);
                  } else {
                    setIsManualDest(false);
                    setManualDestName('');
                    setFormData(prev => ({...prev, destination_branch_id: e.target.value}));
                  }
                }} 
                required
              >
                {branches.length === 0 ? (
                  <option value="">-- Loading branches... --</option>
                ) : (
                  <>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                    <option value="manual">Manual</option>
                  </>
                )}
              </select>
              {isManualDest && (
                <input type="text" value={manualDestName} onChange={(e) => setManualDestName(e.target.value)} placeholder="Enter city name" style={{ marginTop: '6px' }} required />
              )}
            </div>
            <div className="form-group">
              <label>Bilty Date</label>
              <input type="date" name="bilty_date" value={formData.bilty_date} onChange={handleChange} style={{ backgroundColor: 'transparent' }} />
            </div>
            <div className="form-group">
              <label>#Bilty Number {nextBiltyNumber && <span style={{ fontSize: '0.75rem', color: '#e85d04', fontWeight: 700 }}>(Next: {nextBiltyNumber})</span>}</label>
              <input type="text" name="bilty_number" value={formData.bilty_number} onChange={handleChange} placeholder="Auto or Manual" />
            </div>

          </div>
        </div>

        {/* Two-column layout: Left (Sender/Receiver + Goods) | Right (Payments) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '14px', alignItems: 'start' }}>

          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Sender & Receiver */}
            <div className="card bilty-section">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {/* Sender */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-color, #e85d04)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sender</div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Name</label>
                    <input type="text" name="sender_name" value={formData.sender_name} onChange={handleChange} placeholder="Sender name" required style={{ padding: '9px 12px', fontSize: '0.98rem', height: '40px', width: '100%' }} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Contact</label>
                    <input type="text" name="sender_phone" value={formData.sender_phone} onChange={handleChange} placeholder="0321..." style={{ padding: '9px 12px', fontSize: '0.98rem', height: '40px', width: '100%' }} />
                  </div>
                </div>
                {/* Receiver */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderLeft: '1px solid var(--border)', paddingLeft: '14px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-color, #e85d04)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Receiver</div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Name</label>
                    <input type="text" name="receiver_name" value={formData.receiver_name} onChange={handleChange} placeholder="Receiver name" required style={{ padding: '9px 12px', fontSize: '0.98rem', height: '40px', width: '100%' }} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Contact</label>
                    <input type="text" name="receiver_phone" value={formData.receiver_phone} onChange={handleChange} placeholder="0333..." style={{ padding: '9px 12px', fontSize: '0.98rem', height: '40px', width: '100%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Goods Details */}
            <div className="card bilty-section">
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '6px', fontSize: '0.75rem', fontWeight: 700, width: '30px' }}>#</th>
                      <th style={{ textAlign: 'left', padding: '6px', fontSize: '0.75rem', fontWeight: 700, width: '100px' }}>QTY*</th>
                      <th style={{ textAlign: 'left', padding: '6px', fontSize: '0.75rem', fontWeight: 700 }}>DESCRIPTION *</th>
                      <th style={{ textAlign: 'left', padding: '6px', fontSize: '0.75rem', fontWeight: 700, width: '120px' }}>WT(KG)*</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px', fontWeight: 600, fontSize: '0.85rem' }}>1</td>
                      <td style={{ padding: '6px' }}>
                        <input type="number" min="1" name="quantity" value={formData.quantity} onChange={handleChange} required style={{ width: '100%', padding: '8px 10px', fontSize: '0.95rem' }} />
                      </td>
                      <td style={{ padding: '6px' }}>
                        <input type="text" name="description" value={formData.description} onChange={handleChange} placeholder="e.g. Bags, Cartons" required style={{ width: '100%', padding: '8px 10px', fontSize: '0.95rem' }} />
                      </td>
                      <td style={{ padding: '6px' }}>
                        <input type="number" step="0.01" min="0" name="weight_kg" value={formData.weight_kg} onChange={handleChange} style={{ width: '100%', padding: '8px 10px', fontSize: '0.95rem' }} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Note Field */}
              <div className="form-group" style={{ margin: '12px 0 0 0' }}>
                <label style={{ fontWeight: 700, fontSize: '0.78rem' }}>Note</label>
                <input type="text" name="note" value={formData.note} onChange={handleChange} placeholder="Add a note for this bilty..." style={{ width: '100%', padding: '8px 10px', fontSize: '0.95rem', color: 'red', fontWeight: 600 }} />
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN - Payments */}
          <div className="card bilty-section" style={{ position: 'sticky', top: '14px' }}>
            <h3 className="bilty-section-title">Charges</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Rent Amount</label>
                <input type="number" min="0" step="0.01" name="custom_amount" value={formData.custom_amount} onChange={handleChange} style={{ fontSize: '0.95rem' }} />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Loading</label>
                <input type="number" min="0" step="0.01" name="labor_charges" value={formData.labor_charges} onChange={handleChange} required />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Local Fare</label>
                <input type="number" min="0" step="0.01" name="local_freight" value={formData.local_freight} onChange={handleChange} required />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>TT Expense</label>
                <input type="number" min="0" step="0.01" name="tt_expense" value={formData.tt_expense} onChange={handleChange} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', padding: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>
                <input
                  type="checkbox"
                  id="excludeCharges"
                  checked={excludeChargesFromPrint}
                  onChange={(e) => setExcludeChargesFromPrint(e.target.checked)}
                  style={{ width: 'auto', cursor: 'pointer', accentColor: 'var(--primary-color, #e85d04)' }}
                />
                <label htmlFor="excludeCharges" style={{ marginBottom: 0, fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600, color: '#7f1d1d' }}>
                  ✓ Hide Charges from Print
                </label>
              </div>



              <div style={{ borderTop: '2px solid var(--primary-color, #e85d04)', paddingTop: '12px', marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Total Amount</span>
                  <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary-color, #e85d04)' }}>
                    Rs. {totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Booking Clerk</label>
                <input type="text" name="booking_clerk" value={formData.booking_clerk} onChange={handleChange} placeholder="Clerk name" style={{ fontSize: '0.95rem' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="addToAccount"
                  checked={addToAccount}
                  onChange={(e) => {
                    setAddToAccount(e.target.checked);
                    if (!e.target.checked) setLocalFreightPartyName('');
                  }}
                  style={{ width: 'auto', cursor: 'pointer' }}
                />
                <label htmlFor="addToAccount" style={{ marginBottom: 0, fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500, color: '#4b5563' }}>
                  Add to Local Freight Party Account
                </label>
                {addToAccount && (
                  <input
                    type="text"
                    value={localFreightPartyName}
                    onChange={(e) => setLocalFreightPartyName(e.target.value)}
                    placeholder="Enter party name"
                    style={{ fontSize: '0.8rem', padding: '4px 6px', borderRadius: '3px', border: '1px solid #ccc', marginLeft: 'auto', width: '180px' }}
                  />
                )}
              </div>

            </div>
          </div>

        </div>

        {/* Save Button */}
        <div style={{ marginTop: '6px' }}>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '11px', fontSize: '0.95rem', fontWeight: 700 }}>
            {loading ? 'Saving...' : 'Save Bilty'}
          </button>
        </div>

        {/* Disclaimer Note */}
        <div style={{ marginTop: '12px', padding: '10px 14px', background: '#fef9ee', border: '1px solid #f0dca0', borderRadius: '6px', fontSize: '0.75rem', color: '#92400e', lineHeight: '1.5', textAlign: 'center' }}>
          <strong>Note:</strong> The Company will not be responsible for damages caused by theft, robbery, vehicle hijacking, road accidents, fires, rains, floods and other natural disasters. The party should insure its goods and assets.
        </div>

      </form>
    </div>
  );
}

