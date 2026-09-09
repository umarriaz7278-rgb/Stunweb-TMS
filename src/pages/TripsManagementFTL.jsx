import { useState, useEffect } from 'react';
import { Truck, Plus, Trash2, X, Eye, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'ftl_trips';
const BROKERS_KEY = 'ftl_brokers';

function loadTrips() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveTrips(trips) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

function loadBrokers() {
  try {
    const data = localStorage.getItem(BROKERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  biltyNumber: '',
  vehicleNumber: '',
  from: 'Karachi',
  to: '',
  totalBiltyFare: '',
  vehicleFare: '',
  expenses: [],
  brokerName: '',
};

export default function TripsManagementFTL() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState(loadTrips);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [viewTrip, setViewTrip] = useState(null);
  const [filterMonth, setFilterMonth] = useState('');
  const [brokers, setBrokers] = useState(loadBrokers);
  const [showOldTripSelect, setShowOldTripSelect] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);
  const [editExpenses, setEditExpenses] = useState([]);
  const [brokerConfirm, setBrokerConfirm] = useState(null); // { trip, onConfirm }
  const [editingVehicleFare, setEditingVehicleFare] = useState(null); // { id, value }

  // Refresh brokers when form opens
  useEffect(() => {
    if (showForm) setBrokers(loadBrokers());
  }, [showForm]);

  useEffect(() => {
    saveTrips(trips);
  }, [trips]);

  const resetForm = () => {
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10), expenses: [] });
    setShowForm(false);
  };

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const addExpense = () => {
    setForm(prev => ({ ...prev, expenses: [...prev.expenses, { label: '', amount: '' }] }));
  };

  const updateExpense = (index, field, value) => {
    setForm(prev => {
      const expenses = [...prev.expenses];
      expenses[index] = { ...expenses[index], [field]: value };
      return { ...prev, expenses };
    });
  };

  const removeExpense = (index) => {
    setForm(prev => ({ ...prev, expenses: prev.expenses.filter((_, i) => i !== index) }));
  };

  const totalExpenses = form.expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const grossProfit = (parseFloat(form.totalBiltyFare) || 0) - (parseFloat(form.vehicleFare) || 0);
  const netProfit = grossProfit - totalExpenses;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trip = {
      id: Date.now().toString(),
      ...form,
      totalBiltyFare: parseFloat(form.totalBiltyFare) || 0,
      vehicleFare: parseFloat(form.vehicleFare) || 0,
      expenses: form.expenses.map(ex => ({ label: ex.label, amount: parseFloat(ex.amount) || 0 })),
      grossProfit,
      netProfit,
      totalExpenses,
      vehicleNumber: form.vehicleNumber,
      createdAt: new Date().toISOString(),
    };
    if (form.brokerName) {
      setBrokerConfirm({
        brokerName: form.brokerName,
        vehicleNumber: form.vehicleNumber || '—',
        netProfit,
        onConfirm: () => { setTrips(prev => [trip, ...prev]); resetForm(); setBrokerConfirm(null); },
        onCancel: () => setBrokerConfirm(null),
      });
    } else {
      setTrips(prev => [trip, ...prev]);
      resetForm();
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this trip?')) {
      setTrips(prev => prev.filter(t => t.id !== id));
    }
  };

  const handleSelectOldTrip = (trip) => {
    setEditingTrip(trip);
    setEditExpenses(trip.expenses ? trip.expenses.map(e => ({ label: e.label, amount: e.amount })) : []);
    setShowOldTripSelect(false);
  };

  const addEditExpense = () => {
    setEditExpenses(prev => [...prev, { label: '', amount: '' }]);
  };

  const updateEditExpense = (index, field, value) => {
    setEditExpenses(prev => {
      const expenses = [...prev];
      expenses[index] = { ...expenses[index], [field]: value };
      return expenses;
    });
  };

  const removeEditExpense = (index) => {
    setEditExpenses(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveOldTrip = () => {
    const newExpenses = editExpenses.map(ex => ({ label: ex.label, amount: parseFloat(ex.amount) || 0 }));
    const totalExp = newExpenses.reduce((sum, e) => sum + e.amount, 0);
    const grossP = (parseFloat(editingTrip.totalBiltyFare) || 0) - (parseFloat(editingTrip.vehicleFare) || 0);
    const netP = grossP - totalExp;
    const doSave = () => {
      setTrips(prev => prev.map(t =>
        t.id === editingTrip.id
          ? { ...t, expenses: newExpenses, totalExpenses: totalExp, grossProfit: grossP, netProfit: netP }
          : t
      ));
      setEditingTrip(null);
      setEditExpenses([]);
      setBrokerConfirm(null);
    };
    if (editingTrip.brokerName) {
      setBrokerConfirm({
        brokerName: editingTrip.brokerName,
        vehicleNumber: editingTrip.vehicleNumber || '—',
        netProfit: netP,
        onConfirm: doSave,
        onCancel: () => setBrokerConfirm(null),
      });
    } else {
      doSave();
    }
  };

  const handleVehicleFareSave = (tripId) => {
    const newFare = parseFloat(editingVehicleFare?.value) || 0;
    setTrips(prev => prev.map(t => {
      if (t.id !== tripId) return t;
      const grossP = (parseFloat(t.totalBiltyFare) || 0) - newFare;
      const totalExp = (t.totalExpenses) || 0;
      const netP = grossP - totalExp;
      return { ...t, vehicleFare: newFare, grossProfit: grossP, netProfit: netP };
    }));
    setEditingVehicleFare(null);
  };

  const filteredTrips = filterMonth
    ? trips.filter(t => t.date && t.date.startsWith(filterMonth))
    : trips;

  const formatCurrency = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return 'Rs. 0';
    return 'Rs. ' + num.toLocaleString('en-PK');
  };

  // Detail View
  if (viewTrip) {
    const t = viewTrip;
    const tripExpenses = t.expenses || [];
    const tripTotalExp = tripExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <Truck size={28} color="var(--primary-color)" />
          <h1 className="page-title" style={{ marginBottom: 0 }}>Trip Details</h1>
          <button className="btn btn-secondary" onClick={() => setViewTrip(null)} style={{ marginLeft: 'auto', fontSize: '0.85rem', padding: '6px 16px' }}>
            <ArrowLeft size={16} style={{ marginRight: 4 }} /> Back to Trips
          </button>
        </div>
        <div className="card" style={{ padding: '28px', maxWidth: '700px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 32px', marginBottom: '20px' }}>
            <div><strong>Date:</strong> {t.date}</div>
            <div><strong>Bilty Number:</strong> {t.biltyNumber}</div>
            <div><strong>Vehicle Number:</strong> {t.vehicleNumber || '—'}</div>
            <div><strong>From:</strong> {t.from}</div>
            <div><strong>To (Destination):</strong> {t.to}</div>
            <div><strong>Total Bilty Fare:</strong> {formatCurrency(t.totalBiltyFare)}</div>
            <div><strong>Vehicle Fare:</strong> {formatCurrency(t.vehicleFare)}</div>
            <div><strong>Gross Profit:</strong> <span style={{ color: t.grossProfit >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{formatCurrency(t.grossProfit)}</span></div>
            <div><strong>Broker Name:</strong> {t.brokerName || '—'}</div>
          </div>
          {tripExpenses.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <strong>Expenses:</strong>
              <table style={{ width: '100%', marginTop: '8px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.85rem' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.85rem' }}>Description</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: '0.85rem' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {tripExpenses.map((ex, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 8px', fontSize: '0.85rem' }}>{i + 1}</td>
                      <td style={{ padding: '6px 8px', fontSize: '0.85rem' }}>{ex.label || '—'}</td>
                      <td style={{ textAlign: 'right', padding: '6px 8px', fontSize: '0.85rem' }}>{formatCurrency(ex.amount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} style={{ padding: '6px 8px', fontWeight: 700, fontSize: '0.85rem' }}>Total Expenses</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, fontSize: '0.85rem', color: '#dc2626' }}>{formatCurrency(tripTotalExp)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <div style={{ padding: '12px 16px', background: 'var(--primary-light, #f0f4ff)', borderRadius: '8px', marginTop: '8px' }}>
            <strong>Net Profit:</strong>{' '}
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: t.netProfit >= 0 ? '#16a34a' : '#dc2626' }}>
              {formatCurrency(t.netProfit)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Truck size={28} color="var(--primary-color)" />
        <h1 className="page-title" style={{ marginBottom: 0 }}>Trips Management</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/container-transport-ftl')} style={{ marginLeft: 'auto', fontSize: '0.85rem', padding: '6px 16px' }}>← Back</button>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>All Trips</h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="month"
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
              title="Filter by month"
            />
            {filterMonth && (
              <button className="btn btn-secondary" onClick={() => setFilterMonth('')} style={{ fontSize: '0.8rem', padding: '4px 10px' }}>Clear</button>
            )}
            <button
              className="btn btn-primary"
              onClick={() => { resetForm(); setShowForm(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={18} /> Add Trip
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowOldTripSelect(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Truck size={18} /> Old Trip
            </button>
          </div>
        </div>

        {/* Trips Table */}
        {filteredTrips.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>No trips found. Click "Add Trip" to get started.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Date', 'Bilty #', 'Vehicle #', 'Route', 'Bilty Fare', 'Vehicle Fare', 'Gross Profit', 'Expenses', 'Net Profit', 'Broker', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTrips.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 8px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{t.date}</td>
                    <td style={{ padding: '10px 8px', fontSize: '0.85rem' }}>{t.biltyNumber}</td>
                    <td style={{ padding: '10px 8px', fontSize: '0.85rem' }}>{t.vehicleNumber || '—'}</td>
                    <td style={{ padding: '10px 8px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{t.from} → {t.to}</td>
                    <td style={{ padding: '10px 8px', fontSize: '0.85rem' }}>{formatCurrency(t.totalBiltyFare)}</td>
                    <td style={{ padding: '10px 8px', fontSize: '0.85rem' }}>
                      {editingVehicleFare?.id === t.id ? (
                        <input
                          type="number"
                          autoFocus
                          value={editingVehicleFare.value}
                          min="0"
                          onChange={e => setEditingVehicleFare(prev => ({ ...prev, value: e.target.value }))}
                          onBlur={() => handleVehicleFareSave(t.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleVehicleFareSave(t.id);
                            if (e.key === 'Escape') setEditingVehicleFare(null);
                          }}
                          style={{ width: '100px', padding: '3px 6px', fontSize: '0.85rem', borderRadius: '5px', border: '1px solid var(--primary-color)' }}
                        />
                      ) : (
                        <span
                          title="Click to edit Vehicle Fare"
                          onClick={() => setEditingVehicleFare({ id: t.id, value: t.vehicleFare ?? 0 })}
                          style={{ cursor: 'pointer', borderBottom: '1px dashed #6366f1', paddingBottom: '1px' }}
                        >
                          {formatCurrency(t.vehicleFare)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 8px', fontSize: '0.85rem', color: t.grossProfit >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{formatCurrency(t.grossProfit)}</td>
                    <td style={{ padding: '10px 8px', fontSize: '0.85rem', color: '#dc2626' }}>{formatCurrency(t.totalExpenses)}</td>
                    <td style={{ padding: '10px 8px', fontSize: '0.85rem', fontWeight: 700, color: t.netProfit >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(t.netProfit)}</td>
                    <td style={{ padding: '10px 8px', fontSize: '0.85rem' }}>{t.brokerName || '—'}</td>
                    <td style={{ padding: '10px 8px', display: 'flex', gap: '6px' }}>
                      <button className="btn-icon" title="View Details" onClick={() => setViewTrip(t)} style={{ color: '#6366f1' }}><Eye size={18} /></button>
                      <button className="btn-icon" title="Delete" onClick={() => handleDelete(t.id)} style={{ color: '#dc2626' }}><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Trip Modal */}
      {showForm && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
          padding: '20px',
        }}>
          <div className="card" style={{ width: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', animation: 'fadeIn 0.3s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Add New Trip</h3>
              <button className="btn-icon" onClick={resetForm}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Date */}
              <div className="form-group">
                <label>Date</label>
                <input type="date" name="date" value={form.date} onChange={handleChange} required />
              </div>

              {/* Bilty Number */}
              <div className="form-group">
                <label>Bilty Number</label>
                <input type="text" name="biltyNumber" value={form.biltyNumber} onChange={handleChange} placeholder="Enter bilty number" required />
              </div>

              {/* Vehicle Number */}
              <div className="form-group">
                <label>Vehicle Number</label>
                <input type="text" name="vehicleNumber" value={form.vehicleNumber} onChange={handleChange} placeholder="e.g. ABC-1234" />
              </div>

              {/* Route */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>From</label>
                  <input type="text" name="from" value={form.from} onChange={handleChange} placeholder="Karachi" required />
                </div>
                <div className="form-group">
                  <label>To (Destination)</label>
                  <input type="text" name="to" value={form.to} onChange={handleChange} placeholder="e.g. Lahore" required />
                </div>
              </div>

              {/* Fares */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Total Bilty Fare (Rs.)</label>
                  <input type="number" name="totalBiltyFare" value={form.totalBiltyFare} onChange={handleChange} placeholder="0" min="0" required />
                </div>
                <div className="form-group">
                  <label>Vehicle Fare (Rs.)</label>
                  <input type="number" name="vehicleFare" value={form.vehicleFare} onChange={handleChange} placeholder="0" min="0" required />
                </div>
              </div>

              {/* Gross Profit */}
              <div style={{ padding: '10px 14px', background: grossProfit >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Gross Profit</span>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: grossProfit >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(grossProfit)}</span>
              </div>

              {/* Expenses */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Expenses</label>
                  <button type="button" className="btn btn-secondary" onClick={addExpense} style={{ fontSize: '0.8rem', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Plus size={14} /> Add Expense
                  </button>
                </div>
                {form.expenses.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '4px 0' }}>No expenses added yet.</p>
                )}
                {form.expenses.map((ex, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Description"
                      value={ex.label}
                      onChange={e => updateExpense(i, 'label', e.target.value)}
                      style={{ flex: 2 }}
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      value={ex.amount}
                      onChange={e => updateExpense(i, 'amount', e.target.value)}
                      min="0"
                      style={{ flex: 1 }}
                    />
                    <button type="button" className="btn-icon" onClick={() => removeExpense(i)} style={{ color: '#dc2626' }}><Trash2 size={16} /></button>
                  </div>
                ))}
                {form.expenses.length > 0 && (
                  <div style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 600, color: '#dc2626' }}>
                    Total Expenses: {formatCurrency(totalExpenses)}
                  </div>
                )}
              </div>

              {/* Net Profit */}
              <div style={{ padding: '10px 14px', background: netProfit >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Net Profit</span>
                <span style={{ fontWeight: 800, fontSize: '1.05rem', color: netProfit >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(netProfit)}</span>
              </div>

              {/* Broker Name */}
              <div className="form-group">
                <label>Broker Name</label>
                <select name="brokerName" value={form.brokerName} onChange={handleChange} required style={{ width: '100%' }}>
                  <option value="">— Select Broker —</option>
                  {brokers.map(b => (
                    <option key={b.id} value={b.fullName}>{b.fullName}</option>
                  ))}
                </select>
                {brokers.length === 0 && (
                  <p style={{ color: '#dc2626', fontSize: '0.78rem', margin: '4px 0 0' }}>No brokers found. Please add brokers in Broker Management first.</p>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Trip</button>
                <button type="button" className="btn btn-secondary" onClick={resetForm} style={{ flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Old Trip Selection Modal */}
      {showOldTripSelect && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
          padding: '20px',
        }}>
          <div className="card" style={{ width: '620px', maxHeight: '85vh', overflowY: 'auto', padding: '28px', animation: 'fadeIn 0.3s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Old Trip — Vehicle Number Select Karein</h3>
              <button className="btn-icon" onClick={() => setShowOldTripSelect(false)}><X size={20} /></button>
            </div>
            {trips.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>Koi trip saved nahi hai.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['Date', 'Bilty #', 'Vehicle #', 'Route', 'Broker', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: '0.8rem', fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trips.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light, #f0f4ff)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <td style={{ padding: '9px 10px', fontSize: '0.85rem' }}>{t.date}</td>
                      <td style={{ padding: '9px 10px', fontSize: '0.85rem' }}>{t.biltyNumber}</td>
                      <td style={{ padding: '9px 10px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-color)' }}>{t.vehicleNumber || '—'}</td>
                      <td style={{ padding: '9px 10px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{t.from} → {t.to}</td>
                      <td style={{ padding: '9px 10px', fontSize: '0.85rem' }}>{t.brokerName || '—'}</td>
                      <td style={{ padding: '9px 10px' }}>
                        <button className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '4px 12px' }} onClick={() => handleSelectOldTrip(t)}>
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Old Trip — Add/Edit Expenses Modal */}
      {editingTrip && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
          padding: '20px',
        }}>
          <div className="card" style={{ width: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', animation: 'fadeIn 0.3s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Expenses Add/Edit — Old Trip</h3>
              <button className="btn-icon" onClick={() => { setEditingTrip(null); setEditExpenses([]); }}><X size={20} /></button>
            </div>

            {/* Trip Info Summary */}
            <div style={{ background: 'var(--primary-light, #f0f4ff)', borderRadius: '8px', padding: '12px 16px', marginBottom: '18px', fontSize: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div><strong>Date:</strong> {editingTrip.date}</div>
                <div><strong>Bilty #:</strong> {editingTrip.biltyNumber}</div>
                <div><strong>Vehicle #:</strong> <span style={{ color: 'var(--primary-color)', fontWeight: 700 }}>{editingTrip.vehicleNumber || '—'}</span></div>
                <div><strong>Route:</strong> {editingTrip.from} → {editingTrip.to}</div>
                <div><strong>Bilty Fare:</strong> {formatCurrency(editingTrip.totalBiltyFare)}</div>
                <div><strong>Vehicle Fare:</strong> {formatCurrency(editingTrip.vehicleFare)}</div>
              </div>
            </div>

            {/* Expenses */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Expenses</label>
                <button type="button" className="btn btn-secondary" onClick={addEditExpense} style={{ fontSize: '0.8rem', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Plus size={14} /> Add Expense
                </button>
              </div>
              {editExpenses.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '4px 0 12px' }}>Koi expense nahi. "Add Expense" click karein.</p>
              )}
              {editExpenses.map((ex, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Description"
                    value={ex.label}
                    onChange={e => updateEditExpense(i, 'label', e.target.value)}
                    style={{ flex: 2 }}
                  />
                  <input
                    type="number"
                    placeholder="Amount"
                    value={ex.amount}
                    onChange={e => updateEditExpense(i, 'amount', e.target.value)}
                    min="0"
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn-icon" onClick={() => removeEditExpense(i)} style={{ color: '#dc2626' }}><Trash2 size={16} /></button>
                </div>
              ))}
              {editExpenses.length > 0 && (
                <div style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 600, color: '#dc2626', marginBottom: '8px' }}>
                  Total Expenses: {formatCurrency(editExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0))}
                </div>
              )}
            </div>

            {/* Net Profit Preview */}
            <div style={{ padding: '10px 14px', background: (() => { const g = (parseFloat(editingTrip.totalBiltyFare)||0)-(parseFloat(editingTrip.vehicleFare)||0); const n = g - editExpenses.reduce((s,e)=>s+(parseFloat(e.amount)||0),0); return n >= 0 ? '#f0fdf4' : '#fef2f2'; })(), borderRadius: '8px', display: 'flex', justifyContent: 'space-between', marginBottom: '18px' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Net Profit (Preview)</span>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: (() => { const g = (parseFloat(editingTrip.totalBiltyFare)||0)-(parseFloat(editingTrip.vehicleFare)||0); const n = g - editExpenses.reduce((s,e)=>s+(parseFloat(e.amount)||0),0); return n >= 0 ? '#16a34a' : '#dc2626'; })() }}>
                {formatCurrency((() => { const g = (parseFloat(editingTrip.totalBiltyFare)||0)-(parseFloat(editingTrip.vehicleFare)||0); return g - editExpenses.reduce((s,e)=>s+(parseFloat(e.amount)||0),0); })())}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveOldTrip}>Proceed & Save</button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setEditingTrip(null); setEditExpenses([]); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* Broker Account Confirmation Modal */}
      {brokerConfirm && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
          padding: '20px',
        }}>
          <div className="card" style={{ width: '460px', padding: '32px', animation: 'fadeIn 0.2s', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📋</div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.15rem', fontWeight: 700 }}>Broker Account Update</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 0 20px' }}>
              Yeh trip ka data <strong style={{ color: 'var(--primary-color)' }}>{brokerConfirm.brokerName}</strong> ke broker account mein add hoga:
            </p>
            <div style={{ background: 'var(--primary-light, #f0f4ff)', borderRadius: '10px', padding: '16px 20px', marginBottom: '24px', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Broker Name</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{brokerConfirm.brokerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Vehicle Number</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary-color)' }}>{brokerConfirm.vehicleNumber}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Net Profit (Broker Account)</span>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: brokerConfirm.netProfit >= 0 ? '#16a34a' : '#dc2626' }}>
                  {formatCurrency(brokerConfirm.netProfit)}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={brokerConfirm.onConfirm}>
                ✓ Confirm & Save
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={brokerConfirm.onCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
