import React, { useState, useEffect, useMemo } from 'react';
import { 
  Truck, Plus, Search, Filter, DollarSign, 
  TrendingUp, Activity, Package, History, User, MapPin, 
  ChevronRight, Calendar, AlertCircle, CheckCircle2,
  Trash2, Edit, Save, X, ExternalLink, ArrowRight
} from 'lucide-react';

const VehicleManagement = () => {
  // --- State Management ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [vehicles, setVehicles] = useState(() => JSON.parse(localStorage.getItem('vm_vehicles') || '[]'));
  const [trips, setTrips] = useState(() => JSON.parse(localStorage.getItem('vm_trips') || '[]'));
  const [suppliers, setSuppliers] = useState(() => {
    const saved = localStorage.getItem('vm_suppliers');
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Awan Logistics', description: 'Main fleet provider', address: 'Karachi, Port Qasim', balance: 0, payments: [] },
      { id: 2, name: 'Bilal Goods', description: 'Container specialist', address: 'Lahore, Goods Naka', balance: 0, payments: [] },
      { id: 3, name: 'Sindh Carriers', description: 'Local transport', address: 'Hyderabad', balance: 0, payments: [] },
    ];
  });

  // Notifications
  const [notif, setNotif] = useState(null);
  const showNotif = (msg, type = 'success') => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 3000);
  };

  // --- Persistence ---
  useEffect(() => localStorage.setItem('vm_vehicles', JSON.stringify(vehicles)), [vehicles]);
  useEffect(() => localStorage.setItem('vm_trips', JSON.stringify(trips)), [trips]);
  useEffect(() => localStorage.setItem('vm_suppliers', JSON.stringify(suppliers)), [suppliers]);

  // --- Core Calculations ---
  const calculateSupplierBalance = (supplierId) => {
    const sId = parseInt(supplierId);
    const supplierTrips = trips.filter(t => {
      const v = vehicles.find(veh => parseInt(veh.id) === parseInt(t.vehicleId));
      return v && parseInt(v.supplierId) === sId;
    });

    let balance = 0;
    
    // Add expenses marked as 'Supplier Credit'
    supplierTrips.forEach(trip => {
      const creditExpenses = (trip.expenses || []).filter(e => e.paymentType === 'Supplier Credit');
      creditExpenses.forEach(e => balance += parseFloat(e.amount || 0));
    });

    // Subtract payments made to supplier
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier && supplier.payments) {
      supplier.payments.forEach(p => balance -= parseFloat(p.amount || 0));
    }

    return balance;
  };

  // --- Vehicle Actions ---
  const [newVehicle, setNewVehicle] = useState({ number: '', supplierId: '', type: '' });
  const addVehicle = (e) => {
    e.preventDefault();
    if (!newVehicle.number || !newVehicle.supplierId) return showNotif('Please fill all required fields', 'error');
    const vehicle = { ...newVehicle, id: Date.now() };
    setVehicles([...vehicles, vehicle]);
    setNewVehicle({ number: '', supplierId: '', type: '' });
    showNotif('Vehicle added successfully');
  };

  const deleteVehicle = (id) => {
    if (window.confirm('Delete this vehicle and its trip history?')) {
      setVehicles(vehicles.filter(v => v.id !== id));
      setTrips(trips.filter(t => t.vehicleId !== id));
      showNotif('Vehicle deleted');
    }
  };

  // --- Trip Actions ---
  const [activeTripVehicle, setActiveTripVehicle] = useState(null);
  const [newTrip, setNewTrip] = useState({ 
    from: 'Karachi', to: 'Lahore', oneWayFare: 0, returnFare: 0, 
    startDate: new Date().toISOString().split('T')[0], endDate: '' 
  });

  const startTrip = (vehicleId) => {
    const trip = {
      ...newTrip,
      id: Date.now(),
      vehicleId,
      status: 'active',
      expenses: [],
      totalFare: parseFloat(newTrip.oneWayFare) + parseFloat(newTrip.returnFare)
    };
    setTrips([...trips, trip]);
    setActiveTripVehicle(null);
    showNotif('Trip started');
  };

  const closeTrip = (tripId) => {
    setTrips(trips.map(t => t.id === tripId ? { ...t, status: 'closed', endDate: new Date().toISOString().split('T')[0] } : t));
    showNotif('Trip closed');
  };

  // --- Expense Actions ---
  const [expenseForm, setExpenseForm] = useState({ description: 'Fuel', amount: '', paymentType: 'Driver Cash', date: new Date().toISOString().split('T')[0] });
  const addExpense = (tripId) => {
    if (!expenseForm.amount || isNaN(parseFloat(expenseForm.amount))) return showNotif('Please enter a valid amount', 'error');
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;

    const newExpenses = [...(trip.expenses || []), { ...expenseForm, amount: parseFloat(expenseForm.amount), id: Date.now() }];
    setTrips(trips.map(t => t.id === tripId ? { ...t, expenses: newExpenses } : t));
    setExpenseForm({ ...expenseForm, amount: '' });
    showNotif('Expense added');
  };

  // --- Supplier Actions ---
  const [paymentForm, setPaymentForm] = useState({ amount: '', mode: 'Cash', date: new Date().toISOString().split('T')[0] });
  const makePayment = (supplierId) => {
    const amount = parseFloat(paymentForm.amount);
    if (!amount || isNaN(amount)) return showNotif('Please enter a valid amount', 'error');
    setSuppliers(suppliers.map(s => {
      if (parseInt(s.id) === parseInt(supplierId)) {
        return { 
          ...s, 
          payments: [...(s.payments || []), { ...paymentForm, amount, id: Date.now(), description: 'Owner Payment' }] 
        };
      }
      return s;
    }));
    setPaymentForm({ ...paymentForm, amount: '' });
    showNotif('Payment recorded');
  };

  // --- Filters ---
  const [expenseFilter, setExpenseFilter] = useState('All');
  const [vehicleFilter, setVehicleFilter] = useState('All');

  // --- Dashboard Stats ---
  const dashboardStats = useMemo(() => {
    const activeTripsCount = trips.filter(t => t.status === 'active').length;
    const totalProfit = trips.reduce((acc, t) => {
      const expenses = (t.expenses || []).reduce((eAcc, e) => eAcc + parseFloat(e.amount), 0);
      return acc + (t.totalFare - expenses);
    }, 0);
    return { activeTripsCount, totalProfit, vehicleCount: vehicles.length };
  }, [trips, vehicles]);

  // --- Render Helpers ---
  const getSupplierName = (id) => suppliers.find(s => parseInt(s.id) === parseInt(id))?.name || 'Unknown';
  const calculateTripProfit = (trip) => {
    if (!trip) return 0;
    const expenses = (trip.expenses || []).reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
    return (parseFloat(trip.totalFare) || 0) - expenses;
  };

  return (
    <div className="vehicle-management">
      {notif && (
        <div className={`notification ${notif.type}`} style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 100,
          background: notif.type === 'error' ? '#ef4444' : '#10b981', color: 'white',
          padding: '12px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)', animation: 'slideIn 0.3s forwards'
        }}>
          {notif.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          {notif.msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '8px' }}>Vehicle Management</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage your fleet, trips, and supplier accounts seamlessly.</p>
        </div>
        <div style={{ display: 'flex', background: 'var(--bg-surface)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          {['dashboard', 'vehicles', 'trips', 'suppliers', 'reports'].map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)}
              className={`btn ${activeTab === tab ? 'btn-primary' : ''}`}
              style={{ 
                padding: '8px 16px', 
                borderRadius: '8px', 
                background: activeTab === tab ? 'var(--primary)' : 'transparent',
                color: activeTab === tab ? 'white' : 'var(--text-muted)',
                textTransform: 'capitalize'
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* --- DASHBOARD TAB --- */}
      {activeTab === 'dashboard' && (
        <div className="tab-content" style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="stats-grid">
            <div className="stat-card" style={{ '--primary': '#FF7A59' }}>
              <div className="stat-title">Active Vehicles</div>
              <div className="stat-value">{dashboardStats.vehicleCount}</div>
            </div>
            <div className="stat-card" style={{ '--primary': '#3B82F6' }}>
              <div className="stat-title">Ongoing Trips</div>
              <div className="stat-value">{dashboardStats.activeTripsCount}</div>
            </div>
            <div className="stat-card" style={{ '--primary': '#10B981' }}>
              <div className="stat-title">Total Fleet Profit</div>
              <div className="stat-value">Rs. {dashboardStats.totalProfit.toLocaleString()}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            <div className="card">
              <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={20} /> Recent Trips
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Vehicle</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Route</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Status</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.slice(-5).reverse().map(trip => (
                      <tr key={trip.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px', fontWeight: 600 }}>{vehicles.find(v => parseInt(v.id) === parseInt(trip.vehicleId))?.number || 'Deleted'}</td>
                        <td style={{ padding: '12px' }}>{trip.from} <ArrowRight size={12} style={{ margin: '0 4px' }} /> {trip.to}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ 
                            padding: '4px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700,
                            background: trip.status === 'active' ? '#fff0ed' : '#dcfce7',
                            color: trip.status === 'active' ? '#FF7A59' : '#10b981'
                          }}>
                            {trip.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontWeight: 700, color: calculateTripProfit(trip) >= 0 ? '#10b981' : '#ef4444' }}>
                          Rs. {calculateTripProfit(trip).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="card">
              <h3 style={{ marginBottom: '20px' }}>Quick Actions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={() => setActiveTab('vehicles')} style={{ width: '100%', justifyContent: 'flex-start' }}>
                  <Plus size={18} /> Add New Vehicle
                </button>
                <button className="btn btn-secondary" onClick={() => setActiveTab('trips')} style={{ width: '100%', justifyContent: 'flex-start' }}>
                  <Truck size={18} /> Manage Active Trips
                </button>
                <button className="btn btn-secondary" onClick={() => setActiveTab('suppliers')} style={{ width: '100%', justifyContent: 'flex-start' }}>
                  <DollarSign size={18} /> Pay a Supplier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- VEHICLES TAB --- */}
      {activeTab === 'vehicles' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '20px' }}>Add New Vehicle</h3>
            <form onSubmit={addVehicle} className="form-grid">
              <div className="form-group">
                <label>Vehicle Number</label>
                <input 
                  type="text" 
                  placeholder="e.g. KAA-1234" 
                  value={newVehicle.number}
                  onChange={(e) => setNewVehicle({...newVehicle, number: e.target.value.toUpperCase()})}
                />
              </div>
              <div className="form-group">
                <label>Vehicle Owner (Supplier)</label>
                <select 
                  value={newVehicle.supplierId}
                  onChange={(e) => setNewVehicle({...newVehicle, supplierId: e.target.value})}
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Vehicle Type (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. 20ft Container" 
                  value={newVehicle.type}
                  onChange={(e) => setNewVehicle({...newVehicle, type: e.target.value})}
                />
              </div>
              <div className="form-group" style={{ justifyContent: 'flex-end', paddingTop: '24px' }}>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Add Vehicle</button>
              </div>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '20px' }}>Registered Vehicles</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '16px' }}>Vehicle Number</th>
                    <th style={{ padding: '16px' }}>Owner Name</th>
                    <th style={{ padding: '16px' }}>Type</th>
                    <th style={{ padding: '16px' }}>Current Status</th>
                    <th style={{ padding: '16px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map(v => {
                    const hasActiveTrip = trips.some(t => parseInt(t.vehicleId) === parseInt(v.id) && t.status === 'active');
                    return (
                      <tr key={v.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '16px', fontWeight: 700 }}>{v.number}</td>
                        <td style={{ padding: '16px' }}>{getSupplierName(v.supplierId)}</td>
                        <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{v.type || 'N/A'}</td>
                        <td style={{ padding: '16px' }}>
                          {hasActiveTrip ? (
                            <span style={{ color: '#FF7A59', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Activity size={14} /> On Trip
                            </span>
                          ) : (
                            <span style={{ color: '#10b981', fontWeight: 600 }}>Available</span>
                          )}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '6px' }}
                              onClick={() => {
                                if (hasActiveTrip) return showNotif('Vehicle is already on a trip', 'error');
                                setActiveTripVehicle(v.id);
                                setActiveTab('trips');
                              }}
                            >
                              <Plus size={16} /> Add Trip
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '6px', color: '#ef4444' }} onClick={() => deleteVehicle(v.id)}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {vehicles.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No vehicles registered yet. Add your first vehicle above.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- TRIPS TAB --- */}
      {activeTab === 'trips' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          {activeTripVehicle && (
            <div className="card" style={{ marginBottom: '24px', border: '2px solid var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3>Start New Trip for {vehicles.find(v => v.id === activeTripVehicle)?.number}</h3>
                <button className="btn btn-secondary" style={{ padding: '4px' }} onClick={() => setActiveTripVehicle(null)}><X size={18} /></button>
              </div>
              <div className="form-grid">
                <div className="form-group"><label>From</label><input type="text" value={newTrip.from} onChange={e => setNewTrip({...newTrip, from: e.target.value})} /></div>
                <div className="form-group"><label>To</label><input type="text" value={newTrip.to} onChange={e => setNewTrip({...newTrip, to: e.target.value})} /></div>
                <div className="form-group"><label>One-way Fare</label><input type="number" value={newTrip.oneWayFare} onChange={e => setNewTrip({...newTrip, oneWayFare: e.target.value})} /></div>
                <div className="form-group"><label>Return Fare</label><input type="number" value={newTrip.returnFare} onChange={e => setNewTrip({...newTrip, returnFare: e.target.value})} /></div>
                <div className="form-group">
                  <label>Total Fare (Auto)</label>
                  <input type="text" disabled value={`Rs. ${(parseFloat(newTrip.oneWayFare || 0) + parseFloat(newTrip.returnFare || 0)).toLocaleString()}`} style={{ background: 'var(--bg-main)', fontWeight: 700 }} />
                </div>
                <div className="form-group" style={{ paddingTop: '24px' }}>
                  <button onClick={() => startTrip(activeTripVehicle)} className="btn btn-primary" style={{ width: '100%' }}>Confirm & Start Trip</button>
                </div>
              </div>
            </div>
          )}

          {trips.filter(t => t.status === 'active').map(trip => (
            <div key={trip.id} className="card" style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ background: 'var(--primary-light)', padding: '12px', borderRadius: '12px', color: 'var(--primary)' }}>
                    <Truck size={24} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{vehicles.find(v => parseInt(v.id) === parseInt(trip.vehicleId))?.number}</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{trip.from} to {trip.to} · Started: {trip.startDate}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>Rs. {trip.totalFare.toLocaleString()}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL TRIP FARE</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                <div>
                  <h4 style={{ marginBottom: '16px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <DollarSign size={18} /> Trip Expenses
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(trip.expenses || []).map(exp => (
                      <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-main)', padding: '12px', borderRadius: '12px' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{exp.description}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{exp.paymentType} · {exp.date}</div>
                        </div>
                        <div style={{ fontWeight: 800 }}>Rs. {parseFloat(exp.amount).toLocaleString()}</div>
                      </div>
                    ))}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 40px', gap: '8px', marginTop: '12px' }}>
                      <select value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} style={{ padding: '8px', fontSize: '0.8rem' }}>
                        <option>Fuel</option><option>Tyre</option><option>Maintenance</option><option>Toll Plaza</option><option>Driver Food</option><option>Other</option>
                      </select>
                      <input type="number" placeholder="Amount" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} style={{ padding: '8px', fontSize: '0.8rem' }} />
                      <select value={expenseForm.paymentType} onChange={e => setExpenseForm({...expenseForm, paymentType: e.target.value})} style={{ padding: '8px', fontSize: '0.8rem' }}>
                        <option>Driver Cash</option><option>Supplier Cash</option><option>Supplier Credit</option>
                      </select>
                      <button onClick={() => addExpense(trip.id)} className="btn btn-primary" style={{ padding: '4px' }}><Plus size={18} /></button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="card shadow-md" style={{ background: 'var(--bg-main)', border: 'none', textAlign: 'center' }}>
                    <h4 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '8px' }}>Current Estimated Profit</h4>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: calculateTripProfit(trip) >= 0 ? '#10b981' : '#ef4444' }}>
                      Rs. {calculateTripProfit(trip).toLocaleString()}
                    </div>
                    <p style={{ fontSize: '0.8rem', marginTop: '4px', color: 'var(--text-muted)' }}>
                      Total Fare - Expenses ({ (trip.expenses || []).reduce((acc, e) => acc + parseFloat(e.amount), 0).toLocaleString() })
                    </p>
                  </div>
                  <button onClick={() => closeTrip(trip.id)} className="btn btn-primary" style={{ width: '100%', height: '56px', fontSize: '1.1rem' }}>
                    <CheckCircle2 size={24} /> Close Full Trip & Finalize
                  </button>
                </div>
              </div>
            </div>
          ))}

          {trips.filter(t => t.status === 'active').length === 0 && !activeTripVehicle && (
            <div style={{ padding: '80px', textAlign: 'center' }}>
               <Package size={48} style={{ color: 'var(--border)', marginBottom: '16px' }} />
               <h3 style={{ color: 'var(--text-muted)' }}>No Active Trips</h3>
               <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Select a vehicle from the Vehicles tab to start a new trip cycle.</p>
               <button className="btn btn-secondary" onClick={() => setActiveTab('vehicles')}>Go to Vehicles</button>
            </div>
          )}
        </div>
      )}

      {/* --- SUPPLIERS TAB --- */}
      {activeTab === 'suppliers' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
            <div className="card">
              <h3 style={{ marginBottom: '20px' }}>Vehicle Owners</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {suppliers.map(s => (
                  <button 
                    key={s.id} 
                    className="nav-item" 
                    onClick={() => setVehicleFilter(s.id)}
                    style={{ 
                      width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer',
                      background: parseInt(vehicleFilter) === parseInt(s.id) ? 'var(--primary)' : 'transparent',
                      color: parseInt(vehicleFilter) === parseInt(s.id) ? 'white' : 'var(--text-main)'
                    }}
                  >
                    <User size={18} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{s.name}</div>
                      <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{calculateSupplierBalance(s.id) >= 0 ? 'Payable' : 'Overpaid'}: Rs. {Math.abs(calculateSupplierBalance(s.id)).toLocaleString()}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              {vehicleFilter !== 'All' ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                    <div>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{suppliers.find(s => parseInt(s.id) === parseInt(vehicleFilter))?.name} Account</h2>
                      <p style={{ color: 'var(--text-muted)' }}>{suppliers.find(s => parseInt(s.id) === parseInt(vehicleFilter))?.address}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>CURRENT PAYABLE</div>
                      <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--primary)' }}>Rs. {Math.abs(calculateSupplierBalance(vehicleFilter)).toLocaleString()}</div>
                      <div style={{ fontSize: '0.7rem', color: calculateSupplierBalance(vehicleFilter) >= 0 ? 'var(--primary)' : '#10b981' }}>
                        {calculateSupplierBalance(vehicleFilter) >= 0 ? 'DUE TO OWNER' : 'OVERPAID TO OWNER'}
                      </div>
                    </div>
                  </div>

                  <div className="card" style={{ background: 'var(--bg-main)', border: 'none', marginBottom: '24px' }}>
                    <h4 style={{ marginBottom: '16px' }}>Make Owner Payment</h4>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <input type="number" placeholder="Payment Amount" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} style={{ flex: 1, padding: '12px' }} />
                      <select value={paymentForm.mode} onChange={e => setPaymentForm({...paymentForm, mode: e.target.value})} style={{ padding: '12px' }}>
                         <option>Cash</option><option>Bank Transfer</option><option>Cheque</option>
                      </select>
                      <button onClick={() => makePayment(vehicleFilter)} className="btn btn-primary">Record Payment</button>
                    </div>
                  </div>

                  <h4 style={{ marginBottom: '16px' }}>Recent Ledger History</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Combine Credit Expenses and Payments for ledger */}
                    {[
                      ...trips.filter(t => parseInt(vehicles.find(v => parseInt(v.id) === parseInt(t.vehicleId))?.supplierId) === parseInt(vehicleFilter))
                        .flatMap(t => (t.expenses || []).filter(e => e.paymentType === 'Supplier Credit')
                        .map(e => ({ ...e, type: 'Credit', vehicle: vehicles.find(v => parseInt(v.id) === parseInt(t.vehicleId))?.number }))),
                      ...(suppliers.find(s => parseInt(s.id) === parseInt(vehicleFilter))?.payments || []).map(p => ({ ...p, type: 'Payment', description: `Payment via ${p.mode}` }))
                    ].sort((a,b) => new Date(b.date) - new Date(a.date)).map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{item.description} {item.vehicle && `(${item.vehicle})`}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.date}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, color: item.type === 'Credit' ? '#ef4444' : '#10b981' }}>
                            {item.type === 'Credit' ? '+' : '-'} Rs. {parseFloat(item.amount).toLocaleString()}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.type}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <User size={48} style={{ marginBottom: '16px', opacity: 0.2 }} />
                  <h3>Select a Supplier to View Account Ledger</h3>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- REPORTS TAB --- */}
      {activeTab === 'reports' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3>Global Filtered History</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Filter size={16} />
                    <select value={expenseFilter} onChange={e => setExpenseFilter(e.target.value)} style={{ padding: '6px' }}>
                       <option>All Types</option><option>Fuel</option><option>Tyre</option><option>Maintenance</option><option>Toll Plaza</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Truck size={16} />
                    <select value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)} style={{ padding: '6px' }}>
                       <option value="All">All Vehicles</option>
                       {vehicles.map(v => <option key={v.id} value={v.id}>{v.number}</option>)}
                    </select>
                  </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
               <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '12px' }}>Date</th>
                      <th style={{ padding: '12px' }}>Vehicle</th>
                      <th style={{ padding: '12px' }}>Description</th>
                      <th style={{ padding: '12px' }}>Amount</th>
                      <th style={{ padding: '12px' }}>Paid By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.flatMap(t => (t.expenses || []).map(e => {
                      const veh = vehicles.find(v => parseInt(v.id) === parseInt(t.vehicleId));
                      return { ...e, vehicle: veh };
                    }))
                      .filter(e => (expenseFilter === 'All Types' || e.description === expenseFilter))
                      .filter(e => (vehicleFilter === 'All' || (e.vehicle && parseInt(e.vehicle.id) === parseInt(vehicleFilter))))
                      .sort((a,b) => new Date(b.date) - new Date(a.date))
                      .map(e => (
                        <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px' }}>{e.date}</td>
                          <td style={{ padding: '12px', fontWeight: 700 }}>{e.vehicle?.number || 'Deleted'}</td>
                          <td style={{ padding: '12px' }}>{e.description}</td>
                          <td style={{ padding: '12px', fontWeight: 700 }}>Rs. {(parseFloat(e.amount) || 0).toLocaleString()}</td>
                          <td style={{ padding: '12px' }}>{e.paymentType}</td>
                        </tr>
                      ))
                    }
                  </tbody>
               </table>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .tab-content { transition: all 0.3s; }
        .vehicle-management table tr:hover { background-color: var(--bg-main); transition: 0.2s; }
      `}</style>
    </div>
  );
};

export default VehicleManagement;
