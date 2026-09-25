import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { FileText, Printer, MessageCircle, Save, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { applyTenantFilter, withTenantId, getTenantItem, setTenantItem } from '../utils/tenantStorage';

function generateBookingNumber(lastNum) {
  const num = (lastNum || 1000) + 1;
  return `#${num}`;
}

export default function BookingReceipt() {
  const navigate = useNavigate();
  const printRef = useRef();

  const [bookingNumber, setBookingNumber] = useState('');
  const [isManual, setIsManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [brokers, setBrokers] = useState([]);

  // Load brokers from Supabase (shared with BrokerManagementFTL)
  useEffect(() => {
    async function fetchBrokers() {
      try {
        let q = supabase.from('ftl_brokers').select('*').order('created_at', { ascending: true });
        q = applyTenantFilter(q);
        const { data } = await q;
        if (data && data.length > 0) {
          const formatted = data.map(b => ({
            id: b.id,
            fullName: b.full_name,
            address: b.address || '',
            cnic: b.cnic || '',
            phone: b.phone || '',
            ntn: b.ntn || '',
          }));
          setBrokers(formatted);
          setTenantItem('ftl_brokers', formatted);
          return;
        }
      } catch (err) {}
      const localData = getTenantItem('ftl_brokers', []);
      if (localData) setBrokers(localData);
    }
    fetchBrokers();
  }, []);

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    booking_number: '',
    type: 'Advance Fare',
    date: today,
    mobile: '',
    sender_name: '',
    receiver_name: '',
    receiver_mobile: '',
    broker_name: '',
    loading_points: 'karachi',
    destination: 'Lahore',
    qty: 0,
    cbm: 0,
    description: '',
    freight: 0,
    local_freight: 0,
    shifting_charges: 0,
    labour_charges: 0,
    other_expense: 0,
    weight_kg: 0,
    container_no: '',
    lc_number: '',
    bl_number: '',
    order_number: '',
    gd_number: '',
    vehicle_number: '',
    additional_items: '',
    vehicle_fare: 0,
    vehicle_mobile: '',
  });

  async function fetchLastBookingNumber() {
    try {
      let query = supabase
        .from('booking_receipts')
        .select('booking_number');
      query = applyTenantFilter(query);

      const { data, error } = await query;

      if (data && data.length > 0) {
        let maxNum = 1000;
        data.forEach(r => {
          if (r.booking_number) {
            const parsed = parseInt(String(r.booking_number).replace(/\D/g, ''), 10);
            if (!isNaN(parsed) && parsed > maxNum) {
              maxNum = parsed;
            }
          }
        });
        const next = generateBookingNumber(maxNum);
        setBookingNumber(next);
        setForm(prev => ({ ...prev, booking_number: next }));
      } else {
        setBookingNumber('#1001');
        setForm(prev => ({ ...prev, booking_number: '#1001' }));
      }
    } catch (err) {
      setBookingNumber('#1001');
      setForm(prev => ({ ...prev, booking_number: '#1001' }));
    }
  }

  // Auto-generate booking number on mount
  useEffect(() => {
    fetchLastBookingNumber();
  }, []);

  const totalFreight =
    (parseFloat(form.freight) || 0) + (parseFloat(form.labour_charges) || 0) + (parseFloat(form.other_expense) || 0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.loading_points) {
      setMessage({ text: 'Loading Points is required.', type: 'error' });
      return;
    }
    setSaving(true);
    setMessage({ text: '', type: '' });
    const { broker_name, vehicle_fare, ...formWithoutBroker } = form;
    let payload = {
      ...formWithoutBroker,
      booking_number: isManual ? form.booking_number : bookingNumber,
      qty: parseInt(form.qty) || 0,
      cbm: parseFloat(form.cbm) || 0,
      freight: parseFloat(form.freight) || 0,
      local_freight: parseFloat(form.local_freight) || 0,
      shifting_charges: parseFloat(form.shifting_charges) || 0,
      labour_charges: parseFloat(form.labour_charges) || 0,
      other_expense: parseFloat(form.other_expense) || 0,
      weight_kg: parseFloat(form.weight_kg) || 0,
      total_freight: totalFreight,
    };

    payload = withTenantId(payload);

    let { error } = await supabase.from('booking_receipts').insert([payload]);

    // Fallback if tenant_id column doesn't exist in schema cache yet
    if (error && error.message && error.message.includes('tenant_id')) {
      const { tenant_id, ...fallbackPayload } = payload;
      const retry = await supabase.from('booking_receipts').insert([fallbackPayload]);
      error = retry.error;
    }

    setSaving(false);
    if (error) {
      if (error.message && error.message.includes('booking_receipts_booking_number_key')) {
        setMessage({ 
          text: 'Error: Duplicate Booking #! Supabase SQL Editor mein "FIX_BOOKING_RECEIPTS_SQL.sql" run karein taake constraint remove ho sake.', 
          type: 'error' 
        });
      } else {
        setMessage({ text: 'Error saving: ' + error.message, type: 'error' });
      }
    } else {
      // Auto-create trip in Trips Management (Supabase Cloud + local cache)
      try {
        const tripPayload = withTenantId({
          date: form.date,
          bilty_number: payload.booking_number,
          vehicle_number: form.vehicle_number || '',
          from_location: form.loading_points || 'Karachi',
          to_location: form.destination || '',
          total_bilty_fare: totalFreight,
          vehicle_fare: parseFloat(form.vehicle_fare) || 0,
          gross_profit: totalFreight - (parseFloat(form.vehicle_fare) || 0),
          net_profit: totalFreight - (parseFloat(form.vehicle_fare) || 0),
          total_expenses: 0,
          broker_name: form.broker_name || '',
          expenses: []
        });
        let { error: tErr } = await supabase.from('ftl_trips').insert([tripPayload]);
        if (tErr && tErr.message && tErr.message.includes('tenant_id')) {
          const { tenant_id, ...fallbackTP } = tripPayload;
          await supabase.from('ftl_trips').insert([fallbackTP]);
        }

        const existingTrips = getTenantItem('ftl_trips', []);
        const newTrip = {
          id: Date.now().toString(),
          date: form.date,
          biltyNumber: payload.booking_number,
          vehicleNumber: form.vehicle_number || '',
          from: form.loading_points || '',
          to: form.destination || '',
          totalBiltyFare: totalFreight,
          vehicleFare: parseFloat(form.vehicle_fare) || 0,
          expenses: [],
          grossProfit: totalFreight - (parseFloat(form.vehicle_fare) || 0),
          netProfit: totalFreight - (parseFloat(form.vehicle_fare) || 0),
          totalExpenses: 0,
          brokerName: form.broker_name || '',
          createdAt: new Date().toISOString(),
        };
        setTenantItem('ftl_trips', [newTrip, ...existingTrips]);
      } catch (err) {
        console.warn('Auto trip insert error:', err);
      }
      setMessage({ text: 'Booking Receipt saved successfully!', type: 'success' });
      // Fetch next available number
      fetchLastBookingNumber();
    }
  };

  const handlePrint = async () => {
    const bNum = isManual ? form.booking_number : bookingNumber;
    const imgUrl = window.location.origin + '/booking-header.jpg';

    // Build container/reference items for route bar (only show filled ones)
    const refItems = [

      form.lc_number ? `<div class='item'><span>Local Container #: </span><strong>${form.lc_number}</strong></div>` : '',
      form.bl_number ? `<div class='item'><span>Local Vehicle #: </span><strong>${form.bl_number}</strong></div>` : '',
      form.order_number ? `<div class='item'><span>Local Weight: </span><strong>${form.order_number}</strong></div>` : '',
      form.gd_number ? `<div class='item'><span>GD #: </span><strong>${form.gd_number}</strong></div>` : '',
      form.vehicle_mobile ? `<div class='item'><span>Vehicle Mobile #: </span><strong>${form.vehicle_mobile}</strong></div>` : '',
    ].filter(Boolean).join('');

    const copyHTML = (copyLabel) => `
      <div class='bilty-section'>
        <div class='copy-label'>${copyLabel}</div>
        <div class='header'>
          <img src='${imgUrl}' alt='Gul-e-Pakistan' />
        </div>

        <div class='route-bar'>
          <div class='item'><span>From: </span><strong>${form.loading_points || '-'}</strong></div>
          <div class='item'><span>To: </span><strong>${form.destination || '-'}</strong></div>
          <div class='item'><span>Date: </span><strong>${form.date}</strong></div>
          ${form.vehicle_number ? `<div class='item'><span>Vehicle Number: </span><strong>${form.vehicle_number}</strong></div>` : ''}
          <div class='item badge'><span>Booking #: </span><strong>${bNum}</strong></div>
        </div>

        <div class='two-col'>
          <div>
            <div class='card' style='margin-bottom:8px;'>
              <div class='sr-grid'>
                <div class='sr-col'>
                  <h5>Sender</h5>
                  <p><strong>${form.sender_name || '-'}</strong></p>
                  <p><span>Mobile: </span>${form.mobile || '-'}</p>
                </div>
                <div class='sr-col'>
                  <h5>Receiver</h5>
                  <p><strong>${form.receiver_name || '-'}</strong></p>
                  <p><span>Mobile: </span>${form.receiver_mobile || '-'}</p>
                </div>
              </div>
            </div>
            <div class='card'>
              <div class='card-title'>Goods Details</div>
              <table>
                <thead><tr><th>#</th><th>Qty</th><th>Description</th><th>Weight (KG)</th><th>Seal No</th></tr></thead>
                <tbody><tr>
                  <td><strong>1</strong></td>
                  <td><strong>${form.qty}</strong></td>
                  <td><strong>${form.description || '-'}</strong></td>
                  <td><strong>${form.weight_kg || '-'}</strong></td>
                  <td><strong>${form.cbm || '-'}</strong></td>
                </tr></tbody>
              </table>
              <p class='note-line'>Note: ${form.additional_items || ''}</p>
            </div>
          </div>
          <div class='card'>
            <div class='card-title'>Charges</div>
            <div class='charge-item'><span>Freight</span><span>Rs. ${Number(form.freight || 0).toLocaleString()}</span></div>
            <div class='charge-item'><span>Labour Charges</span><span>Rs. ${Number(form.labour_charges || 0).toLocaleString()}</span></div>
            <div class='charge-item'><span>Other Expense</span><span>Rs. ${Number(form.other_expense || 0).toLocaleString()}</span></div>
            <div class='charge-total'><span>Total Amount</span><span>Rs. ${totalFreight.toLocaleString()}</span></div>
            ${form.broker_name ? `<div class='broker-line'><span>Broker:</span> <strong>${form.broker_name}</strong></div>` : ''}
          </div>
        </div>
        ${refItems ? `<div class='ref-row'>${refItems}</div>` : ''}

        <div class='disclaimer'>
          <strong>Note:</strong> The Company will not be responsible for damages caused by theft, robbery, vehicle hijacking, road accidents, fires, rains, floods and other natural disasters. The party should insure its goods and assets.
        </div>
        <div class='footer'>Thank you for choosing Gul-e-Pakistan &mdash; Safe & Timely Delivery Guaranteed</div>
      </div>`;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Booking Receipt ${bNum}</title><style>
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
      .sig-box { margin-top: 10px; padding-top: 6px; border-top: 1px solid #999; text-align: center; }
      .sig-box p { font-size: 15px; color: #000; margin-bottom: 4px; }
      .sig-line { width: 160px; margin: 20px auto 0; border-bottom: 1px solid #000; }
      .disclaimer { margin-top: 8px; padding: 8px 16px; border: 1.5px solid #999; background: #f5f5f5; border-radius: 3px; font-size: 13px; color: #000; line-height: 1.4; text-align: center; font-weight: 700; }
      .footer { text-align: center; margin-top: 6px; font-size: 13px; color: #000; padding-top: 4px; border-top: 1px solid #ccc; font-weight: 700; }
      @media print { body { padding: 0; } .bilty-section { padding: 8px 18px; } th { background: #000 !important; color: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; -webkit-text-stroke: 0 !important; } }
    </style></head><body>
      ${copyHTML('')}
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    const imgs = printWindow.document.images;
    let loaded = 0;
    let printed = false;
    const tryPrint = () => { loaded++; if (!printed && loaded >= imgs.length) { printed = true; setTimeout(() => printWindow.print(), 400); } };
    if (imgs.length === 0) { setTimeout(() => printWindow.print(), 400); }
    else { for (let i = 0; i < imgs.length; i++) { if (imgs[i].complete) tryPrint(); else { imgs[i].onload = tryPrint; imgs[i].onerror = tryPrint; } } }
  };

  const handleWhatsApp = () => {
    const bNum = isManual ? form.booking_number : bookingNumber;
    const text = `*BOOKING RECEIPT*\n\n` +
      `Booking No: ${bNum}\n` +
      `Date: ${form.date}\n` +
      `Type: ${form.type}\n` +
      `Mobile: ${form.mobile}\n` +
      `Sender: ${form.sender_name}\n` +
      `Receiver: ${form.receiver_name}\n` +
      `Receiver Mobile: ${form.receiver_mobile}\n` +
      `Loading Points: ${form.loading_points}\n` +
      `Destination: ${form.destination}\n` +
      `Vehicle Number: ${form.vehicle_number}\n` +
      `Qty: ${form.qty}  Seal No: ${form.cbm}\n` +
      `Description: ${form.description}\n` +
      `Freight: ${form.freight}  Labour Charges: ${form.labour_charges}  Other Expense: ${form.other_expense}\n` +
      `Weight KG: ${form.weight_kg}\n` +
      `Total Freight: ${totalFreight}\n` +

      `Local Container Number: ${form.lc_number}\n` +
      `Local Vehicle Number: ${form.bl_number}\n` +
      `Local Weight: ${form.order_number}\n` +
      `GD Number: ${form.gd_number}\n` +
      `Additional Items: ${form.additional_items}`;

    const phone = form.mobile ? form.mobile.replace(/\D/g, '') : '';
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const currentBookingNum = isManual ? form.booking_number : bookingNumber;

  return (
    <div>
      {/* Message */}
      {message.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: message.type === 'success' ? '#065f46' : '#991b1b',
          fontWeight: 600,
        }}>
          {message.text}
        </div>
      )}

      {/* Printable Area */}
      <div ref={printRef}>
        <div className="print-header" style={{ display: 'none' }}>
          <h2>GUL-E-PAKISTAN</h2>
          <p>Booking Receipt</p>
          <p>Booking No: {currentBookingNum} | Date: {form.date}</p>
        </div>

        {/* Row 1: Loading Points, Destination, Date, Booking No */}
        <div className="card" style={{ padding: '10px 16px', marginBottom: '10px' }}>
          <div className="receipt-header-grid">
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.75rem' }}>Loading Points *</label>
              <input type="text" name="loading_points" value={form.loading_points} onChange={handleChange} style={{ padding: '4px 8px', fontSize: '0.82rem' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.75rem' }}>Destination</label>
              <input type="text" name="destination" value={form.destination} onChange={handleChange} style={{ padding: '4px 8px', fontSize: '0.82rem' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.75rem' }}>Date *</label>
              <input type="date" name="date" value={form.date} onChange={handleChange} style={{ padding: '4px 8px', fontSize: '0.82rem' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.75rem' }}>Vehicle Number</label>
              <input type="text" name="vehicle_number" value={form.vehicle_number} onChange={handleChange} placeholder="e.g. ABC-1234" style={{ padding: '4px 8px', fontSize: '0.82rem' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ color: 'var(--primary-color)', fontWeight: 700, fontSize: '0.75rem' }}>
                Booking No *
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="text"
                  value={currentBookingNum}
                  disabled={!isManual}
                  onChange={e => setForm(prev => ({ ...prev, booking_number: e.target.value }))}
                  name="booking_number"
                  style={{ background: isManual ? '' : 'var(--bg-secondary)', fontWeight: 600, padding: '4px 8px', fontSize: '0.82rem' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={isManual} onChange={e => setIsManual(e.target.checked)} style={{ width: 'auto' }} /> Manual
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Two-column layout: LEFT (Sender/Receiver + Goods + Note) | RIGHT (Charges/Freight) */}
        <div className="bilty-main-layout" style={{ marginBottom: '10px' }}>

          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* Sender & Receiver */}
            <div className="card" style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>Sender & Receiver</div>
              <div className="sender-receiver-grid">
                <div style={{ paddingRight: '12px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary-color, #e85d04)', textTransform: 'uppercase', marginBottom: '6px' }}>Sender</div>
                  <div className="form-group" style={{ margin: 0, marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.68rem' }}>Name</label>
                    <input type="text" name="sender_name" value={form.sender_name} onChange={handleChange} placeholder="Sender name" style={{ padding: '4px 8px', fontSize: '0.82rem' }} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.68rem' }}>Mobile</label>
                    <input type="text" name="mobile" value={form.mobile} onChange={handleChange} placeholder="0321..." style={{ padding: '4px 8px', fontSize: '0.82rem' }} />
                  </div>
                </div>
                <div style={{ paddingLeft: '12px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary-color, #e85d04)', textTransform: 'uppercase', marginBottom: '6px' }}>Receiver</div>
                  <div className="form-group" style={{ margin: 0, marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.68rem' }}>Name</label>
                    <input type="text" name="receiver_name" value={form.receiver_name} onChange={handleChange} placeholder="Receiver name" style={{ padding: '4px 8px', fontSize: '0.82rem' }} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.68rem' }}>Mobile</label>
                    <input type="text" name="receiver_mobile" value={form.receiver_mobile} onChange={handleChange} placeholder="0321..." style={{ padding: '4px 8px', fontSize: '0.82rem' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Goods Details + Note */}
            <div className="card" style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>Goods Details</div>
              <div className="table-responsive">
                <table style={{ width: '100%', minWidth: '420px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '3px 4px', fontSize: '0.7rem', fontWeight: 700, width: '24px' }}>#</th>
                      <th style={{ textAlign: 'left', padding: '3px 4px', fontSize: '0.7rem', fontWeight: 700 }}>DESCRIPTION</th>
                      <th style={{ textAlign: 'left', padding: '3px 4px', fontSize: '0.7rem', fontWeight: 700, width: '70px' }}>QTY</th>
                      <th style={{ textAlign: 'left', padding: '3px 4px', fontSize: '0.7rem', fontWeight: 700, width: '85px' }}>WT(KG)</th>
                      <th style={{ textAlign: 'left', padding: '3px 4px', fontSize: '0.7rem', fontWeight: 700, width: '85px' }}>SEAL NO</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '3px 4px', fontWeight: 600, fontSize: '0.82rem' }}>1</td>
                      <td style={{ padding: '3px 4px' }}>
                        <input type="text" name="description" value={form.description} onChange={handleChange} placeholder="e.g. Bags, Cartons" style={{ width: '100%', padding: '4px 6px', fontSize: '0.82rem' }} />
                      </td>
                      <td style={{ padding: '3px 4px' }}>
                        <input type="number" name="qty" value={form.qty} onChange={handleChange} min="0" style={{ width: '100%', padding: '4px 6px', fontSize: '0.82rem' }} />
                      </td>
                      <td style={{ padding: '3px 4px' }}>
                        <input type="number" name="weight_kg" value={form.weight_kg} onChange={handleChange} min="0" step="0.01" style={{ width: '100%', padding: '4px 6px', fontSize: '0.82rem' }} />
                      </td>
                      <td style={{ padding: '3px 4px' }}>
                        <input type="text" name="cbm" value={form.cbm} onChange={handleChange} placeholder="Seal #" style={{ width: '100%', padding: '4px 6px', fontSize: '0.82rem' }} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#dc2626' }}>Note</label>
                <textarea
                  name="additional_items"
                  value={form.additional_items}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Add a note..."
                  style={{ width: '100%', resize: 'vertical', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: '#dc2626', fontWeight: 600, fontSize: '0.82rem', marginTop: '4px' }}
                />
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN - Charges */}
          <div className="card bilty-charges-card" style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>Charges</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.72rem' }}>Freight</label>
                <input type="number" name="freight" value={form.freight} onChange={handleChange} min="0" style={{ padding: '5px 8px', fontSize: '0.85rem' }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.72rem' }}>Labour Charges</label>
                <input type="number" name="labour_charges" value={form.labour_charges} onChange={handleChange} min="0" style={{ padding: '5px 8px', fontSize: '0.85rem' }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.72rem' }}>Other Expense</label>
                <input type="number" name="other_expense" value={form.other_expense} onChange={handleChange} min="0" style={{ padding: '5px 8px', fontSize: '0.85rem' }} />
              </div>
              <div style={{ borderTop: '2px solid var(--primary-color, #e85d04)', paddingTop: '8px', marginTop: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>Total Amount</span>
                  <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--primary-color, #e85d04)' }}>
                    Rs. {totalFreight.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="form-group" style={{ margin: 0, marginTop: '4px' }}>
                <label style={{ fontSize: '0.72rem' }}>Broker</label>
                <select name="broker_name" value={form.broker_name} onChange={handleChange} style={{ padding: '5px 8px', fontSize: '0.82rem' }}>
                  <option value="">-- Select --</option>
                  {brokers.map(b => (
                    <option key={b.id} value={b.fullName}>{b.fullName}</option>
                  ))}
                </select>
              </div>
              <div className="form-group no-print" style={{ margin: 0, marginTop: '4px' }}>
                <label style={{ fontSize: '0.72rem' }}>Vehicle Fare</label>
                <input type="number" name="vehicle_fare" value={form.vehicle_fare} onChange={handleChange} min="0" placeholder="0" style={{ padding: '5px 8px', fontSize: '0.85rem' }} />
              </div>
            </div>
          </div>

        </div>

        {/* Row 4: Container & Reference full width */}
        <div className="card" style={{ padding: '10px 14px', marginBottom: '6px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>Container & Reference</div>
          <div className="container-ref-grid">
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.65rem' }}>Local Container Number</label>
              <input type="text" name="lc_number" value={form.lc_number} onChange={handleChange} style={{ padding: '4px 5px', fontSize: '0.78rem' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.65rem' }}>Local Vehicle Number</label>
              <input type="text" name="bl_number" value={form.bl_number} onChange={handleChange} style={{ padding: '4px 5px', fontSize: '0.78rem' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.65rem' }}>Local Weight</label>
              <input type="text" name="order_number" value={form.order_number} onChange={handleChange} style={{ padding: '4px 5px', fontSize: '0.78rem' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.65rem' }}>GD Number</label>
              <input type="text" name="gd_number" value={form.gd_number} onChange={handleChange} style={{ padding: '4px 5px', fontSize: '0.78rem' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Mobile No */}
      <div className="card" style={{ padding: '10px 14px', marginBottom: '6px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', alignItems: 'end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '0.75rem' }}>Vehicle Mobile No</label>
            <input type="text" name="vehicle_mobile" value={form.vehicle_mobile} onChange={handleChange} placeholder="0300..." style={{ padding: '4px 8px', fontSize: '0.82rem' }} />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '14px', marginTop: '24px', flexWrap: 'wrap' }}>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}
        >
          <Save size={18} />
          {saving ? 'Saving...' : 'Save'}
        </button>

        <button
          className="btn btn-secondary"
          onClick={handlePrint}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}
        >
          <Printer size={18} />
          Print
        </button>

        <button
          onClick={handleWhatsApp}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 24px', borderRadius: '8px', border: 'none',
            background: '#25D366', color: '#fff', fontWeight: 600,
            fontSize: '0.9rem', cursor: 'pointer'
          }}
        >
          <MessageCircle size={18} />
          WhatsApp
        </button>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .print-header { display: block !important; }
          .print-only { display: block !important; }
          .card { box-shadow: none !important; border: none !important; }
          button { display: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
