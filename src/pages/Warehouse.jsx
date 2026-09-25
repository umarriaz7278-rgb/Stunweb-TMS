import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Package, Search, Scale, DollarSign, FileText, X } from 'lucide-react';
import { applyTenantFilter } from '../utils/tenantStorage';
import { useSettings } from '../context/SettingsContext';

export default function Warehouse() {
  const { biltyHeaderUrl } = useSettings();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('all');

  async function fetchInventory() {
    setLoading(true);
    let inventoryData = [];

    try {
      let bQ = supabase
        .from('bilties')
        .select('*, branches(name)')
        .order('bilty_number', { ascending: false });
      bQ = applyTenantFilter(bQ);
      const { data: biltiesData, error: bErr } = await bQ;

      if (!bErr && biltiesData && biltiesData.length > 0) {
        // Fetch challan bilties to calculate loaded/dispatched quantity
        let cQ = supabase
          .from('challan_bilties')
          .select('bilty_id, loaded_quantity, challans(status)');
        const { data: cbData } = await cQ;

        const loadedMap = {};
        if (cbData) {
          cbData.forEach(cb => {
            if (cb.challans && (cb.challans.status === 'in_transit' || cb.challans.status === 'arrived')) {
              loadedMap[cb.bilty_id] = (loadedMap[cb.bilty_id] || 0) + Number(cb.loaded_quantity || 0);
            }
          });
        }

        const computed = biltiesData
          .map(b => {
            const totalQty = Number(b.total_quantity || b.quantity || 1);
            const loadedQty = loadedMap[b.id] || 0;
            const remainingQty = Math.max(0, totalQty - loadedQty);
            const destName = b.destination || b.branches?.name || 'Islamabad';
            return {
              ...b,
              date: b.bilty_date || b.created_at,
              destination_name: destName,
              total_quantity: totalQty,
              remaining_quantity: remainingQty
            };
          })
          .filter(b => b.remaining_quantity > 0);

        inventoryData = computed;
      }
    } catch (err) {
      console.error("Direct bilties fetch error:", err);
    }

    setInventory(inventoryData || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchInventory();
  }, []);

  const handlePrint = async (item) => {
    // Fetch full bilty details from bilties table
    const { data: fullBilty } = await supabase
      .from('bilties')
      .select('*, branches:destination_branch_id(name)')
      .eq('id', item.id)
      .single();

    // Convert header image to base64 to avoid separate loading
    let headerBase64 = '';
    const srcUrl = biltyHeaderUrl || '/bilty-header.jpg';
    if (srcUrl.startsWith('data:image/')) {
      headerBase64 = srcUrl;
    } else {
      headerBase64 = await new Promise((resolve) => {
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
    }

    const b = fullBilty || item;
    const destName = b.destination_name || b.branches?.name || item.destination_name || '';
    const biltyDate = new Date(b.date || item.date).toLocaleDateString('en-PK');
    const senderName = b.sender_name || item.sender_name || '';
    const senderPhone = b.sender_phone || '';
    const receiverName = b.receiver_name || item.receiver_name || '';
    const receiverPhone = b.receiver_phone || '';
    const description = b.description || item.description || '';
    const note = b.note || '';
    const qty = b.quantity || item.total_quantity || 0;
    const weightKg = b.weight_kg || 0;
    const cbm = b.cbm || 0;
    const lclNumber = b.lcl_number || '';
    const containerNumber = b.container_number || '';
    const localFreight = Number(b.local_freight || 0);
    const laborCharges = Number(b.labor_charges || 0);
    const ttCharges = Number(b.tt_expense || 0);
    const customAmount = Number(b.custom_amount || 0);
    const totalAmount = localFreight + laborCharges + ttCharges + customAmount;
    const orderNumber = b.order_number || '';
    const biltyNumber = b.bilty_number || item.bilty_number || '';

    const biltyHTML = `
      <div class="bilty-copy">
        <div class="header-img">
          <img src="${headerBase64}" alt="Bilty Header" />
        </div>
        <div class="route-bar">
          <div class="route-item"><span>From: </span><strong>Karachi</strong><span style="margin:0 6px;">To:</span><strong>${destName}</strong></div>
          <div class="route-item"><span>Date: </span><strong>${biltyDate}</strong></div>
          <div class="route-item" style="background:#000 !important;padding:4px 10px;border-radius:3px;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;"><span style="color:#fff !important;">Bilty #: </span><strong style="color:#fff !important;font-size:14px;">${biltyNumber}</strong></div>
          ${orderNumber ? `<div class="route-item"><span>Order #: </span><strong>${orderNumber}</strong></div>` : ''}
          ${lclNumber ? `<div class="route-item"><span>LCL #: </span><strong>${lclNumber}</strong></div>` : ''}
          ${containerNumber ? `<div class="route-item"><span>Container #: </span><strong>${containerNumber}</strong></div>` : ''}
        </div>

        <div class="main-layout">
          <div class="left-col">
            <div class="card">
              <div class="sr-grid">
                <div class="sr-col">
                  <div class="sr-label">SENDER</div>
                  <div class="sr-name"><strong>${senderName}</strong></div>
                  ${senderPhone ? `<div class="sr-phone">${senderPhone}</div>` : ''}
                </div>
                <div class="sr-col sr-right">
                  <div class="sr-label">RECEIVER</div>
                  <div class="sr-name"><strong>${receiverName}</strong></div>
                  ${receiverPhone ? `<div class="sr-phone">${receiverPhone}</div>` : ''}
                </div>
              </div>
            </div>
            <div class="card">
              <div class="card-title">Goods Details</div>
              <table>
                <thead><tr><th>#</th><th>Qty</th><th>Description</th><th>Weight (KG)</th></tr></thead>
                <tbody><tr><td><strong>1</strong></td><td><strong>${qty}</strong></td><td><strong>${description}</strong></td><td><strong>${weightKg}</strong></td></tr></tbody>
              </table>
              <p style="color:red !important; font-weight:800; margin-top:6px; font-size:12px; min-height:18px; padding:4px 0;">Note: ${note || ""}</p>
            </div>
          </div>
          <div class="right-col">
            <div class="card">
              <div class="card-title">Charges</div>
              <div class="charge-item"><span>Rent Amount</span><span>Rs. ${customAmount.toLocaleString()}</span></div>
              <div class="charge-item"><span>Loading</span><span>Rs. ${laborCharges.toLocaleString()}</span></div>
              <div class="charge-item"><span>Local Fare</span><span>Rs. ${localFreight.toLocaleString()}</span></div>
              <div class="charge-item"><span>TT Expense</span><span>Rs. ${ttCharges.toLocaleString()}</span></div>
              <div class="charge-total"><span>Total Amount</span><span>Rs. ${totalAmount.toLocaleString()}</span></div>
              <div class="sig-area">
                <div class="sig-label">Booking Clerk</div>
                <div style="font-size:12px;font-weight:800;margin-top:4px;">${b.booking_clerk || ""}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="disclaimer">
          <strong>Note:</strong> The Company will not be responsible for damages caused by theft, robbery, vehicle hijacking, road accidents, fires, rains, floods and other natural disasters. The party should insure its goods and assets.
        </div>
      </div>`;

    const biltyHTMLOffice = biltyHTML.replace(/<div class="disclaimer">[\s\S]*?<\/div>/, '');

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Bilty #${biltyNumber}</title><style>
      @page { size: A4 portrait; margin: 3mm 6mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; font-weight: 900 !important; -webkit-text-stroke: 0.3px #000; color: #000 !important; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13.5px; color: #000; background: #fff; line-height: 1.35; }
      .charge-total, .charge-total span { font-weight: 900 !important; }
      .bilty-copy { width: 100%; padding: 3mm 4mm 2mm 4mm; background: #fff; page-break-inside: avoid; }
      .bilty-separator { height: 0; border-bottom: 2px dashed #555; margin: 3mm 8px; }
      .copy-label { text-align: center; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #000; margin: 2px 0 3px; font-weight: 900; }
      .header-img { margin-bottom: 3px; width: 100%; border-bottom: 2px solid #000; padding-bottom: 3px; }
      .header-img img { width: 100%; max-height: 85px; object-fit: contain; display: block; }
      .route-bar { display: flex; justify-content: space-between; align-items: center; background: #f5f5f5; border: 1.5px solid #666; border-radius: 4px; padding: 5px 12px; margin: 3px 0 5px 0; flex-wrap: wrap; gap: 6px; }
      .route-item { font-size: 13.5px; font-weight: 800; color: #000; }
      .route-item span { color: #000; }
      .route-item strong { color: #000; font-size: 14px; }
      .main-layout { display: grid; grid-template-columns: 1fr 260px; gap: 8px; margin-bottom: 5px; align-items: stretch; }
      .left-col { display: flex; flex-direction: column; gap: 6px; }
      .card { border: 1.5px solid #777; border-radius: 4px; padding: 6px 10px; background: #fff; }
      .card-title { font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.6px; color: #000; margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1.5px solid #999; }
      .sr-grid { display: grid; grid-template-columns: 1fr 1fr; }
      .sr-col { padding: 0 8px; }
      .sr-col:first-child { padding-left: 0; }
      .sr-right { border-left: 1.5px solid #777; }
      .sr-col:last-child { padding-right: 0; }
      .sr-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #000; font-weight: 800; margin-bottom: 3px; }
      .sr-name { font-size: 13.5px; font-weight: 800; color: #000; }
      .sr-phone { font-size: 12px; color: #000; margin-top: 2px; font-weight: 800; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #000 !important; color: #fff !important; padding: 5px 8px; font-size: 12px; text-align: left; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; -webkit-text-stroke: 0 !important; }
      td { padding: 5px 8px; font-size: 13.5px; border-bottom: 1px solid #999; font-weight: 800; color: #000; }
      .charge-item { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #ccc; font-size: 13px; font-weight: 800; }
      .charge-item span:first-child { color: #000; font-weight: 800; }
      .charge-item span:last-child { font-weight: 800; color: #000; }
      .charge-total { display: flex; justify-content: space-between; padding: 6px 0 2px; margin-top: 4px; border-top: 2px solid #000; font-size: 15px; font-weight: 900; }
      .sig-area { margin-top: 6px; text-align: center; padding-top: 4px; border-top: 1px solid #777; }
      .sig-label { font-size: 11px; } .sig-line { width: 120px; margin: 12px auto 0; border-bottom: 1px solid #000; }
      .disclaimer { padding: 4px 8px; border: 1px solid #999; background: #f5f5f5; border-radius: 3px; font-size: 9.5px; line-height: 1.3; text-align: center; font-weight: 800; margin-top: 4px; }
      @media print {
        body { margin: 0; padding: 0; }
        @page { size: A4 portrait; margin: 3mm 6mm; }
      }
    </style></head><body>
      <div class="copy-label">CUSTOMER COPY</div>
      ${biltyHTML}
      <div class="bilty-separator"></div>
      <div class="copy-label">OFFICE COPY</div>
      ${biltyHTMLOffice}
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const handleWhatsApp = (item) => {
    const text = [
      `*GUL-E-PAKISTAN*`,
      `Plot no 174/A, Gate no 6, Street no 4, New Truck Stand, Hawksbay Road, Karachi`,
      ``,
      `*Bilty # ${item.bilty_number}*`,
      `Date: ${new Date(item.date).toLocaleDateString('en-PK')}`,
      `Route: Karachi \u2192 ${item.destination_name}`,
      ``,
      `*Sender:* ${item.sender_name}`,
      `*Receiver:* ${item.receiver_name}`,
      ``,
      `*Goods:* ${item.description}`,
      `Total Qty: ${item.total_quantity} | Remaining: ${item.remaining_quantity}`,
      ``,
      `*Total Amount: Rs. ${Number(item.total_amount || 0).toLocaleString()}*`,
    ].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };
  const handlePDF = async (item) => {
    // Reuse same print logic but trigger Save as PDF
    const { data: fullBilty } = await supabase
      .from('bilties')
      .select('*, branches:destination_branch_id(name)')
      .eq('id', item.id)
      .single();

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
      img.src = '/bilty-header.jpg';
    });

    const b = fullBilty || item;
    const destName = b.destination_name || b.branches?.name || item.destination_name || '';
    const biltyDate = new Date(b.date || item.date).toLocaleDateString('en-PK');
    const senderName = b.sender_name || item.sender_name || '';
    const senderPhone = b.sender_phone || '';
    const receiverName = b.receiver_name || item.receiver_name || '';
    const receiverPhone = b.receiver_phone || '';
    const description = b.description || item.description || '';
    const note = b.note || '';
    const qty = b.quantity || item.total_quantity || 0;
    const weightKg = b.weight_kg || 0;
    const cbm = b.cbm || 0;
    const lclNumber = b.lcl_number || '';
    const containerNumber = b.container_number || '';
    const localFreight = Number(b.local_freight || 0);
    const laborCharges = Number(b.labor_charges || 0);
    const customAmount = Number(b.custom_amount || 0);
    const ttCharges = Number(b.tt_expense || 0);
    const totalAmount = localFreight + laborCharges + customAmount + ttCharges;
    const biltyNumber = b.bilty_number || item.bilty_number || '';

    const biltyHTML = `
      <div class="bilty-copy">
        <div class="header-img">
          <img src="${headerBase64}" alt="Gul-e-Pakistan Header" />
        </div>
        <div class="route-bar">
          <div class="route-item"><span>From: </span><strong>Karachi</strong><span style="margin:0 10px;">To:</span><strong>${destName}</strong></div>
          <div class="route-item"><span>Date: </span><strong>${biltyDate}</strong></div>
          <div class="route-item" style="background:#000 !important;padding:4px 10px;border-radius:3px;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;"><span style="color:#fff !important;">Bilty #: </span><strong style="color:#fff !important;font-size:14px;">${biltyNumber}</strong></div>
          ${lclNumber ? `<div class="route-item"><span>LCL #: </span><strong>${lclNumber}</strong></div>` : ''}
          ${containerNumber ? `<div class="route-item"><span>Container #: </span><strong>${containerNumber}</strong></div>` : ''}
        </div>
        <div class="main-layout">
          <div class="left-col">
            <div class="card">
              <div class="sr-grid">
                <div class="sr-col">
                  <div class="sr-label">SENDER</div>
                  <div class="sr-name"><strong>${senderName}</strong></div>
                  ${senderPhone ? `<div class="sr-phone">${senderPhone}</div>` : ''}
                </div>
                <div class="sr-col sr-right">
                  <div class="sr-label">RECEIVER</div>
                  <div class="sr-name"><strong>${receiverName}</strong></div>
                  ${receiverPhone ? `<div class="sr-phone">${receiverPhone}</div>` : ''}
                </div>
              </div>
            </div>
            <div class="card">
              <div class="card-title">Goods Details</div>
              <table>
                <thead><tr><th>#</th><th>Qty</th><th>Description</th><th>Weight (KG)</th></tr></thead>
                <tbody><tr><td><strong>1</strong></td><td><strong>${qty}</strong></td><td><strong>${description}</strong></td><td><strong>${weightKg}</strong></td></tr></tbody>
              </table>
              <p style="color:red !important; font-weight:800; margin-top:6px; font-size:12px; min-height:18px; padding:4px 0;">Note: ${note || ""}</p>
            </div>
          </div>
          <div class="right-col">
            <div class="card">
              <div class="card-title">Charges</div>
              <div class="charge-item"><span>Rent Amount</span><span>Rs. ${customAmount.toLocaleString()}</span></div>
              <div class="charge-item"><span>Loading</span><span>Rs. ${laborCharges.toLocaleString()}</span></div>
              <div class="charge-item"><span>Local Fare</span><span>Rs. ${localFreight.toLocaleString()}</span></div>
              <div class="charge-item"><span>TT Expense</span><span>Rs. ${ttCharges.toLocaleString()}</span></div>
              <div class="charge-total"><span>Total Amount</span><span>Rs. ${totalAmount.toLocaleString()}</span></div>
              <div class="sig-area">
                <div class="sig-label">Booking Clerk</div>
                <div style="font-size:13px;font-weight:800;margin-top:4px;">${b.booking_clerk || ""}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="disclaimer">
          <strong>Note:</strong> The Company will not be responsible for damages caused by theft, robbery, vehicle hijacking, road accidents, fires, rains, floods and other natural disasters. The party should insure its goods and assets.
        </div>
      </div>`;

    // Create a temporary container for PDF generation
    const container = document.createElement('div');
    container.innerHTML = `<style>
      * { margin: 0; padding: 0; box-sizing: border-box; font-weight: 900 !important; color: #000 !important; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 15px; }
      .bilty-copy { width: 100%; padding: 3mm; border: 1.5px solid #999; border-radius: 4px; background: #fff; }
      .header-img { margin-bottom: 2px; width: 100%; }
      .header-img img { width: 100%; height: auto; display: block; }
      .route-bar { display: flex; justify-content: space-between; align-items: center; background: #f5f5f5; border: 1px solid #999; border-radius: 5px; padding: 5px 10px; margin-bottom: 6px; flex-wrap: wrap; gap: 3px 8px; }
      .route-item { font-size: 14px; font-weight: 700; }
      .route-item strong { font-size: 14.5px; }
      .main-layout { display: grid; grid-template-columns: 1fr 220px; gap: 8px; margin-bottom: 5px; align-items: start; }
      .left-col { display: flex; flex-direction: column; gap: 6px; }
      .card { border: 1px solid #999; border-radius: 5px; padding: 7px 9px; }
      .card-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #ccc; }
      .sr-grid { display: grid; grid-template-columns: 1fr 1fr; }
      .sr-col { padding: 0 8px; }
      .sr-col:first-child { padding-left: 0; }
      .sr-right { border-left: 1px solid #999; }
      .sr-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 700; margin-bottom: 3px; }
      .sr-name { font-size: 15px; font-weight: 700; }
      .sr-phone { font-size: 14px; margin-top: 1px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #000; color: #fff !important; padding: 5px 7px; font-size: 12px; text-align: left; font-weight: 700; text-transform: uppercase; }
      td { padding: 6px 7px; font-size: 14px; border-bottom: 1px solid #ccc; font-weight: 700; }
      .charge-item { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #ccc; font-size: 14px; }
      .charge-total { display: flex; justify-content: space-between; padding: 6px 0 0; margin-top: 3px; border-top: 2px solid #000; font-size: 16px; font-weight: 800; }
      .sig-area { margin-top: 8px; text-align: center; padding-top: 4px; border-top: 1px solid #999; }
      .sig-label { font-size: 11px; }
      .sig-line { width: 120px; margin: 20px auto 0; border-bottom: 1px solid #000; }
      .disclaimer { padding: 4px 8px; border: 1px solid #999; background: #f5f5f5; border-radius: 4px; font-size: 11px; line-height: 1.5; text-align: center; font-weight: 700; }
    </style>${biltyHTML}`;
    document.body.appendChild(container);

    const { default: html2pdf } = await import('html2pdf.js');
    html2pdf().set({
      margin: [8, 10, 8, 10],
      filename: `Bilty_${biltyNumber}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(container).save().then(() => {
      document.body.removeChild(container);
    });
  };
  const handleDelete = async (item) => {
    if (!window.confirm(`Bilty #${item.bilty_number} delete karna chahte hain? Yeh action wapas nahi hoga.`)) return;
    const { error } = await supabase.from('bilties').delete().eq('id', item.id);
    if (error) {
      alert(`Delete failed: ${error.message}`);
    } else {
      fetchInventory();
    }
  };

  // Unique destinations present in inventory
  const uniqueDestinations = useMemo(() => {
    const dests = new Set();
    inventory.forEach(item => {
      if (item.destination_name) dests.add(item.destination_name);
    });
    return Array.from(dests).sort();
  }, [inventory]);

  // Filtered inventory based on search term & selected destination
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const dest = (item.destination_name || '').toLowerCase();
      const term = searchTerm.trim().toLowerCase();

      const matchesSearch = !term ||
        dest.includes(term) ||
        String(item.bilty_number || '').toLowerCase().includes(term) ||
        (item.sender_name || '').toLowerCase().includes(term) ||
        (item.receiver_name || '').toLowerCase().includes(term) ||
        (item.description || '').toLowerCase().includes(term);

      const matchesDestination = selectedDestination === 'all' || dest === selectedDestination.toLowerCase();

      return matchesSearch && matchesDestination;
    });
  }, [inventory, searchTerm, selectedDestination]);

  // Overall warehouse totals
  const totalWarehouseWeight = useMemo(() => {
    return inventory.reduce((sum, item) => sum + Number(item.weight_kg || 0), 0);
  }, [inventory]);

  const totalWarehouseAmount = useMemo(() => {
    return inventory.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
  }, [inventory]);

  // Filtered totals
  const filteredWeight = useMemo(() => {
    return filteredInventory.reduce((sum, item) => sum + Number(item.weight_kg || 0), 0);
  }, [filteredInventory]);

  const filteredAmount = useMemo(() => {
    return filteredInventory.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
  }, [filteredInventory]);

  const isFiltered = searchTerm.trim() !== '' || selectedDestination !== 'all';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Package size={28} color="var(--primary-color)" />
          <h1 className="page-title" style={{ marginBottom: 0 }}>Karachi Warehouse Inventory</h1>
        </div>
      </div>

      {/* --- Top Stat Cards: Weight, Amount/Rent, and Bilties --- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {/* Card 1: Total Weight */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-card)', borderLeft: '4px solid #f59e0b', margin: 0, padding: '16px 20px' }}>
          <div style={{ background: '#fef3c7', borderRadius: '10px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Scale size={24} color="#d97706" />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {isFiltered ? 'Filtered Weight' : 'Total Weight in Warehouse'}
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#d97706' }}>
              {(isFiltered ? filteredWeight : totalWarehouseWeight).toLocaleString()} KG
            </div>
            {isFiltered && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Total: {totalWarehouseWeight.toLocaleString()} KG
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Total Amount (Rent) */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-card)', borderLeft: '4px solid #10b981', margin: 0, padding: '16px 20px' }}>
          <div style={{ background: '#d1fae5', borderRadius: '10px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={24} color="#059669" />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {isFiltered ? 'Filtered Rent Total' : 'Total Amount (Rent Total)'}
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#059669' }}>
              Rs. {(isFiltered ? filteredAmount : totalWarehouseAmount).toLocaleString()}
            </div>
            {isFiltered && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Total: Rs. {totalWarehouseAmount.toLocaleString()}
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Total Bilties */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-card)', borderLeft: '4px solid #3b82f6', margin: 0, padding: '16px 20px' }}>
          <div style={{ background: '#dbeafe', borderRadius: '10px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={24} color="#2563eb" />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {isFiltered ? 'Filtered Bilties' : 'Total Pending Bilties'}
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#2563eb' }}>
              {isFiltered ? filteredInventory.length : inventory.length}
            </div>
            {isFiltered && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Total: {inventory.length} Bilties
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- Search & Destination Filter Bar --- */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Destination Search Input */}
          <div style={{ position: 'relative', flex: '1', minWidth: '260px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Destination (e.g. Islamabad, Lahore, Rawalpindi)..."
              style={{
                width: '100%',
                padding: '9px 36px 9px 38px',
                fontSize: '0.92rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)'
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Quick Destination Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Destination:</span>
            <select
              value={selectedDestination}
              onChange={(e) => setSelectedDestination(e.target.value)}
              style={{
                padding: '9px 14px',
                fontSize: '0.9rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="all">All Destinations ({inventory.length})</option>
              {uniqueDestinations.map(dest => {
                const count = inventory.filter(i => (i.destination_name || '').toLowerCase() === dest.toLowerCase()).length;
                return (
                  <option key={dest} value={dest}>
                    {dest} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Clear Filter Button */}
          {isFiltered && (
            <button
              type="button"
              onClick={() => { setSearchTerm(''); setSelectedDestination('all'); }}
              className="btn btn-secondary"
              style={{
                padding: '8px 14px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <X size={14} /> Clear Filter
            </button>
          )}
        </div>

        {/* Quick Destination Filter Pills */}
        {uniqueDestinations.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Quick Select:</span>
            <button
              type="button"
              onClick={() => setSelectedDestination('all')}
              style={{
                padding: '4px 12px',
                fontSize: '0.78rem',
                borderRadius: '20px',
                border: selectedDestination === 'all' ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                background: selectedDestination === 'all' ? 'var(--primary-color)' : 'var(--bg-main)',
                color: selectedDestination === 'all' ? '#fff' : 'var(--text-color)',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              All ({inventory.length})
            </button>
            {uniqueDestinations.map(dest => {
              const count = inventory.filter(i => (i.destination_name || '').toLowerCase() === dest.toLowerCase()).length;
              const isSelected = selectedDestination.toLowerCase() === dest.toLowerCase();
              return (
                <button
                  key={dest}
                  type="button"
                  onClick={() => setSelectedDestination(dest)}
                  style={{
                    padding: '4px 12px',
                    fontSize: '0.78rem',
                    borderRadius: '20px',
                    border: isSelected ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                    background: isSelected ? 'var(--primary-color)' : 'var(--bg-main)',
                    color: isSelected ? '#fff' : 'var(--text-color)',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  {dest} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Filter Summary Banner */}
        {isFiltered && (
          <div style={{
            marginTop: '12px',
            padding: '10px 14px',
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '6px',
            fontSize: '0.84rem',
            color: 'var(--text-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <span>
              Showing <strong>{filteredInventory.length}</strong> {filteredInventory.length === 1 ? 'bilty' : 'bilties'} for {selectedDestination !== 'all' ? <strong>"{selectedDestination}"</strong> : 'search'} {searchTerm ? `keyword "${searchTerm}"` : ''}
            </span>
            <span>
              Weight: <strong style={{ color: '#d97706' }}>{filteredWeight.toLocaleString()} KG</strong> &nbsp;|&nbsp; Rent Total: <strong style={{ color: '#059669' }}>Rs. {filteredAmount.toLocaleString()}</strong>
            </span>
          </div>
        )}
      </div>

      {/* --- Bilties Inventory Table --- */}
      <div className="card">
        {loading ? (
          <p>Loading inventory...</p>
        ) : filteredInventory.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            {isFiltered ? (
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>No bilties found matching your destination filter.</p>
                <button
                  type="button"
                  onClick={() => { setSearchTerm(''); setSelectedDestination('all'); }}
                  className="btn btn-secondary"
                  style={{ marginTop: '10px', fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  Show All Bilties
                </button>
              </div>
            ) : (
              <p style={{ margin: 0 }}>No pending items in the warehouse.</p>
            )}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', background: 'var(--bg-main)' }}>
                <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>Bilty #</th>
                <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>Date</th>
                <th style={{ padding: '8px 10px' }}>Destination</th>
                <th style={{ padding: '8px 10px' }}>Description</th>
                <th style={{ padding: '8px 10px' }}>Sender</th>
                <th style={{ padding: '8px 10px' }}>Receiver</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>Rem. Qty</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>Weight (KG)</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>Amount</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '7px 10px', fontWeight: 700, color: 'var(--primary-color)', whiteSpace: 'nowrap' }}>{item.bilty_number}</td>
                  <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{new Date(item.date).toLocaleDateString('en-PK')}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 600 }}>{item.destination_name}</td>
                  <td style={{ padding: '7px 10px' }}>{item.description}</td>
                  <td style={{ padding: '7px 10px' }}>{item.sender_name}</td>
                  <td style={{ padding: '7px 10px' }}>{item.receiver_name}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {item.remaining_quantity} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/ {item.total_quantity}</span>
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', color: '#f59e0b' }}>
                    {Number(item.weight_kg || 0).toLocaleString()} KG
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>Rs. {Number(item.total_amount || 0).toLocaleString()}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <button onClick={() => handlePrint(item)} title="Print Bilty" style={{ padding: '4px 8px', fontSize: '0.72rem', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '5px', cursor: 'pointer', background: '#f1f5f9', color: '#334155', whiteSpace: 'nowrap' }}>Print</button>
                      <button onClick={() => handlePDF(item)} title="Download PDF" style={{ padding: '4px 8px', fontSize: '0.72rem', fontWeight: 600, border: 'none', borderRadius: '5px', cursor: 'pointer', background: '#3B82F6', color: '#fff', whiteSpace: 'nowrap' }}>PDF</button>
                      <button onClick={() => handleWhatsApp(item)} title="Share on WhatsApp" style={{ padding: '4px 8px', fontSize: '0.72rem', fontWeight: 600, border: 'none', borderRadius: '5px', cursor: 'pointer', background: '#25D366', color: '#fff', whiteSpace: 'nowrap' }}>WA</button>
                      <button onClick={() => handleDelete(item)} title="Delete Bilty" style={{ padding: '4px 8px', fontSize: '0.72rem', fontWeight: 600, border: 'none', borderRadius: '5px', cursor: 'pointer', background: '#ef4444', color: '#fff' }}>X</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
