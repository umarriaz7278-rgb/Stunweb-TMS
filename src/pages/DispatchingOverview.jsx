import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, Truck, PlusCircle, Search, Printer, Link as LinkIcon, 
  CheckCircle2, AlertCircle, Trash2, Edit3, DollarSign,
  UserCheck, Layers, FileText
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useSettings } from '../context/SettingsContext';
import { getTenantItem, setTenantItem, getScopedKey, withTenantId } from '../utils/tenantStorage';

const DISPATCH_STOCK_KEY = 'dispatching_manual_inventory';
const DISPATCH_DELIVERIES_KEY = 'dispatching_delivery_history';

export default function DispatchingOverview() {
  const navigate = useNavigate();
  const { primaryBranchName } = useSettings();

  // Active Tab: 'inventory' | 'create' | 'deliveries'
  const [activeTab, setActiveTab] = useState('inventory');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // 'info' | 'success' | 'error'

  // Data States
  const [stockList, setStockList] = useState([]);
  const [deliveriesList, setDeliveriesList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'ready' | 'partial' | 'delivered'

  // Form State for Manual Stock Entry
  const [formEntry, setFormEntry] = useState({
    id: '',
    bilty_number: '',
    date: new Date().toISOString().split('T')[0],
    sender_name: '',
    sender_phone: '',
    receiver_name: '',
    receiver_phone: '',
    description: '',
    total_qty: '',
    rent_amount: '',
    loading_charges: '',
    unloading_charges: '',
    local_fare: '',
    other_charges: '',
    remarks: ''
  });

  // Modal / Delivery Handover State
  const [selectedStock, setSelectedStock] = useState(null);
  const [deliveryFormData, setDeliveryFormData] = useState({
    customer_name: '',
    customer_cnic: '',
    customer_phone: '',
    delivered_qty: 1,
    paid_amount: 0,
    extra_unloading: 0,
    extra_labor: 0,
    local_fare: 0,
    extra_other: 0,
    remarks: ''
  });
  const [recentDelivery, setRecentDelivery] = useState(null);

  // Load Initial Data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const localStock = getTenantItem(DISPATCH_STOCK_KEY, []);
    const localDeliveries = getTenantItem(DISPATCH_DELIVERIES_KEY, []);
    setStockList(Array.isArray(localStock) ? localStock : []);
    setDeliveriesList(Array.isArray(localDeliveries) ? localDeliveries : []);
  };

  const saveStockList = (newList) => {
    setStockList(newList);
    setTenantItem(DISPATCH_STOCK_KEY, newList);
  };

  const saveDeliveriesList = (newList) => {
    setDeliveriesList(newList);
    setTenantItem(DISPATCH_DELIVERIES_KEY, newList);
  };

  // Notification helper
  const showNotification = (msg, type = 'info') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
    }, 6000);
  };

  // Calculation for delivery form
  const deliveryTotal =
    (parseFloat(deliveryFormData.paid_amount) || 0) +
    (parseFloat(deliveryFormData.extra_unloading) || 0) +
    (parseFloat(deliveryFormData.extra_labor) || 0) +
    (parseFloat(deliveryFormData.local_fare) || 0) +
    (parseFloat(deliveryFormData.extra_other) || 0);

  // Stats
  const stats = useMemo(() => {
    const totalItems = stockList.reduce((sum, item) => sum + (parseInt(item.total_qty) || 0), 0);
    const availableItems = stockList.reduce((sum, item) => sum + (parseInt(item.available_qty) || 0), 0);
    const totalDeliveries = deliveriesList.reduce((sum, item) => sum + (parseInt(item.delivered_qty) || 0), 0);
    const totalIncomeCollected = deliveriesList.reduce((sum, item) => sum + (parseFloat(item.total_collected) || 0), 0);
    return { totalItems, availableItems, totalDeliveries, totalIncomeCollected };
  }, [stockList, deliveriesList]);

  // Handle Form Input Change for Manual Entry
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormEntry(prev => ({ ...prev, [name]: value }));
  };

  // Generate a random / sequential bilty number if empty
  const handleAutoBilty = () => {
    const num = 'DSP-' + Math.floor(100000 + Math.random() * 900000);
    setFormEntry(prev => ({ ...prev, bilty_number: num }));
  };

  // Submit New Stock Entry
  const handleSaveStock = (e) => {
    e.preventDefault();
    if (!formEntry.bilty_number.trim()) {
      showNotification('Bilty / Consignment number is required!', 'error');
      return;
    }
    const qty = parseInt(formEntry.total_qty) || 1;
    if (qty <= 0) {
      showNotification('Quantity must be greater than 0!', 'error');
      return;
    }

    if (formEntry.id) {
      // Editing existing stock item
      const updated = stockList.map(item => {
        if (item.id === formEntry.id) {
          const diff = qty - (item.total_qty || 0);
          const newAvail = Math.max(0, (item.available_qty || 0) + diff);
          return {
            ...item,
            ...formEntry,
            total_qty: qty,
            available_qty: newAvail,
            rent_amount: parseFloat(formEntry.rent_amount) || 0,
            loading_charges: parseFloat(formEntry.loading_charges) || 0,
            unloading_charges: parseFloat(formEntry.unloading_charges) || 0,
            local_fare: parseFloat(formEntry.local_fare) || 0,
            other_charges: parseFloat(formEntry.other_charges) || 0,
            status: newAvail === 0 ? 'delivered' : newAvail < qty ? 'partial' : 'ready',
            updated_at: new Date().toISOString()
          };
        }
        return item;
      });
      saveStockList(updated);
      showNotification(`Stock record for Bilty #${formEntry.bilty_number} updated!`, 'success');
    } else {
      // Check duplicate bilty
      const exists = stockList.some(s => (s.bilty_number || '').trim().toLowerCase() === formEntry.bilty_number.trim().toLowerCase());
      if (exists) {
        showNotification(`Bilty #${formEntry.bilty_number} already exists in dispatch inventory!`, 'error');
        return;
      }

      const newItem = {
        id: 'dsp_' + Date.now(),
        ...formEntry,
        total_qty: qty,
        available_qty: qty,
        delivered_qty: 0,
        rent_amount: parseFloat(formEntry.rent_amount) || 0,
        loading_charges: parseFloat(formEntry.loading_charges) || 0,
        unloading_charges: parseFloat(formEntry.unloading_charges) || 0,
        local_fare: parseFloat(formEntry.local_fare) || 0,
        other_charges: parseFloat(formEntry.other_charges) || 0,
        status: 'ready',
        created_at: new Date().toISOString()
      };

      saveStockList([newItem, ...stockList]);
      showNotification(`Bilty #${newItem.bilty_number} entered successfully into Dispatch Stock Ready!`, 'success');
    }

    // Reset Form
    setFormEntry({
      id: '',
      bilty_number: '',
      date: new Date().toISOString().split('T')[0],
      sender_name: '',
      sender_phone: '',
      receiver_name: '',
      receiver_phone: '',
      description: '',
      total_qty: '',
      rent_amount: '',
      loading_charges: '',
      unloading_charges: '',
      local_fare: '',
      other_charges: '',
      remarks: ''
    });
    setActiveTab('inventory');
  };

  // Edit stock item
  const handleEditStock = (item) => {
    setFormEntry({
      id: item.id,
      bilty_number: item.bilty_number || '',
      date: item.date || new Date().toISOString().split('T')[0],
      sender_name: item.sender_name || '',
      sender_phone: item.sender_phone || '',
      receiver_name: item.receiver_name || '',
      receiver_phone: item.receiver_phone || '',
      description: item.description || '',
      total_qty: item.total_qty || '',
      rent_amount: item.rent_amount || '',
      loading_charges: item.loading_charges || '',
      unloading_charges: item.unloading_charges || '',
      local_fare: item.local_fare || '',
      other_charges: item.other_charges || '',
      remarks: item.remarks || ''
    });
    setActiveTab('create');
  };

  // Delete stock item
  const handleDeleteStock = (id, biltyNo) => {
    if (window.confirm(`Are you sure you want to delete stock item Bilty #${biltyNo}?`)) {
      const updated = stockList.filter(s => s.id !== id);
      saveStockList(updated);
      showNotification(`Bilty #${biltyNo} removed from stock.`, 'info');
    }
  };

  // Open Handover / Deliver modal
  const handleOpenHandover = (item) => {
    setSelectedStock(item);
    setRecentDelivery(null);
    setDeliveryFormData({
      customer_name: item.receiver_name || '',
      customer_cnic: '',
      customer_phone: item.receiver_phone || '',
      delivered_qty: item.available_qty || 1,
      paid_amount: item.rent_amount || 0,
      extra_unloading: item.unloading_charges || 0,
      extra_labor: item.loading_charges || 0,
      local_fare: item.local_fare || 0,
      extra_other: item.other_charges || 0,
      remarks: ''
    });
  };

  // Close handover modal
  const handleCloseHandover = () => {
    setSelectedStock(null);
    setRecentDelivery(null);
  };

  // 1. LINK ACCOUNT STATEMENT ACTION
  const handleLinkAccountStatement = () => {
    if (!selectedStock) return;
    const confirmed = window.confirm(
      `Confirm Linking to Dispatching Account Statement:\n\n` +
      `Bilty: #${selectedStock.bilty_number}\n` +
      `Receiver / Customer: ${deliveryFormData.customer_name || selectedStock.receiver_name}\n` +
      `Total Bill Amount: Rs. ${deliveryTotal.toLocaleString('en-PK')}\n\n` +
      `This will open the Dispatching Account Statement page where you can debit this bill to customer ledger.`
    );
    if (!confirmed) return;

    const pendingLink = {
      bilty_number: selectedStock.bilty_number,
      total_amount: deliveryTotal,
      description: `Dispatch Bilty #${selectedStock.bilty_number} - ${selectedStock.description || 'Cargo'} (${deliveryFormData.delivered_qty} pcs)`,
      date: new Date().toISOString().split('T')[0],
      customer_name: deliveryFormData.customer_name || selectedStock.receiver_name,
      customer_phone: deliveryFormData.customer_phone || selectedStock.receiver_phone,
    };

    // Save under dispatching pending link key
    const pKey = 'dispatching_account_statement_pending_link';
    localStorage.setItem(pKey, JSON.stringify(pendingLink));
    const scoped = getScopedKey(pKey);
    if (scoped) localStorage.setItem(scoped, JSON.stringify(pendingLink));

    showNotification('Pending bill saved! Opening Dispatching Account Statement...', 'success');
    navigate('/dispatching/account-statement');
  };

  // 2. CONFIRM DELIVERY ACTION
  const handleConfirmDelivery = async (printAfter = false) => {
    if (!selectedStock) return;
    const deliverQty = parseInt(deliveryFormData.delivered_qty) || 0;
    if (deliverQty <= 0) {
      showNotification('Delivered quantity must be greater than 0!', 'error');
      return;
    }
    if (deliverQty > selectedStock.available_qty) {
      showNotification(`Cannot deliver ${deliverQty}. Only ${selectedStock.available_qty} items available in stock!`, 'error');
      return;
    }

    const totalIncome = deliveryTotal;
    const confirmed = window.confirm(
      `Confirm Handover / Delivery:\n\n` +
      `Bilty #: ${selectedStock.bilty_number}\n` +
      `Customer / Receiver: ${deliveryFormData.customer_name || selectedStock.receiver_name}\n` +
      `Delivering Qty: ${deliverQty} / ${selectedStock.available_qty}\n` +
      `Total Income Collected: Rs. ${totalIncome.toLocaleString('en-PK')}\n\n` +
      `This income will be automatically recorded in Dispatching Finance.`
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      // 1. Update Stock Inventory
      const newAvail = selectedStock.available_qty - deliverQty;
      const newDelivered = (selectedStock.delivered_qty || 0) + deliverQty;
      const updatedStockList = stockList.map(item => {
        if (item.id === selectedStock.id) {
          return {
            ...item,
            available_qty: newAvail,
            delivered_qty: newDelivered,
            status: newAvail === 0 ? 'delivered' : 'partial'
          };
        }
        return item;
      });
      saveStockList(updatedStockList);

      // 2. Record Delivery Log
      const deliveryRecord = {
        id: 'del_' + Date.now(),
        stock_id: selectedStock.id,
        bilty_number: selectedStock.bilty_number,
        sender_name: selectedStock.sender_name,
        receiver_name: deliveryFormData.customer_name || selectedStock.receiver_name,
        customer_phone: deliveryFormData.customer_phone,
        customer_cnic: deliveryFormData.customer_cnic,
        description: selectedStock.description,
        delivered_qty: deliverQty,
        paid_amount: parseFloat(deliveryFormData.paid_amount) || 0,
        extra_unloading: parseFloat(deliveryFormData.extra_unloading) || 0,
        extra_labor: parseFloat(deliveryFormData.extra_labor) || 0,
        local_fare: parseFloat(deliveryFormData.local_fare) || 0,
        extra_other: parseFloat(deliveryFormData.extra_other) || 0,
        total_collected: totalIncome,
        delivered_at: new Date().toISOString(),
        date_formatted: new Date().toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      };

      const updatedDeliveries = [deliveryRecord, ...deliveriesList];
      saveDeliveriesList(updatedDeliveries);

      // 3. Automatically add income to branch_ledgers with branch_name = 'Dispatching'
      if (totalIncome > 0) {
        const incomeEntry = {
          id: 'ledger_' + Date.now(),
          branch_name: 'Dispatching',
          entry_date: new Date().toISOString().split('T')[0],
          entry_type: 'income',
          description: `Delivery collected - Bilty #${selectedStock.bilty_number} (${deliveryFormData.customer_name || selectedStock.receiver_name || 'Customer'})`,
          amount: totalIncome,
          created_at: new Date().toISOString()
        };

        // 1. Save to tenant-scoped storage for instant, 100% reliable display in Dispatching Finance
        const currentLocal = getTenantItem('dispatching_branch_ledgers', []) || [];
        setTenantItem('dispatching_branch_ledgers', [incomeEntry, ...currentLocal]);

        // 2. Sync to Supabase branch_ledgers table
        try {
          const payload = {
            branch_name: 'Dispatching',
            entry_date: incomeEntry.entry_date,
            entry_type: 'income',
            description: incomeEntry.description,
            amount: totalIncome
          };
          let { error: ledgerError } = await supabase.from('branch_ledgers').insert([withTenantId(payload)]);
          if (ledgerError && ledgerError.message && ledgerError.message.includes('tenant_id')) {
            await supabase.from('branch_ledgers').insert([payload]);
          }
        } catch (err) {
          console.warn('Ledger sync warning:', err);
        }
      }

      setRecentDelivery(deliveryRecord);
      showNotification(`Delivery recorded successfully! Rs. ${totalIncome.toLocaleString()} added to Dispatching Finance.`, 'success');

      if (printAfter) {
        printDeliveryReceipt(deliveryRecord);
        setSelectedStock(null);
      } else {
        setSelectedStock(null);
      }
    } catch (err) {
      console.error(err);
      showNotification(`Error during delivery: ${err.message || err}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Receipt HTML Builder
  const buildDeliveryReceiptHtml = (delivery) => {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Delivery Receipt #${delivery.bilty_number}</title><style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; width: 80mm; margin: 0 auto; padding: 10px; color: #111; }
      * { box-sizing: border-box; }
      .header { text-align: center; margin-bottom: 8px; border-bottom: 2px dashed #333; padding-bottom: 8px; }
      .header h2 { margin: 0; font-size: 16px; font-weight: bold; text-transform: uppercase; }
      .header p { margin: 3px 0 0; font-size: 11px; color: #555; }
      .badge { display: inline-block; background: #eee; padding: 2px 6px; font-size: 10px; font-weight: bold; margin-top: 4px; border-radius: 4px; }
      .info-sec { font-size: 11px; margin: 8px 0; border-bottom: 1px dashed #ccc; padding-bottom: 8px; }
      .info-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
      .info-label { font-weight: 600; color: #444; }
      .amounts-table { width: 100%; font-size: 11px; border-collapse: collapse; margin: 8px 0; }
      .amounts-table td { padding: 3px 0; }
      .amounts-table tr.total-row td { border-top: 1px solid #111; font-weight: bold; font-size: 13px; padding-top: 6px; }
      .footer { margin-top: 12px; text-align: center; font-size: 10px; color: #666; border-top: 1px dashed #ccc; padding-top: 8px; }
      @media print { body { width: 80mm; padding: 4px; } }
    </style></head><body>
      <div class="header">
        <h2>DISPATCHING HUB</h2>
        <p>Delivery & Handover Receipt</p>
        <span class="badge">Bilty #: ${delivery.bilty_number}</span>
      </div>
      <div class="info-sec">
        <div class="info-row"><span class="info-label">Date & Time:</span><span>${delivery.date_formatted || new Date().toLocaleString()}</span></div>
        <div class="info-row"><span class="info-label">Customer / Receiver:</span><span>${delivery.receiver_name || '-'}</span></div>
        <div class="info-row"><span class="info-label">Contact / Phone:</span><span>${delivery.customer_phone || '-'}</span></div>
        ${delivery.customer_cnic ? `<div class="info-row"><span class="info-label">CNIC:</span><span>${delivery.customer_cnic}</span></div>` : ''}
        <div class="info-row"><span class="info-label">Cargo Desc:</span><span>${delivery.description || '-'}</span></div>
        <div class="info-row"><span class="info-label">Qty Delivered:</span><span><strong>${delivery.delivered_qty} Pcs</strong></span></div>
      </div>
      <table class="amounts-table">
        <tr><td>Freight / Rent:</td><td style="text-align:right;">Rs. ${(parseFloat(delivery.paid_amount) || 0).toLocaleString()}</td></tr>
        ${delivery.extra_unloading > 0 ? `<tr><td>Unloading Charges:</td><td style="text-align:right;">Rs. ${delivery.extra_unloading.toLocaleString()}</td></tr>` : ''}
        ${delivery.extra_labor > 0 ? `<tr><td>Loading Charges:</td><td style="text-align:right;">Rs. ${delivery.extra_labor.toLocaleString()}</td></tr>` : ''}
        ${delivery.local_fare > 0 ? `<tr><td>Local Fare:</td><td style="text-align:right;">Rs. ${delivery.local_fare.toLocaleString()}</td></tr>` : ''}
        ${delivery.extra_other > 0 ? `<tr><td>Other Charges:</td><td style="text-align:right;">Rs. ${delivery.extra_other.toLocaleString()}</td></tr>` : ''}
        <tr class="total-row">
          <td>TOTAL COLLECTED:</td>
          <td style="text-align:right;">Rs. ${(parseFloat(delivery.total_collected) || 0).toLocaleString()}</td>
        </tr>
      </table>
      <div class="footer">
        <p>Goods received in sound & complete condition.</p>
        <div style="display:flex; justify-content:space-between; margin-top: 20px;">
          <span>Receiver Sign: ________</span>
          <span>Cashier: ________</span>
        </div>
      </div>
    </body></html>`;
  };

  const printDeliveryReceipt = (delivery) => {
    const printWindow = window.open('', '_blank', 'width=420,height=620');
    if (!printWindow) return;
    printWindow.document.write(buildDeliveryReceiptHtml(delivery));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  // Filtered Stock Items
  const filteredStock = useMemo(() => {
    return stockList.filter(item => {
      const matchSearch =
        (item.bilty_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.receiver_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.sender_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.receiver_phone || '').includes(searchTerm);

      if (!matchSearch) return false;
      if (filterStatus === 'ready') return item.status === 'ready' || (item.available_qty > 0 && item.available_qty === item.total_qty);
      if (filterStatus === 'partial') return item.status === 'partial' || (item.available_qty > 0 && item.available_qty < item.total_qty);
      if (filterStatus === 'delivered') return item.status === 'delivered' || item.available_qty === 0;
      return true;
    });
  }, [stockList, searchTerm, filterStatus]);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* ── Page Header ── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--border-color, #e2e8f0)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
          }}>
            <Truck size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
              Dispatching Hub & Manual Stock Overview
            </h1>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary, #64748b)' }}>
              Direct manual stock entry, inventory handover, and delivery dispatch management.
            </p>
          </div>
        </div>

        {/* Quick Nav to Finance & Statement */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => navigate('/dispatching/finance')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#ecfdf5',
              color: '#059669',
              border: '1px solid #a7f3d0',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            <DollarSign size={16} />
            Dispatching Finance
          </button>
          <button
            onClick={() => navigate('/dispatching/account-statement')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            <FileText size={16} />
            Account Statement
          </button>
        </div>
      </div>

      {/* ── Notification Banner ── */}
      {message && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          backgroundColor: messageType === 'success' ? '#f0fdf4' : messageType === 'error' ? '#fef2f2' : '#f0f9ff',
          border: `1px solid ${messageType === 'success' ? '#bbf7d0' : messageType === 'error' ? '#fecaca' : '#bae6fd'}`,
          color: messageType === 'success' ? '#166534' : messageType === 'error' ? '#991b1b' : '#0369a1',
          fontSize: '14px',
          fontWeight: 500
        }}>
          {messageType === 'success' ? <CheckCircle2 size={18} /> : messageType === 'error' ? <AlertCircle size={18} /> : <Layers size={18} />}
          <span>{message}</span>
        </div>
      )}

      {/* ── Stats Summary Bar ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: 'var(--card-bg, #fff)',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '10px',
            background: 'rgba(59, 130, 246, 0.1)',
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Package size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase' }}>
              Stock Ready
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
              {stats.availableItems.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>/ {stats.totalItems.toLocaleString()} pcs</span>
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--card-bg, #fff)',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.1)',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <UserCheck size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase' }}>
              Total Handed Over
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669' }}>
              {stats.totalDeliveries.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>pcs</span>
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--card-bg, #fff)',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.1)',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase' }}>
              Income Collected
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#d97706' }}>
              Rs. {stats.totalIncomeCollected.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        borderBottom: '2px solid var(--border-color, #e2e8f0)',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('inventory')}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'inventory' ? '3px solid #2563eb' : '3px solid transparent',
              color: activeTab === 'inventory' ? '#2563eb' : 'var(--text-secondary, #64748b)',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Package size={18} />
            Stock Ready Inventory ({stockList.filter(s => s.available_qty > 0).length})
          </button>

          <button
            onClick={() => {
              if (activeTab !== 'create') {
                setFormEntry({
                  id: '',
                  bilty_number: '',
                  date: new Date().toISOString().split('T')[0],
                  sender_name: '',
                  sender_phone: '',
                  receiver_name: '',
                  receiver_phone: '',
                  description: '',
                  total_qty: '',
                  rent_amount: '',
                  loading_charges: '',
                  unloading_charges: '',
                  local_fare: '',
                  other_charges: '',
                  remarks: ''
                });
              }
              setActiveTab('create');
            }}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'create' ? '3px solid #2563eb' : '3px solid transparent',
              color: activeTab === 'create' ? '#2563eb' : 'var(--text-secondary, #64748b)',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <PlusCircle size={18} />
            {formEntry.id ? 'Edit Stock Entry' : '➕ Manual Stock Entry'}
          </button>

          <button
            onClick={() => setActiveTab('deliveries')}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'deliveries' ? '3px solid #2563eb' : '3px solid transparent',
              color: activeTab === 'deliveries' ? '#2563eb' : 'var(--text-secondary, #64748b)',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <FileText size={18} />
            Delivery History ({deliveriesList.length})
          </button>
        </div>
      </div>

      {/* ── TAB 1: MANUAL STOCK ENTRY FORM ── */}
      {activeTab === 'create' && (
        <div style={{
          background: 'var(--card-bg, #fff)',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid var(--border-color, #e2e8f0)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PlusCircle color="#2563eb" size={20} />
              {formEntry.id ? 'Edit Manual Stock Entry' : 'New Manual Stock Entry (Dispatch Ready)'}
            </h2>
            <button
              type="button"
              onClick={handleAutoBilty}
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                color: '#475569'
              }}
            >
              🎲 Auto Generate Bilty #
            </button>
          </div>

          <form onSubmit={handleSaveStock}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              
              {/* Bilty Number */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>
                  Bilty / Consignment # <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  name="bilty_number"
                  value={formEntry.bilty_number}
                  onChange={handleInputChange}
                  placeholder="e.g. DSP-10492"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    fontWeight: 600
                  }}
                />
              </div>

              {/* Date */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>
                  Entry / Bilty Date <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date"
                  name="date"
                  value={formEntry.date}
                  onChange={handleInputChange}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Sender Name */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>
                  Sender (Consignor) Name
                </label>
                <input
                  type="text"
                  name="sender_name"
                  value={formEntry.sender_name}
                  onChange={handleInputChange}
                  placeholder="e.g. Al-Madina Trading"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Sender Phone */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>
                  Sender Phone
                </label>
                <input
                  type="text"
                  name="sender_phone"
                  value={formEntry.sender_phone}
                  onChange={handleInputChange}
                  placeholder="03xx-xxxxxxx"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Receiver Name */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>
                  Receiver (Consignee) Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  name="receiver_name"
                  value={formEntry.receiver_name}
                  onChange={handleInputChange}
                  placeholder="e.g. Tariq Goods / Khan Autos"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    fontWeight: 600
                  }}
                />
              </div>

              {/* Receiver Phone */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>
                  Receiver Phone
                </label>
                <input
                  type="text"
                  name="receiver_phone"
                  value={formEntry.receiver_phone}
                  onChange={handleInputChange}
                  placeholder="03xx-xxxxxxx"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Cargo Description */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>
                  Cargo / Goods Description <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  name="description"
                  value={formEntry.description}
                  onChange={handleInputChange}
                  placeholder="e.g. 50 Bags Cotton, 10 Cartons Auto Spare Parts"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Total Quantity */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>
                  Total Quantity (Stock Ready) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  name="total_qty"
                  value={formEntry.total_qty}
                  onChange={handleInputChange}
                  placeholder="e.g. 25"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#2563eb'
                  }}
                />
              </div>

              {/* Freight / Rent Amount */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>
                  Freight / Rent (Rs.)
                </label>
                <input
                  type="number"
                  name="rent_amount"
                  value={formEntry.rent_amount}
                  onChange={handleInputChange}
                  placeholder="0"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Unloading */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>
                  Unloading Charges (Rs.)
                </label>
                <input
                  type="number"
                  name="unloading_charges"
                  value={formEntry.unloading_charges}
                  onChange={handleInputChange}
                  placeholder="0"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Loading */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>
                  Loading Charges (Rs.)
                </label>
                <input
                  type="number"
                  name="loading_charges"
                  value={formEntry.loading_charges}
                  onChange={handleInputChange}
                  placeholder="0"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Local Fare */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>
                  Local Fare / Cartage (Rs.)
                </label>
                <input
                  type="number"
                  name="local_fare"
                  value={formEntry.local_fare}
                  onChange={handleInputChange}
                  placeholder="0"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Other Charges */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>
                  Other Charges (Rs.)
                </label>
                <input
                  type="number"
                  name="other_charges"
                  value={formEntry.other_charges}
                  onChange={handleInputChange}
                  placeholder="0"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Remarks */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>
                  Remarks / Destination Notes
                </label>
                <input
                  type="text"
                  name="remarks"
                  value={formEntry.remarks}
                  onChange={handleInputChange}
                  placeholder="e.g. Payment on delivery / Warehouse section 4"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px'
                  }}
                />
              </div>

            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button
                type="submit"
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <CheckCircle2 size={18} />
                {formEntry.id ? 'Update Stock Item' : 'Save To Stock Ready'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormEntry({
                    id: '',
                    bilty_number: '',
                    date: new Date().toISOString().split('T')[0],
                    sender_name: '',
                    sender_phone: '',
                    receiver_name: '',
                    receiver_phone: '',
                    description: '',
                    total_qty: '',
                    rent_amount: '',
                    loading_charges: '',
                    unloading_charges: '',
                    local_fare: '',
                    other_charges: '',
                    remarks: ''
                  });
                  setActiveTab('inventory');
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── TAB 2: STOCK READY INVENTORY LIST ── */}
      {activeTab === 'inventory' && (
        <div style={{
          background: 'var(--card-bg, #fff)',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid var(--border-color, #e2e8f0)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
        }}>
          {/* Filters and Search */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '260px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search by Bilty #, Receiver, Sender, Goods..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 38px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#334155'
                }}
              >
                <option value="all">All Items</option>
                <option value="ready">Stock Ready (Full)</option>
                <option value="partial">Partially Delivered</option>
                <option value="delivered">Fully Delivered</option>
              </select>

              <button
                onClick={() => {
                  setFormEntry({
                    id: '',
                    bilty_number: '',
                    date: new Date().toISOString().split('T')[0],
                    sender_name: '',
                    sender_phone: '',
                    receiver_name: '',
                    receiver_phone: '',
                    description: '',
                    total_qty: '',
                    rent_amount: '',
                    loading_charges: '',
                    unloading_charges: '',
                    local_fare: '',
                    other_charges: '',
                    remarks: ''
                  });
                  setActiveTab('create');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 16px',
                  backgroundColor: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <PlusCircle size={16} />
                Add Stock
              </button>
            </div>
          </div>

          {/* Stock Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '12px 14px' }}>Bilty #</th>
                  <th style={{ padding: '12px 14px' }}>Date</th>
                  <th style={{ padding: '12px 14px' }}>Receiver (Party)</th>
                  <th style={{ padding: '12px 14px' }}>Cargo / Goods</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Total Qty</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Stock Ready</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Freight / Rent</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      <Package size={36} style={{ margin: '0 auto 8px', opacity: 0.5, display: 'block' }} />
                      No stock items found in Dispatching. Click <strong>"➕ Manual Stock Entry"</strong> to add items.
                    </td>
                  </tr>
                ) : (
                  filteredStock.map((item) => {
                    const isAvailable = (item.available_qty || 0) > 0;
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1e40af' }}>
                          {item.bilty_number}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748b' }}>
                          {item.date || '-'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.receiver_name}</div>
                          {item.receiver_phone && (
                            <div style={{ fontSize: '11px', color: '#64748b' }}>📞 {item.receiver_phone}</div>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#334155' }}>
                          {item.description}
                          {item.sender_name && (
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Sender: {item.sender_name}</div>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600 }}>
                          {item.total_qty}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontWeight: 800,
                            fontSize: '12px',
                            backgroundColor: isAvailable ? 'rgba(37, 99, 235, 0.1)' : '#f1f5f9',
                            color: isAvailable ? '#2563eb' : '#94a3b8'
                          }}>
                            {item.available_qty} pcs
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                          Rs. ${(parseFloat(item.rent_amount) || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            backgroundColor: item.available_qty === 0 ? '#f1f5f9' : item.available_qty < item.total_qty ? '#fef3c7' : '#dcfce7',
                            color: item.available_qty === 0 ? '#64748b' : item.available_qty < item.total_qty ? '#d97706' : '#166534'
                          }}>
                            {item.available_qty === 0 ? 'Delivered' : item.available_qty < item.total_qty ? 'Partial' : 'Ready'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            {isAvailable && (
                              <button
                                onClick={() => handleOpenHandover(item)}
                                title="Deliver / Handover to customer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '6px 12px',
                                  backgroundColor: '#16a34a',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                <Truck size={14} />
                                Handover
                              </button>
                            )}

                            <button
                              onClick={() => handleEditStock(item)}
                              title="Edit Entry"
                              style={{
                                padding: '6px 8px',
                                backgroundColor: '#f1f5f9',
                                color: '#475569',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                            >
                              <Edit3 size={14} />
                            </button>

                            <button
                              onClick={() => handleDeleteStock(item.id, item.bilty_number)}
                              title="Delete Entry"
                              style={{
                                padding: '6px 8px',
                                backgroundColor: '#fef2f2',
                                color: '#ef4444',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: DELIVERIES LOG ── */}
      {activeTab === 'deliveries' && (
        <div style={{
          background: 'var(--card-bg, #fff)',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid var(--border-color, #e2e8f0)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="#2563eb" />
            Completed Dispatch Deliveries Log
          </h2>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '12px 14px' }}>Bilty #</th>
                  <th style={{ padding: '12px 14px' }}>Delivered Date & Time</th>
                  <th style={{ padding: '12px 14px' }}>Receiver / Customer</th>
                  <th style={{ padding: '12px 14px' }}>Phone / CNIC</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Delivered Qty</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Income Collected</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {deliveriesList.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      No deliveries have been recorded yet.
                    </td>
                  </tr>
                ) : (
                  deliveriesList.map((del) => (
                    <tr key={del.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1e40af' }}>
                        {del.bilty_number}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#64748b' }}>
                        {del.date_formatted || new Date(del.delivered_at).toLocaleDateString('en-PK')}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                        {del.receiver_name || '-'}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '12px' }}>
                        {del.customer_phone || '-'} {del.customer_cnic ? `(${del.customer_cnic})` : ''}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#059669' }}>
                        {del.delivered_qty} pcs
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#d97706' }}>
                        Rs. ${(parseFloat(del.total_collected) || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          onClick={() => printDeliveryReceipt(del)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 10px',
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <Printer size={13} />
                          Print
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: HANDOVER / DELIVER POPUP ── */}
      {selectedStock && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '620px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  padding: '8px',
                  borderRadius: '8px',
                  background: 'rgba(22, 163, 74, 0.1)',
                  color: '#16a34a'
                }}>
                  <Truck size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                    Deliver / Handover — Bilty #{selectedStock.bilty_number}
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    {selectedStock.description} | Available Stock: <strong>{selectedStock.available_qty} pcs</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseHandover}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px' }}>
              
              {/* Receiver Info */}
              <div style={{
                background: '#f1f5f9',
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '16px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                fontSize: '12px'
              }}>
                <div><span style={{ color: '#64748b' }}>Original Receiver:</span> <strong>{selectedStock.receiver_name}</strong></div>
                <div><span style={{ color: '#64748b' }}>Sender:</span> <strong>{selectedStock.sender_name || 'N/A'}</strong></div>
                <div><span style={{ color: '#64748b' }}>Total Bilty Qty:</span> <strong>{selectedStock.total_qty} pcs</strong></div>
                <div><span style={{ color: '#64748b' }}>Stock Ready Qty:</span> <strong style={{ color: '#2563eb' }}>{selectedStock.available_qty} pcs</strong></div>
              </div>

              {/* Handover Form */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Deliver Quantity (Pcs) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={selectedStock.available_qty}
                    value={deliveryFormData.delivered_qty}
                    onChange={(e) => setDeliveryFormData(prev => ({ ...prev, delivered_qty: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#2563eb'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Customer / Receiver Name
                  </label>
                  <input
                    type="text"
                    value={deliveryFormData.customer_name}
                    onChange={(e) => setDeliveryFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                    placeholder="Receiver Name"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Customer Phone
                  </label>
                  <input
                    type="text"
                    value={deliveryFormData.customer_phone}
                    onChange={(e) => setDeliveryFormData(prev => ({ ...prev, customer_phone: e.target.value }))}
                    placeholder="03xx-xxxxxxx"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Customer CNIC (Optional)
                  </label>
                  <input
                    type="text"
                    value={deliveryFormData.customer_cnic}
                    onChange={(e) => setDeliveryFormData(prev => ({ ...prev, customer_cnic: e.target.value }))}
                    placeholder="xxxxx-xxxxxxx-x"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px'
                    }}
                  />
                </div>
              </div>

              {/* Income Collection Breakdown */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '14px',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>
                  💰 Income Collection Breakdown:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Freight (Paid)</label>
                    <input
                      type="number"
                      value={deliveryFormData.paid_amount}
                      onChange={(e) => setDeliveryFormData(prev => ({ ...prev, paid_amount: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Unloading</label>
                    <input
                      type="number"
                      value={deliveryFormData.extra_unloading}
                      onChange={(e) => setDeliveryFormData(prev => ({ ...prev, extra_unloading: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Loading</label>
                    <input
                      type="number"
                      value={deliveryFormData.extra_labor}
                      onChange={(e) => setDeliveryFormData(prev => ({ ...prev, extra_labor: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Local Fare</label>
                    <input
                      type="number"
                      value={deliveryFormData.local_fare}
                      onChange={(e) => setDeliveryFormData(prev => ({ ...prev, local_fare: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Other</label>
                    <input
                      type="number"
                      value={deliveryFormData.extra_other}
                      onChange={(e) => setDeliveryFormData(prev => ({ ...prev, extra_other: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '12px',
                  paddingTop: '10px',
                  borderTop: '1px solid #e2e8f0',
                  fontWeight: 800,
                  fontSize: '15px'
                }}>
                  <span>TOTAL INCOME TO COLLECT:</span>
                  <span style={{ color: '#16a34a' }}>Rs. {deliveryTotal.toLocaleString('en-PK')}</span>
                </div>
              </div>

              {/* 3 Action Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                
                {/* 1. Confirm Delivery */}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleConfirmDelivery(false)}
                  style={{
                    padding: '11px 8px',
                    backgroundColor: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  <CheckCircle2 size={18} />
                  Confirm Delivery
                </button>

                {/* 2. Confirm & Print */}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleConfirmDelivery(true)}
                  style={{
                    padding: '11px 8px',
                    backgroundColor: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  <Printer size={18} />
                  Confirm & Print
                </button>

                {/* 3. Link Account Statement */}
                <button
                  type="button"
                  onClick={handleLinkAccountStatement}
                  style={{
                    padding: '11px 8px',
                    backgroundColor: '#f59e0b',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <LinkIcon size={18} />
                  Link A/C Statement
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
