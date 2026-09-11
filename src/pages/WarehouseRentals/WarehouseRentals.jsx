import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Warehouse, Plus, Search, FileText, Package, TrendingUp, X, Trash2 } from 'lucide-react';

const TABS = ['Inventory', 'Add Client & Item', 'Deliveries', 'Reports'];

export default function WarehouseRentals() {
  const [activeTab, setActiveTab] = useState('Inventory');
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Add Client & Item Form
  const [clientForm, setClientForm] = useState({
    name: '', contact_number: '', email: ''
  });
  const [itemForm, setItemForm] = useState({
    client_id: '', bag_number: '', quantity: '', weight_per_item: '',
    date_in: new Date().toISOString().split('T')[0],
    rent_period_days: 30, expected_payment: '',
    warehouse_section: '', remarks: ''
  });
  const [useExistingClient, setUseExistingClient] = useState(false);

  // Delivery Form
  const [deliveryForm, setDeliveryForm] = useState({
    item_id: '', date_out: new Date().toISOString().split('T')[0],
    delivered_quantity: '', payment_received: '', late_charges: 0, notes: ''
  });

  // Reports
  const [reportMonth, setReportMonth] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    const [itemsRes, clientsRes, deliveriesRes] = await Promise.all([
      supabase.from('warehouse_rental_items').select(`*, warehouse_rental_clients(name, contact_number, email)`).order('created_at', { ascending: false }),
      supabase.from('warehouse_rental_clients').select('*').order('name'),
      supabase.from('warehouse_rental_deliveries').select(`*, warehouse_rental_items(bag_number, warehouse_section, warehouse_rental_clients(name))`).order('date_out', { ascending: false })
    ]);
    if (itemsRes.data) setItems(itemsRes.data);
    if (clientsRes.data) setClients(clientsRes.data);
    if (deliveriesRes.data) setDeliveries(deliveriesRes.data);
  }

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  // --- Derived: remaining quantity per item ---
  function getRemainingQty(item) {
    const delivered = deliveries
      .filter(d => d.item_id === item.id)
      .reduce((sum, d) => sum + (d.delivered_quantity || 0), 0);
    return item.quantity - delivered;
  }

  function getDeliveredQty(item) {
    return deliveries
      .filter(d => d.item_id === item.id)
      .reduce((sum, d) => sum + (d.delivered_quantity || 0), 0);
  }

  function getPaidAmount(item) {
    return deliveries
      .filter(d => d.item_id === item.id)
      .reduce((sum, d) => sum + (parseFloat(d.payment_received) || 0), 0);
  }

  function getDaysStored(item) {
    const dateIn = new Date(item.date_in);
    const today = new Date();
    return Math.floor((today - dateIn) / (1000 * 60 * 60 * 24));
  }

  function isLate(item) {
    return getDaysStored(item) > item.rent_period_days;
  }

  // --- Submit Handlers ---
  const handleAddItem = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let clientId = itemForm.client_id;

      if (!useExistingClient) {
        if (!clientForm.name.trim()) throw new Error('Client name is required.');
        const { data: newClient, error: cErr } = await supabase
          .from('warehouse_rental_clients')
          .insert([clientForm])
          .select().single();
        if (cErr) throw cErr;
        clientId = newClient.id;
      }

      const { error: iErr } = await supabase.from('warehouse_rental_items').insert([{
        ...itemForm,
        client_id: clientId,
        quantity: parseInt(itemForm.quantity),
        weight_per_item: parseFloat(itemForm.weight_per_item) || 0,
        expected_payment: parseFloat(itemForm.expected_payment) || 0,
        rent_period_days: parseInt(itemForm.rent_period_days) || 30
      }]);
      if (iErr) throw iErr;

      showMessage('Client & Item added successfully!');
      setClientForm({ name: '', contact_number: '', email: '' });
      setItemForm({ client_id: '', bag_number: '', quantity: '', weight_per_item: '', date_in: new Date().toISOString().split('T')[0], rent_period_days: 30, expected_payment: '', warehouse_section: '', remarks: '' });
      setActiveTab('Inventory');
      fetchAll();
    } catch (err) {
      showMessage(err.message, 'error');
    }
    setLoading(false);
  };

  const handleDelivery = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const selectedItem = items.find(i => i.id === deliveryForm.item_id);
      if (!selectedItem) throw new Error('Please select an item.');
      const remaining = getRemainingQty(selectedItem);
      const dQty = parseInt(deliveryForm.delivered_quantity) || 0;
      if (dQty > remaining) throw new Error(`Cannot deliver ${dQty}. Only ${remaining} remaining.`);

      const { error } = await supabase.from('warehouse_rental_deliveries').insert([{
        item_id: deliveryForm.item_id,
        date_out: deliveryForm.date_out,
        delivered_quantity: dQty,
        payment_received: parseFloat(deliveryForm.payment_received) || 0,
        late_charges: parseFloat(deliveryForm.late_charges) || 0,
        notes: deliveryForm.notes
      }]);
      if (error) throw error;

      // If fully delivered, mark item as completed
      if (dQty >= remaining) {
        await supabase.from('warehouse_rental_items').update({ status: 'completed' }).eq('id', deliveryForm.item_id);
      }

      showMessage('Delivery recorded successfully!');
      setDeliveryForm({ item_id: '', date_out: new Date().toISOString().split('T')[0], delivered_quantity: '', payment_received: '', late_charges: 0, notes: '' });
      fetchAll();
    } catch (err) {
      showMessage(err.message, 'error');
    }
    setLoading(false);
  };

  // --- Delete Item ---
  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.warehouse_rental_clients?.name} - ${item.bag_number || 'No Bag#'}"? This will also delete all related deliveries.`)) return;
    setLoading(true);
    try {
      await supabase.from('warehouse_rental_deliveries').delete().eq('item_id', item.id);
      const { error } = await supabase.from('warehouse_rental_items').delete().eq('id', item.id);
      if (error) throw error;
      showMessage('Item deleted successfully!');
      fetchAll();
    } catch (err) {
      showMessage(err.message, 'error');
    }
    setLoading(false);
  };

  // --- Filtered Inventory ---
  const filteredItems = items.filter(item => {
    const client = item.warehouse_rental_clients;
    const matchSearch = !search ||
      (client?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.bag_number || '').toLowerCase().includes(search.toLowerCase());
    const matchSection = !filterSection || (item.warehouse_section || '').toLowerCase().includes(filterSection.toLowerCase());
    const matchStatus = !filterStatus || item.status === filterStatus;
    const matchDate = !filterDate || item.date_in === filterDate;
    return matchSearch && matchSection && matchStatus && matchDate;
  });

  // --- Report Calculations ---
  const reportItems = reportMonth
    ? items.filter(i => i.date_in && i.date_in.startsWith(reportMonth))
    : items;

  const totalExpected = reportItems.reduce((s, i) => s + (parseFloat(i.expected_payment) || 0), 0);
  const totalReceived = reportItems.reduce((s, i) => s + getPaidAmount(i), 0);
  const totalPending = totalExpected - totalReceived;
  const activeCount = items.filter(i => getRemainingQty(i) > 0).length;
  const totalStoredQty = items.reduce((s, i) => s + getRemainingQty(i), 0);

  const uniqueSections = [...new Set(items.map(i => i.warehouse_section).filter(Boolean))];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <Warehouse size={32} color="#2563eb" />
        <h1 className="page-title" style={{ marginBottom: 0, color: '#1e40af', fontWeight: 800 }}>Warehouse Rentals</h1>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Manage client storage contracts, inventory, deliveries, and rental payments.</p>

      {/* Message */}
      {message.text && (
        <div style={{ padding: '12px 16px', marginBottom: '20px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: message.type === 'error' ? '#fee2e2' : '#d1fae5', color: message.type === 'error' ? '#991b1b' : '#065f46' }}>
          <span>{message.text}</span>
          <X size={16} style={{ cursor: 'pointer' }} onClick={() => setMessage({ text: '', type: '' })} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid var(--border-color)', paddingBottom: '0' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
              borderBottom: activeTab === tab ? '3px solid var(--primary-color)' : '3px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === tab ? 'var(--primary-color)' : 'var(--text-muted)',
              marginBottom: '-2px', transition: 'all 0.2s'
            }}
          >{tab}</button>
        ))}
      </div>

      {/* ===================== TAB: INVENTORY ===================== */}
      {activeTab === 'Inventory' && (
        <div>
          {/* Summary Cards */}
          <div className="stats-grid" style={{ marginBottom: '24px' }}>
            <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div className="stat-title">Active Contracts</div>
              <div className="stat-value" style={{ color: '#3b82f6' }}>{activeCount}</div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
              <div className="stat-title">Total Items in Storage</div>
              <div className="stat-value" style={{ color: '#10b981' }}>{totalStoredQty}</div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div className="stat-title">Pending Payment</div>
              <div className="stat-value" style={{ color: '#f59e0b', fontSize: '1.3rem' }}>{totalPending.toLocaleString()}</div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
              <div className="stat-title">Overdue Contracts</div>
              <div className="stat-value" style={{ color: '#ef4444' }}>{items.filter(i => isLate(i) && getRemainingQty(i) > 0).length}</div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.85rem' }}>Search Client / Bag</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or Bag#..." style={{ paddingLeft: '30px', width: '100%', padding: '8px 8px 8px 30px', border: '1px solid var(--border-color)', borderRadius: '4px' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.85rem' }}>Section</label>
                <input value={filterSection} onChange={e => setFilterSection(e.target.value)} placeholder="Filter by section..." style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.85rem' }}>Status</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.85rem' }}>Date In</label>
                <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }} />
              </div>
              <button className="btn btn-secondary" onClick={() => { setSearch(''); setFilterSection(''); setFilterStatus(''); setFilterDate(''); }}>Clear</button>
            </div>
          </div>

          {/* Inventory Table */}
          <div className="card">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f1f5f9' }}>
                    <th style={{ padding: '12px 10px', color: '#2563eb', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Client</th>
                    <th style={{ padding: '12px 10px', color: '#0284c7', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Bag / Item #</th>
                    <th style={{ padding: '12px 10px', color: '#7c3aed', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Section</th>
                    <th style={{ padding: '12px 10px', color: '#0f172a', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Date In</th>
                    <th style={{ padding: '12px 10px', color: '#d97706', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Days</th>
                    <th style={{ padding: '12px 10px', color: '#0f172a', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', textAlign: 'right' }}>Total Qty</th>
                    <th style={{ padding: '12px 10px', color: '#059669', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', textAlign: 'right' }}>Delivered</th>
                    <th style={{ padding: '12px 10px', color: '#3b82f6', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', textAlign: 'right' }}>Remaining</th>
                    <th style={{ padding: '12px 10px', color: '#0f172a', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', textAlign: 'right' }}>Expected</th>
                    <th style={{ padding: '12px 10px', color: '#10b981', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', textAlign: 'right' }}>Paid</th>
                    <th style={{ padding: '12px 10px', color: '#0f172a', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '12px 10px', color: '#0f172a', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => {
                    const remaining = getRemainingQty(item);
                    const delivered = getDeliveredQty(item);
                    const paid = getPaidAmount(item);
                    const days = getDaysStored(item);
                    const late = isLate(item) && remaining > 0;
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: late ? '#fff7ed' : 'transparent' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 600 }}>{item.warehouse_rental_clients?.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.warehouse_rental_clients?.contact_number}</div>
                        </td>
                        <td style={{ padding: '12px', fontWeight: 600 }}>{item.bag_number || '-'}</td>
                        <td style={{ padding: '12px' }}>{item.warehouse_section || '-'}</td>
                        <td style={{ padding: '12px' }}>{item.date_in}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ color: late ? '#ef4444' : 'inherit', fontWeight: late ? 700 : 400 }}>
                            {days}d {late ? '⚠️' : ''}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>{item.quantity}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#10b981' }}>{delivered}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: remaining > 0 ? '#3b82f6' : '#9ca3af' }}>{remaining}</td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>{parseFloat(item.expected_payment).toLocaleString()}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: paid >= item.expected_payment ? '#10b981' : '#f59e0b' }}>{paid.toLocaleString()}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600, backgroundColor: item.status === 'completed' ? '#d1fae5' : late ? '#fee2e2' : '#dbeafe', color: item.status === 'completed' ? '#065f46' : late ? '#991b1b' : '#1e40af' }}>
                            {item.status === 'completed' ? 'Completed' : late ? 'Overdue' : 'Active'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button onClick={() => handleDeleteItem(item)} disabled={loading} style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '4px', padding: '5px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#dc2626', fontSize: '0.8rem', fontWeight: 600 }} title="Delete Entry">
                            <Trash2 size={14} /> Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <tr><td colSpan="12" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No items found matching the filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB: ADD CLIENT & ITEM ===================== */}
      {activeTab === 'Add Client & Item' && (
        <form onSubmit={handleAddItem}>
          {/* Client Toggle */}
          <div className="card" style={{ marginBottom: '20px', borderTop: '4px solid #2563eb' }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <button type="button" className={`btn ${!useExistingClient ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setUseExistingClient(false)}>New Client</button>
              <button type="button" className={`btn ${useExistingClient ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setUseExistingClient(true)}>Existing Client</button>
            </div>

            {!useExistingClient ? (
              <>
                <h3 style={{ marginBottom: '16px', color: '#2563eb', fontWeight: 800, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>👤 1. Client Details</h3>
                <div className="form-grid">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af', marginBottom: '6px', display: 'block' }}>Client Name *</label>
                    <input type="text" value={clientForm.name} onChange={e => setClientForm(p => ({ ...p, name: e.target.value }))} required={!useExistingClient} placeholder="Enter client name" style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box' }} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af', marginBottom: '6px', display: 'block' }}>Contact Number</label>
                    <input type="text" value={clientForm.contact_number} onChange={e => setClientForm(p => ({ ...p, contact_number: e.target.value }))} placeholder="e.g. 0321-1234567" style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box' }} />
                  </div>
                  <div className="form-group full-width" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af', marginBottom: '6px', display: 'block' }}>Email</label>
                    <input type="email" value={clientForm.email} onChange={e => setClientForm(p => ({ ...p, email: e.target.value }))} placeholder="client@email.com" style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ marginBottom: '16px', color: '#2563eb', fontWeight: 800, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>👤 1. Select Existing Client</h3>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af', marginBottom: '6px', display: 'block' }}>Client *</label>
                  <select value={itemForm.client_id} onChange={e => setItemForm(p => ({ ...p, client_id: e.target.value }))} required={useExistingClient} style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box' }}>
                    <option value="">-- Select Client --</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.contact_number})</option>)}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Item Details */}
          <div className="card" style={{ marginBottom: '20px', borderTop: '4px solid #059669' }}>
            <h3 style={{ marginBottom: '16px', color: '#059669', fontWeight: 800, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>📦 2. Item Details</h3>
            <div className="form-grid">
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#065f46', marginBottom: '6px', display: 'block' }}>Bag / Item Number</label>
                <input type="text" value={itemForm.bag_number} onChange={e => setItemForm(p => ({ ...p, bag_number: e.target.value }))} placeholder="e.g. BAG-001" style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#065f46', marginBottom: '6px', display: 'block' }}>Quantity *</label>
                <input type="number" min="1" value={itemForm.quantity} onChange={e => setItemForm(p => ({ ...p, quantity: e.target.value }))} required placeholder="0" style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', fontWeight: 700, borderRadius: '8px', border: '1.5px solid #86efac', boxSizing: 'border-box' }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#065f46', marginBottom: '6px', display: 'block' }}>Weight per Item (KG)</label>
                <input type="number" step="0.01" min="0" value={itemForm.weight_per_item} onChange={e => setItemForm(p => ({ ...p, weight_per_item: e.target.value }))} placeholder="0.00" style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#065f46', marginBottom: '6px', display: 'block' }}>Total Weight (KG)</label>
                <input type="text" readOnly value={((parseFloat(itemForm.quantity) || 0) * (parseFloat(itemForm.weight_per_item) || 0)).toFixed(2)} style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', fontWeight: 700, borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: '#f1f5f9', cursor: 'not-allowed', boxSizing: 'border-box' }} />
              </div>
            </div>
          </div>

          {/* Storage Details */}
          <div className="card" style={{ marginBottom: '20px', borderTop: '4px solid #d97706' }}>
            <h3 style={{ marginBottom: '16px', color: '#b45309', fontWeight: 800, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>🏭 3. Storage Details</h3>
            <div className="form-grid">
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400e', marginBottom: '6px', display: 'block' }}>Date In *</label>
                <input type="date" value={itemForm.date_in} onChange={e => setItemForm(p => ({ ...p, date_in: e.target.value }))} required style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #fde68a', boxSizing: 'border-box' }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400e', marginBottom: '6px', display: 'block' }}>Rent Period (Days)</label>
                <input type="number" min="1" value={itemForm.rent_period_days} onChange={e => setItemForm(p => ({ ...p, rent_period_days: e.target.value }))} placeholder="30" style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #fde68a', boxSizing: 'border-box' }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400e', marginBottom: '6px', display: 'block' }}>Expected Payment (Rs.)</label>
                <input type="number" step="0.01" min="0" value={itemForm.expected_payment} onChange={e => setItemForm(p => ({ ...p, expected_payment: e.target.value }))} placeholder="0.00" style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #fde68a', boxSizing: 'border-box' }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400e', marginBottom: '6px', display: 'block' }}>Warehouse Section / Location</label>
                <input type="text" value={itemForm.warehouse_section} onChange={e => setItemForm(p => ({ ...p, warehouse_section: e.target.value }))} placeholder="e.g. A-2, Block B" style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #fde68a', boxSizing: 'border-box' }} />
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div className="card" style={{ marginBottom: '20px', borderTop: '4px solid #64748b' }}>
            <h3 style={{ marginBottom: '16px', color: '#475569', fontWeight: 800, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>📝 5. Additional Notes / Remarks</h3>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '6px', display: 'block' }}>Damage, Lost Items, Special Conditions</label>
              <textarea rows={3} value={itemForm.remarks} onChange={e => setItemForm(p => ({ ...p, remarks: e.target.value }))} style={{ width: '100%', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '13px 32px', fontSize: '1rem', fontWeight: 800, width: '100%', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {loading ? 'Saving...' : '💾 Save Client & Item'}
          </button>
        </form>
      )}

      {/* ===================== TAB: DELIVERIES ===================== */}
      {activeTab === 'Deliveries' && (
        <div>
          {/* Delivery Form */}
          <div className="card" style={{ marginBottom: '24px', borderTop: '4px solid #2563eb' }}>
            <h3 style={{ marginBottom: '16px', color: '#2563eb', fontWeight: 800, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>📤 4. Record Pickup / Delivery</h3>
            <form onSubmit={handleDelivery}>
              <div className="form-grid">
                <div className="form-group full-width" style={{ margin: 0, marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af', marginBottom: '6px', display: 'block' }}>Select Item / Bag *</label>
                  <select value={deliveryForm.item_id} onChange={e => setDeliveryForm(p => ({ ...p, item_id: e.target.value }))} required style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #93c5fd', boxSizing: 'border-box' }}>
                    <option value="">-- Select Active Item --</option>
                    {items.filter(i => getRemainingQty(i) > 0).map(i => (
                      <option key={i.id} value={i.id}>
                        {i.warehouse_rental_clients?.name} — {i.bag_number || 'No Bag#'} (Rem: {getRemainingQty(i)}) [{i.warehouse_section}]
                      </option>
                    ))}
                  </select>
                </div>
                {deliveryForm.item_id && (
                  <div className="form-group full-width" style={{ margin: 0, marginBottom: '14px' }}>
                    <div style={{ padding: '10px 16px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '0.9rem' }}>
                      {(() => {
                        const sel = items.find(i => i.id === deliveryForm.item_id);
                        if (!sel) return null;
                        return (<>
                          <span><strong>Total:</strong> {sel.quantity}</span>
                          <span><strong>Delivered:</strong> {getDeliveredQty(sel)}</span>
                          <span style={{ color: '#1d4ed8', fontWeight: 700 }}><strong>Remaining:</strong> {getRemainingQty(sel)}</span>
                          <span><strong>Expected Pay:</strong> {parseFloat(sel.expected_payment).toLocaleString()}</span>
                          <span style={{ color: '#10b981', fontWeight: 700 }}><strong>Paid So Far:</strong> {getPaidAmount(sel).toLocaleString()}</span>
                          {isLate(sel) && <span style={{ color: '#ef4444', fontWeight: 700 }}>⚠️ OVERDUE by {getDaysStored(sel) - sel.rent_period_days} days</span>}
                        </>);
                      })()}
                    </div>
                  </div>
                )}
                <div className="form-group" style={{ margin: 0, marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af', marginBottom: '6px', display: 'block' }}>Date Out *</label>
                  <input type="date" value={deliveryForm.date_out} onChange={e => setDeliveryForm(p => ({ ...p, date_out: e.target.value }))} required style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #93c5fd', boxSizing: 'border-box' }} />
                </div>
                <div className="form-group" style={{ margin: 0, marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af', marginBottom: '6px', display: 'block' }}>Delivered Quantity *</label>
                  <input type="number" min="1" value={deliveryForm.delivered_quantity} onChange={e => setDeliveryForm(p => ({ ...p, delivered_quantity: e.target.value }))} required placeholder="0" style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', fontWeight: 700, borderRadius: '8px', border: '1.5px solid #93c5fd', boxSizing: 'border-box' }} />
                </div>
                <div className="form-group" style={{ margin: 0, marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#059669', marginBottom: '6px', display: 'block' }}>Payment Received (Rs.)</label>
                  <input type="number" step="0.01" min="0" value={deliveryForm.payment_received} onChange={e => setDeliveryForm(p => ({ ...p, payment_received: e.target.value }))} placeholder="0.00" style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #86efac', boxSizing: 'border-box' }} />
                </div>
                <div className="form-group" style={{ margin: 0, marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#dc2626', marginBottom: '6px', display: 'block' }}>Late Charges (Rs.)</label>
                  <input type="number" step="0.01" min="0" value={deliveryForm.late_charges} onChange={e => setDeliveryForm(p => ({ ...p, late_charges: e.target.value }))} placeholder="0.00" style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #fca5a5', boxSizing: 'border-box' }} />
                </div>
                <div className="form-group full-width" style={{ margin: 0, marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '6px', display: 'block' }}>Delivery Notes</label>
                  <input type="text" value={deliveryForm.notes} onChange={e => setDeliveryForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any delivery remarks..." style={{ width: '100%', height: '44px', padding: '10px 14px', fontSize: '1rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '12px', width: '100%', padding: '13px', fontSize: '1rem', fontWeight: 800, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {loading ? 'Processing...' : '✅ Confirm Delivery / Pickup'}
              </button>
            </form>
          </div>

          {/* Delivery History */}
          <div className="card">
            <h3 style={{ marginBottom: '16px', color: '#7c3aed', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>📋 Delivery History</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f1f5f9' }}>
                    <th style={{ padding: '12px 10px', color: '#2563eb', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Client</th>
                    <th style={{ padding: '12px 10px', color: '#0284c7', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Bag #</th>
                    <th style={{ padding: '12px 10px', color: '#0f172a', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Date Out</th>
                    <th style={{ padding: '12px 10px', color: '#059669', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', textAlign: 'right' }}>Delivered Qty</th>
                    <th style={{ padding: '12px 10px', color: '#10b981', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', textAlign: 'right' }}>Payment Received</th>
                    <th style={{ padding: '12px 10px', color: '#dc2626', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', textAlign: 'right' }}>Late Charges</th>
                    <th style={{ padding: '12px 10px', color: '#475569', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map(d => (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{d.warehouse_rental_items?.warehouse_rental_clients?.name || '-'}</td>
                      <td style={{ padding: '12px' }}>{d.warehouse_rental_items?.bag_number || '-'}</td>
                      <td style={{ padding: '12px' }}>{d.date_out}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#10b981', fontWeight: 700 }}>{d.delivered_quantity}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{parseFloat(d.payment_received || 0).toLocaleString()}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: parseFloat(d.late_charges) > 0 ? '#ef4444' : 'inherit' }}>{parseFloat(d.late_charges || 0).toLocaleString()}</td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{d.notes || '-'}</td>
                    </tr>
                  ))}
                  {deliveries.length === 0 && <tr><td colSpan="7" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No deliveries recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB: REPORTS ===================== */}
      {activeTab === 'Reports' && (
        <div>
          {/* Filter by month */}
          <div className="card" style={{ marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <strong>Filter by Month:</strong>
            <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
            {reportMonth && <button className="btn btn-secondary" onClick={() => setReportMonth('')}>Clear</button>}
          </div>

          {/* Revenue Summary */}
          <div className="stats-grid" style={{ marginBottom: '24px' }}>
            <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
              <div className="stat-title">Total Expected Revenue</div>
              <div className="stat-value" style={{ color: '#10b981', fontSize: '1.3rem' }}>{totalExpected.toLocaleString()}</div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div className="stat-title">Total Collected</div>
              <div className="stat-value" style={{ color: '#3b82f6', fontSize: '1.3rem' }}>{totalReceived.toLocaleString()}</div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div className="stat-title">Outstanding / Pending</div>
              <div className="stat-value" style={{ color: '#f59e0b', fontSize: '1.3rem' }}>{totalPending.toLocaleString()}</div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
              <div className="stat-title">Total Late Charges</div>
              <div className="stat-value" style={{ color: '#ef4444', fontSize: '1.3rem' }}>
                {deliveries.reduce((s, d) => s + parseFloat(d.late_charges || 0), 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Section Breakdown */}
          <div className="card" style={{ marginBottom: '24px', borderTop: '4px solid #7c3aed' }}>
            <h3 style={{ marginBottom: '16px', color: '#7c3aed', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>🏭 Warehouse Section Status</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f5f3ff' }}>
                  <th style={{ padding: '12px 10px', color: '#7c3aed', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Section</th>
                  <th style={{ padding: '12px 10px', color: '#2563eb', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', textAlign: 'right' }}>Items in Storage</th>
                  <th style={{ padding: '12px 10px', color: '#0284c7', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', textAlign: 'right' }}>Qty Remaining</th>
                  <th style={{ padding: '12px 10px', color: '#059669', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', textAlign: 'right' }}>Active Clients</th>
                </tr>
              </thead>
              <tbody>
                {uniqueSections.length > 0 ? uniqueSections.map(section => {
                  const sectionItems = items.filter(i => i.warehouse_section === section);
                  const sectionRemaining = sectionItems.reduce((s, i) => s + getRemainingQty(i), 0);
                  const activeClients = new Set(sectionItems.filter(i => getRemainingQty(i) > 0).map(i => i.client_id)).size;
                  return (
                    <tr key={section} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{section}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{sectionItems.length}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#3b82f6', fontWeight: 700 }}>{sectionRemaining}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{activeClients}</td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan="4" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No sections defined. Add Warehouse Section when creating items.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Delivered vs Remaining Summary */}
          <div className="card" style={{ borderTop: '4px solid #059669' }}>
            <h3 style={{ marginBottom: '16px', color: '#059669', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>📊 Delivered vs Remaining — Per Client</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f0fdf4' }}>
                  <th style={{ padding: '12px 10px', color: '#059669', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Client</th>
                  <th style={{ padding: '12px 10px', color: '#475569', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Contact</th>
                  <th style={{ padding: '12px 10px', color: '#0f172a', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', textAlign: 'right' }}>Total Stored</th>
                  <th style={{ padding: '12px 10px', color: '#10b981', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', textAlign: 'right' }}>Delivered</th>
                  <th style={{ padding: '12px 10px', color: '#3b82f6', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', textAlign: 'right' }}>Remaining</th>
                  <th style={{ padding: '12px 10px', color: '#d97706', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', textAlign: 'right' }}>Payment Status</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(client => {
                  const clientItems = items.filter(i => i.client_id === client.id);
                  if (clientItems.length === 0) return null;
                  const totalStored = clientItems.reduce((s, i) => s + i.quantity, 0);
                  const totalDelivered = clientItems.reduce((s, i) => s + getDeliveredQty(i), 0);
                  const totalRemaining = clientItems.reduce((s, i) => s + getRemainingQty(i), 0);
                  const expectedTotal = clientItems.reduce((s, i) => s + parseFloat(i.expected_payment || 0), 0);
                  const paidTotal = clientItems.reduce((s, i) => s + getPaidAmount(i), 0);
                  const balance = expectedTotal - paidTotal;
                  return (
                    <tr key={client.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{client.name}</td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{client.contact_number}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{totalStored}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#10b981' }}>{totalDelivered}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#3b82f6', fontWeight: 700 }}>{totalRemaining}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <span style={{ color: balance <= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                          {balance <= 0 ? 'Paid' : `Due: ${balance.toLocaleString()}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
