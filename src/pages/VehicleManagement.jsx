import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck, Plus, Search, Filter, DollarSign,
  TrendingUp, Activity, Package, Calendar, AlertCircle,
  CheckCircle2, Trash2, Edit3, X, Eye, Printer, ArrowRight,
  ChevronDown, ChevronUp, Wrench, CreditCard, User, Phone,
  FileText, ShieldCheck, RefreshCw, Layers
} from 'lucide-react';

const STORAGE_KEYS = {
  VEHICLES: 'vtm_fleet_vehicles',
  TRIPS: 'vtm_fleet_trips',
  EXPENSES: 'vtm_fleet_expenses',
  MAINTENANCE: 'vtm_fleet_maintenance',
  SUPPLIER_PAYMENTS: 'vtm_fleet_supplier_payments',
};

const formatRs = (amount) => {
  const val = parseFloat(amount) || 0;
  return 'Rs. ' + Math.round(val).toLocaleString('en-PK');
};

const safeParse = (key, fallback) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch (e) {
    console.error('Error loading ' + key + ':', e);
    return fallback;
  }
};

const safeSave = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving ' + key + ':', e);
  }
};

const getToday = () => new Date().toISOString().slice(0, 10);
const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

export default function VehicleManagement() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [vehicles, setVehicles] = useState(() => safeParse(STORAGE_KEYS.VEHICLES, []));
  const [trips, setTrips] = useState(() => safeParse(STORAGE_KEYS.TRIPS, []));
  const [expenses, setExpenses] = useState(() => safeParse(STORAGE_KEYS.EXPENSES, []));
  const [maintenance, setMaintenance] = useState(() => safeParse(STORAGE_KEYS.MAINTENANCE, []));
  const [supplierPayments, setSupplierPayments] = useState(() => safeParse(STORAGE_KEYS.SUPPLIER_PAYMENTS, []));

  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => safeSave(STORAGE_KEYS.VEHICLES, vehicles), [vehicles]);
  useEffect(() => safeSave(STORAGE_KEYS.TRIPS, trips), [trips]);
  useEffect(() => safeSave(STORAGE_KEYS.EXPENSES, expenses), [expenses]);
  useEffect(() => safeSave(STORAGE_KEYS.MAINTENANCE, maintenance), [maintenance]);
  useEffect(() => safeSave(STORAGE_KEYS.SUPPLIER_PAYMENTS, supplierPayments), [supplierPayments]);

  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [vehicleEditing, setVehicleEditing] = useState(null);
  const [vehicleForm, setVehicleForm] = useState({
    vehicleNumber: '',
    chassisNumber: '',
    engineNumber: '',
    ownerName: '',
    driverName: '',
    driverMobile: '',
    vehicleType: 'Trailer (22 Wheeler)',
    notes: ''
  });

  const [tripModalOpen, setTripModalOpen] = useState(false);
  const [tripEditing, setTripEditing] = useState(null);
  const [tripForm, setTripForm] = useState({
    vehicleNumber: '',
    from: 'Karachi',
    destination: 'Lahore',
    startDate: getToday(),
    returnDate: '',
    totalDays: 1,
    weight: '',
    goingFreight: '',
    returnFreight: '',
    status: 'On Trip',
    notes: ''
  });

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [activeTripForExpense, setActiveTripForExpense] = useState(null);
  const [expenseEditing, setExpenseEditing] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    expenseName: '',
    amount: '',
    supplierName: '',
    paymentType: 'Paid',
    date: getToday(),
    notes: ''
  });

  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [maintenanceEditing, setMaintenanceEditing] = useState(null);
  const [maintenanceForm, setMaintenanceForm] = useState({
    vehicleNumber: '',
    workName: '',
    amount: '',
    supplierName: '',
    paymentType: 'Paid',
    date: getToday(),
    notes: ''
  });

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentEditing, setPaymentEditing] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    supplierName: '',
    amount: '',
    paymentMode: 'Cash',
    date: getToday(),
    notes: ''
  });

  const [selectedSupplierLedger, setSelectedSupplierLedger] = useState(null);

  const [vehicleSearch, setVehicleSearch] = useState('');
  const [tripSearch, setTripSearch] = useState('');
  const [tripStatusFilter, setTripStatusFilter] = useState('All');
  const [maintenanceSearch, setMaintenanceSearch] = useState('');
  const [monthlyFilterVehicle, setMonthlyFilterVehicle] = useState('All');
  const [monthlyFilterMonth, setMonthlyFilterMonth] = useState(getCurrentMonth());
  const [supplierSearch, setSupplierSearch] = useState('');

  const tripCalculations = useMemo(() => {
    const map = {};
    trips.forEach(t => {
      const tripExpenses = expenses.filter(e => String(e.tripId) === String(t.id));
      const totalExpense = tripExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      const goingFreight = parseFloat(t.goingFreight) || 0;
      const returnFreight = parseFloat(t.returnFreight) || 0;
      const totalIncome = goingFreight + returnFreight;
      const profit = totalIncome - totalExpense;
      const profitMargin = totalIncome > 0 ? ((profit / totalIncome) * 100).toFixed(1) : '0.0';

      map[t.id] = {
        totalExpense,
        totalIncome,
        profit,
        profitMargin,
        expenseCount: tripExpenses.length
      };
    });
    return map;
  }, [trips, expenses]);

  const overallStats = useMemo(() => {
    let totalIncome = 0;
    let totalTripExpenses = 0;

    trips.forEach(t => {
      const calc = tripCalculations[t.id] || { totalIncome: 0, totalExpense: 0 };
      totalIncome += calc.totalIncome;
      totalTripExpenses += calc.totalExpense;
    });

    const totalMaintenanceExpenses = maintenance.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
    const grandTotalExpenses = totalTripExpenses + totalMaintenanceExpenses;
    const netProfit = totalIncome - grandTotalExpenses;

    const vehiclesOnTripCount = trips.filter(t => t.status === 'On Trip').length;

    const creditExpenses = expenses.filter(e => e.paymentType === 'Credit' && e.supplierName && e.supplierName.trim());
    const creditMaintenance = maintenance.filter(m => m.paymentType === 'Credit' && m.supplierName && m.supplierName.trim());
    
    let totalCreditBills = 0;
    creditExpenses.forEach(e => totalCreditBills += (parseFloat(e.amount) || 0));
    creditMaintenance.forEach(m => totalCreditBills += (parseFloat(m.amount) || 0));

    const totalSupplierPaymentsMade = supplierPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const totalSupplierPayable = Math.max(0, totalCreditBills - totalSupplierPaymentsMade);

    return {
      totalVehicles: vehicles.length,
      vehiclesOnTrip: vehiclesOnTripCount,
      totalTrips: trips.length,
      totalIncome,
      totalTripExpenses,
      totalMaintenanceExpenses,
      grandTotalExpenses,
      netProfit,
      totalSupplierPayable
    };
  }, [vehicles, trips, expenses, maintenance, supplierPayments, tripCalculations]);

  const supplierLedgerData = useMemo(() => {
    const suppliers = {};

    const getSup = (name) => {
      const clean = name.trim();
      if (!suppliers[clean]) {
        suppliers[clean] = {
          name: clean,
          totalBills: 0,
          totalPaid: 0,
          remainingPayable: 0,
          bills: [],
          payments: []
        };
      }
      return suppliers[clean];
    };

    expenses.forEach(e => {
      if (e.paymentType === 'Credit' && e.supplierName && e.supplierName.trim()) {
        const s = getSup(e.supplierName);
        const amt = parseFloat(e.amount) || 0;
        s.totalBills += amt;
        s.bills.push({
          id: e.id,
          type: 'Trip Expense',
          name: e.expenseName,
          amount: amt,
          date: e.date,
          reference: 'Trip',
          notes: e.notes
        });
      }
    });

    maintenance.forEach(m => {
      if (m.paymentType === 'Credit' && m.supplierName && m.supplierName.trim()) {
        const s = getSup(m.supplierName);
        const amt = parseFloat(m.amount) || 0;
        s.totalBills += amt;
        s.bills.push({
          id: m.id,
          type: 'Maintenance Work',
          name: m.workName,
          amount: amt,
          date: m.date,
          reference: 'Vehicle: ' + m.vehicleNumber,
          notes: m.notes
        });
      }
    });

    supplierPayments.forEach(p => {
      if (p.supplierName && p.supplierName.trim()) {
        const s = getSup(p.supplierName);
        const amt = parseFloat(p.amount) || 0;
        s.totalPaid += amt;
        s.payments.push({
          id: p.id,
          amount: amt,
          paymentMode: p.paymentMode,
          date: p.date,
          notes: p.notes
        });
      }
    });

    Object.values(suppliers).forEach(s => {
      s.remainingPayable = s.totalBills - s.totalPaid;
      s.bills.sort((a, b) => new Date(b.date) - new Date(a.date));
      s.payments.sort((a, b) => new Date(b.date) - new Date(a.date));
    });

    return Object.values(suppliers);
  }, [expenses, maintenance, supplierPayments]);

  const allSupplierNames = useMemo(() => {
    const set = new Set();
    expenses.forEach(e => { if (e.supplierName && e.supplierName.trim()) set.add(e.supplierName.trim()); });
    maintenance.forEach(m => { if (m.supplierName && m.supplierName.trim()) set.add(m.supplierName.trim()); });
    supplierPayments.forEach(p => { if (p.supplierName && p.supplierName.trim()) set.add(p.supplierName.trim()); });
    return Array.from(set);
  }, [expenses, maintenance, supplierPayments]);

  const openAddVehicle = () => {
    setVehicleEditing(null);
    setVehicleForm({
      vehicleNumber: '',
      chassisNumber: '',
      engineNumber: '',
      ownerName: '',
      driverName: '',
      driverMobile: '',
      vehicleType: 'Trailer (22 Wheeler)',
      notes: ''
    });
    setVehicleModalOpen(true);
  };

  const openEditVehicle = (veh) => {
    setVehicleEditing(veh);
    setVehicleForm({ ...veh });
    setVehicleModalOpen(true);
  };

  const saveVehicle = (e) => {
    e.preventDefault();
    if (!vehicleForm.vehicleNumber || !vehicleForm.vehicleNumber.trim()) {
      showToast('Please enter Vehicle Number', 'error');
      return;
    }

    const trimmedNum = vehicleForm.vehicleNumber.trim().toUpperCase();

    if (vehicleEditing) {
      setVehicles(prev => prev.map(v => v.id === vehicleEditing.id ? { ...vehicleForm, vehicleNumber: trimmedNum, id: v.id, updatedAt: new Date().toISOString() } : v));
      if (vehicleEditing.vehicleNumber !== trimmedNum) {
        setTrips(prev => prev.map(t => t.vehicleNumber === vehicleEditing.vehicleNumber ? { ...t, vehicleNumber: trimmedNum } : t));
        setMaintenance(prev => prev.map(m => m.vehicleNumber === vehicleEditing.vehicleNumber ? { ...m, vehicleNumber: trimmedNum } : m));
      }
      showToast('Vehicle updated successfully!');
    } else {
      if (vehicles.some(v => v.vehicleNumber.toUpperCase() === trimmedNum)) {
        showToast('Vehicle ' + trimmedNum + ' already exists!', 'error');
        return;
      }
      const newV = {
        ...vehicleForm,
        id: 'veh_' + Date.now(),
        vehicleNumber: trimmedNum,
        createdAt: new Date().toISOString()
      };
      setVehicles(prev => [newV, ...prev]);
      showToast('Vehicle ' + trimmedNum + ' added successfully!');
    }

    setVehicleModalOpen(false);
  };

  const deleteVehicle = (veh) => {
    if (window.confirm('Are you sure you want to delete vehicle ' + veh.vehicleNumber + '? This will also remove its associated trips and maintenance history.')) {
      setVehicles(prev => prev.filter(v => v.id !== veh.id));
      setTrips(prev => prev.filter(t => t.vehicleNumber !== veh.vehicleNumber));
      setMaintenance(prev => prev.filter(m => m.vehicleNumber !== veh.vehicleNumber));
      showToast('Vehicle ' + veh.vehicleNumber + ' deleted.');
    }
  };

  const openAddTrip = (defaultVehicleNumber = '') => {
    setTripEditing(null);
    setTripForm({
      vehicleNumber: defaultVehicleNumber || (vehicles[0]?.vehicleNumber || ''),
      from: 'Karachi',
      destination: 'Lahore',
      startDate: getToday(),
      returnDate: '',
      totalDays: 1,
      weight: '',
      goingFreight: '',
      returnFreight: '',
      status: 'On Trip',
      notes: ''
    });
    setTripModalOpen(true);
  };

  const openEditTrip = (trip) => {
    setTripEditing(trip);
    setTripForm({ ...trip });
    setTripModalOpen(true);
  };

  const calculateDays = (start, end) => {
    if (!start || !end) return 1;
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  };

  const saveTrip = (e) => {
    e.preventDefault();
    if (!tripForm.vehicleNumber) {
      showToast('Please select or enter a Vehicle Number', 'error');
      return;
    }
    if (!tripForm.from || !tripForm.destination) {
      showToast('Please enter From and Destination locations', 'error');
      return;
    }

    const going = parseFloat(tripForm.goingFreight) || 0;
    const ret = parseFloat(tripForm.returnFreight) || 0;
    const totalIncome = going + ret;
    const days = tripForm.returnDate ? calculateDays(tripForm.startDate, tripForm.returnDate) : (parseInt(tripForm.totalDays) || 1);

    if (tripEditing) {
      setTrips(prev => prev.map(t => t.id === tripEditing.id ? {
        ...tripForm,
        id: t.id,
        totalDays: days,
        goingFreight: going,
        returnFreight: ret,
        totalIncome: totalIncome,
        updatedAt: new Date().toISOString()
      } : t));
      showToast('Trip updated successfully!');
    } else {
      const newTrip = {
        ...tripForm,
        id: 'trip_' + Date.now(),
        totalDays: days,
        goingFreight: going,
        returnFreight: ret,
        totalIncome: totalIncome,
        createdAt: new Date().toISOString()
      };
      setTrips(prev => [newTrip, ...prev]);
      showToast('Trip added successfully!');
    }

    setTripModalOpen(false);
  };

  const deleteTrip = (trip) => {
    if (window.confirm('Delete Trip from ' + trip.from + ' to ' + trip.destination + ' (' + trip.vehicleNumber + ')? All attached expenses will also be deleted.')) {
      setTrips(prev => prev.filter(t => t.id !== trip.id));
      setExpenses(prev => prev.filter(e => String(e.tripId) !== String(trip.id)));
      showToast('Trip and its expenses deleted.');
    }
  };

  const openAddExpenseForTrip = (trip) => {
    setActiveTripForExpense(trip);
    setExpenseEditing(null);
    setExpenseForm({
      expenseName: '',
      amount: '',
      supplierName: '',
      paymentType: 'Paid',
      date: trip.startDate || getToday(),
      notes: ''
    });
    setExpenseModalOpen(true);
  };

  const openEditExpense = (expense, trip) => {
    setActiveTripForExpense(trip);
    setExpenseEditing(expense);
    setExpenseForm({ ...expense });
    setExpenseModalOpen(true);
  };

  const saveExpense = (e) => {
    e.preventDefault();
    if (!expenseForm.expenseName || !expenseForm.expenseName.trim()) {
      showToast('Please enter an Expense Name', 'error');
      return;
    }
    const amt = parseFloat(expenseForm.amount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    if (expenseEditing) {
      setExpenses(prev => prev.map(ex => ex.id === expenseEditing.id ? {
        ...expenseForm,
        id: ex.id,
        tripId: activeTripForExpense?.id || ex.tripId,
        vehicleNumber: activeTripForExpense?.vehicleNumber || ex.vehicleNumber,
        amount: amt,
        updatedAt: new Date().toISOString()
      } : ex));
      showToast('Expense updated! Totals recalculated.');
    } else {
      const newEx = {
        ...expenseForm,
        id: 'exp_' + Date.now(),
        tripId: activeTripForExpense.id,
        vehicleNumber: activeTripForExpense.vehicleNumber,
        amount: amt,
        createdAt: new Date().toISOString()
      };
      setExpenses(prev => [newEx, ...prev]);
      showToast('Expense ' + expenseForm.expenseName + ' added!');
    }

    setExpenseModalOpen(false);
  };

  const deleteExpense = (exp) => {
    if (window.confirm('Delete expense ' + exp.expenseName + ' of ' + formatRs(exp.amount) + '?')) {
      setExpenses(prev => prev.filter(e => e.id !== exp.id));
      showToast('Expense removed! Totals updated.');
    }
  };

  const openAddMaintenance = (defaultVehicleNumber = '') => {
    setMaintenanceEditing(null);
    setMaintenanceForm({
      vehicleNumber: defaultVehicleNumber || (vehicles[0]?.vehicleNumber || ''),
      workName: '',
      amount: '',
      supplierName: '',
      paymentType: 'Paid',
      date: getToday(),
      notes: ''
    });
    setMaintenanceModalOpen(true);
  };

  const openEditMaintenance = (m) => {
    setMaintenanceEditing(m);
    setMaintenanceForm({ ...m });
    setMaintenanceModalOpen(true);
  };

  const saveMaintenance = (e) => {
    e.preventDefault();
    if (!maintenanceForm.vehicleNumber) {
      showToast('Please select a Vehicle Number', 'error');
      return;
    }
    if (!maintenanceForm.workName || !maintenanceForm.workName.trim()) {
      showToast('Please enter Maintenance Work Name', 'error');
      return;
    }
    const amt = parseFloat(maintenanceForm.amount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter valid amount', 'error');
      return;
    }

    if (maintenanceEditing) {
      setMaintenance(prev => prev.map(m => m.id === maintenanceEditing.id ? {
        ...maintenanceForm,
        id: m.id,
        amount: amt,
        updatedAt: new Date().toISOString()
      } : m));
      showToast('Maintenance record updated!');
    } else {
      const newM = {
        ...maintenanceForm,
        id: 'maint_' + Date.now(),
        amount: amt,
        createdAt: new Date().toISOString()
      };
      setMaintenance(prev => [newM, ...prev]);
      showToast('Maintenance ' + maintenanceForm.workName + ' saved!');
    }

    setMaintenanceModalOpen(false);
  };

  const deleteMaintenance = (m) => {
    if (window.confirm('Delete maintenance record ' + m.workName + ' (' + formatRs(m.amount) + ')?')) {
      setMaintenance(prev => prev.filter(item => item.id !== m.id));
      showToast('Maintenance record deleted.');
    }
  };

  const openAddPayment = (defaultSupplier = '') => {
    setPaymentEditing(null);
    setPaymentForm({
      supplierName: defaultSupplier || '',
      amount: '',
      paymentMode: 'Cash',
      date: getToday(),
      notes: ''
    });
    setPaymentModalOpen(true);
  };

  const savePayment = (e) => {
    e.preventDefault();
    if (!paymentForm.supplierName || !paymentForm.supplierName.trim()) {
      showToast('Please enter Supplier Name', 'error');
      return;
    }
    const amt = parseFloat(paymentForm.amount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter valid payment amount', 'error');
      return;
    }

    if (paymentEditing) {
      setSupplierPayments(prev => prev.map(p => p.id === paymentEditing.id ? {
        ...paymentForm,
        id: p.id,
        amount: amt,
        updatedAt: new Date().toISOString()
      } : p));
      showToast('Supplier payment updated!');
    } else {
      const newP = {
        ...paymentForm,
        id: 'pay_' + Date.now(),
        amount: amt,
        createdAt: new Date().toISOString()
      };
      setSupplierPayments(prev => [newP, ...prev]);
      showToast('Payment of ' + formatRs(amt) + ' to ' + paymentForm.supplierName + ' recorded!');
    }

    setPaymentModalOpen(false);
  };

  const deletePayment = (p) => {
    if (window.confirm('Delete payment of ' + formatRs(p.amount) + ' to ' + p.supplierName + '?')) {
      setSupplierPayments(prev => prev.filter(item => item.id !== p.id));
      showToast('Supplier payment deleted.');
    }
  };

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const s = vehicleSearch.toLowerCase();
      return (
        (v.vehicleNumber && v.vehicleNumber.toLowerCase().includes(s)) ||
        (v.driverName && v.driverName.toLowerCase().includes(s)) ||
        (v.ownerName && v.ownerName.toLowerCase().includes(s)) ||
        (v.vehicleType && v.vehicleType.toLowerCase().includes(s))
      );
    });
  }, [vehicles, vehicleSearch]);

  const filteredTrips = useMemo(() => {
    return trips.filter(t => {
      const s = tripSearch.toLowerCase();
      const matchSearch = (
        (t.vehicleNumber && t.vehicleNumber.toLowerCase().includes(s)) ||
        (t.from && t.from.toLowerCase().includes(s)) ||
        (t.destination && t.destination.toLowerCase().includes(s)) ||
        (t.notes && t.notes.toLowerCase().includes(s))
      );
      const matchStatus = tripStatusFilter === 'All' ? true : t.status === tripStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [trips, tripSearch, tripStatusFilter]);

  const filteredMaintenance = useMemo(() => {
    return maintenance.filter(m => {
      const s = maintenanceSearch.toLowerCase();
      return (
        (m.vehicleNumber && m.vehicleNumber.toLowerCase().includes(s)) ||
        (m.workName && m.workName.toLowerCase().includes(s)) ||
        (m.supplierName && m.supplierName.toLowerCase().includes(s)) ||
        (m.notes && m.notes.toLowerCase().includes(s))
      );
    });
  }, [maintenance, maintenanceSearch]);

  const filteredSuppliers = useMemo(() => {
    return supplierLedgerData.filter(s => {
      return s.name.toLowerCase().includes(supplierSearch.toLowerCase());
    });
  }, [supplierLedgerData, supplierSearch]);

  const monthlyAccountSummary = useMemo(() => {
    const selectedVehicles = monthlyFilterVehicle === 'All' 
      ? vehicles 
      : vehicles.filter(v => v.vehicleNumber === monthlyFilterVehicle);

    return selectedVehicles.map(veh => {
      const vehTrips = trips.filter(t => {
        if (t.vehicleNumber !== veh.vehicleNumber) return false;
        if (!monthlyFilterMonth) return true;
        const tripMonth = (t.startDate || '').slice(0, 7);
        return tripMonth === monthlyFilterMonth;
      });

      let totalIncome = 0;
      let totalTripExpenses = 0;

      const tripsWithDetails = vehTrips.map(t => {
        const calc = tripCalculations[t.id] || { totalIncome: 0, totalExpense: 0, profit: 0 };
        totalIncome += calc.totalIncome;
        totalTripExpenses += calc.totalExpense;
        return {
          ...t,
          ...calc,
          tripExpenses: expenses.filter(e => String(e.tripId) === String(t.id))
        };
      });

      const vehMaintenance = maintenance.filter(m => {
        if (m.vehicleNumber !== veh.vehicleNumber) return false;
        if (!monthlyFilterMonth) return true;
        const maintMonth = (m.date || '').slice(0, 7);
        return maintMonth === monthlyFilterMonth;
      });

      const totalMaintenance = vehMaintenance.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
      const totalExpenses = totalTripExpenses + totalMaintenance;
      const totalProfit = totalIncome - totalExpenses;

      return {
        vehicle: veh,
        tripsCount: vehTrips.length,
        trips: tripsWithDetails,
        maintenance: vehMaintenance,
        totalIncome,
        totalTripExpenses,
        totalMaintenance,
        totalExpenses,
        totalProfit
      };
    });
  }, [vehicles, trips, expenses, maintenance, tripCalculations, monthlyFilterVehicle, monthlyFilterMonth]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="vehicle-management-page" style={{ paddingBottom: '50px' }}>
      
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: toast.type === 'error' ? '#ef4444' : '#10b981',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 600,
          fontSize: '14px'
        }}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 10px rgba(37,99,235,0.25)'
          }}>
            <Truck size={24} />
          </div>
          <div>
            <h1 className="page-title" style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>
              Vehicle & Trailer Management
            </h1>
            <p style={{ margin: '2px 0 0', color: 'var(--secondary)', fontSize: '13px' }}>
              Complete fleet operations, flexible trip expenses, maintenance and supplier accounting
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={openAddVehicle} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> Add Vehicle
          </button>
          <button className="btn" onClick={() => openAddTrip()} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#059669', color: '#fff' }}>
            <Plus size={16} /> Add Trip
          </button>
          <button className="btn" onClick={() => openAddMaintenance()} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#d97706', color: '#fff' }}>
            <Wrench size={16} /> Add Maintenance
          </button>
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: '6px',
        borderBottom: '2px solid var(--border)',
        marginBottom: '20px',
        overflowX: 'auto',
        paddingBottom: '2px'
      }}>
        {[
          { id: 'dashboard', label: '📊 Dashboard' },
          { id: 'vehicles', label: '🚛 Vehicles (' + vehicles.length + ')' },
          { id: 'trips', label: '🛣️ Trips & Expenses (' + trips.length + ')' },
          { id: 'maintenance', label: '🔧 Maintenance (' + maintenance.length + ')' },
          { id: 'monthly', label: '📅 Vehicle Monthly Account' },
          { id: 'suppliers', label: '🤝 Supplier Accounts (' + supplierLedgerData.length + ')' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-light)',
              backgroundColor: activeTab === tab.id ? '#eff6ff' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid var(--primary)' : '3px solid transparent',
              borderRadius: '6px 6px 0 0',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '14px',
            marginBottom: '24px'
          }}>
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--secondary)', fontWeight: 600 }}>
                Total Vehicles
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b', marginTop: '4px' }}>
                {overallStats.totalVehicles}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Active fleet size
              </div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--secondary)', fontWeight: 600 }}>
                Vehicles On Trip
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>
                {overallStats.vehiclesOnTrip}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Currently on route
              </div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--secondary)', fontWeight: 600 }}>
                Total Trips
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#7c3aed', marginTop: '4px' }}>
                {overallStats.totalTrips}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Recorded trips
              </div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--secondary)', fontWeight: 600 }}>
                Total Income
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                {formatRs(overallStats.totalIncome)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Going + Return Freights
              </div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--secondary)', fontWeight: 600 }}>
                Total Expenses
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626', marginTop: '4px' }}>
                {formatRs(overallStats.grandTotalExpenses)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Trips + Maintenance
              </div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid ' + (overallStats.netProfit >= 0 ? '#10b981' : '#ef4444') }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--secondary)', fontWeight: 600 }}>
                Total Profit
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: overallStats.netProfit >= 0 ? '#059669' : '#dc2626', marginTop: '4px' }}>
                {formatRs(overallStats.netProfit)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Net after all expenses
              </div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #ea580c' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--secondary)', fontWeight: 600 }}>
                Supplier Payable
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#ea580c', marginTop: '4px' }}>
                {formatRs(overallStats.totalSupplierPayable)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Remaining credit bills
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} color="#3b82f6" /> Recent Trips
                </h3>
                <button className="btn btn-sm" onClick={() => setActiveTab('trips')} style={{ fontSize: '12px' }}>
                  View All Trips
                </button>
              </div>

              {trips.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-light)' }}>
                  No trips recorded yet. Click <b>+ Add Trip</b> above to get started.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--secondary)' }}>
                        <th style={{ padding: '8px' }}>Vehicle</th>
                        <th style={{ padding: '8px' }}>Route</th>
                        <th style={{ padding: '8px' }}>Income</th>
                        <th style={{ padding: '8px' }}>Expense</th>
                        <th style={{ padding: '8px' }}>Profit</th>
                        <th style={{ padding: '8px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trips.slice(0, 6).map(t => {
                        const calc = tripCalculations[t.id] || { totalIncome: 0, totalExpense: 0, profit: 0 };
                        return (
                          <tr key={t.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '8px', fontWeight: 700 }}>{t.vehicleNumber}</td>
                            <td style={{ padding: '8px' }}>{t.from} to {t.destination}</td>
                            <td style={{ padding: '8px', color: '#059669', fontWeight: 600 }}>{formatRs(calc.totalIncome)}</td>
                            <td style={{ padding: '8px', color: '#dc2626' }}>{formatRs(calc.totalExpense)}</td>
                            <td style={{ padding: '8px', fontWeight: 700, color: calc.profit >= 0 ? '#059669' : '#dc2626' }}>
                              {formatRs(calc.profit)}
                            </td>
                            <td style={{ padding: '8px' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 600,
                                backgroundColor: t.status === 'On Trip' ? '#fef3c7' : '#dcfce7',
                                color: t.status === 'On Trip' ? '#92400e' : '#166534'
                              }}>
                                {t.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Truck size={18} color="#059669" /> Fleet Vehicles Status
                </h3>
                <button className="btn btn-sm" onClick={() => setActiveTab('vehicles')} style={{ fontSize: '12px' }}>
                  View All Fleet
                </button>
              </div>

              {vehicles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-light)' }}>
                  No vehicles registered. Click <b>+ Add Vehicle</b> to register your fleet.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--secondary)' }}>
                        <th style={{ padding: '8px' }}>Vehicle #</th>
                        <th style={{ padding: '8px' }}>Driver</th>
                        <th style={{ padding: '8px' }}>Type</th>
                        <th style={{ padding: '8px' }}>Current State</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicles.slice(0, 6).map(v => {
                        const activeTrip = trips.find(t => t.vehicleNumber === v.vehicleNumber && t.status === 'On Trip');
                        return (
                          <tr key={v.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '8px', fontWeight: 700, color: 'var(--primary)' }}>{v.vehicleNumber}</td>
                            <td style={{ padding: '8px' }}>{v.driverName || '—'}</td>
                            <td style={{ padding: '8px', color: 'var(--secondary)', fontSize: '12px' }}>{v.vehicleType}</td>
                            <td style={{ padding: '8px' }}>
                              {activeTrip ? (
                                <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, backgroundColor: '#fef3c7', color: '#92400e' }}>
                                  On Route ({activeTrip.destination})
                                </span>
                              ) : (
                                <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, backgroundColor: '#dcfce7', color: '#166534' }}>
                                  Available
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>
                              <button
                                className="btn btn-sm"
                                onClick={() => openAddTrip(v.vehicleNumber)}
                                style={{ padding: '3px 8px', fontSize: '11px', backgroundColor: '#eff6ff', color: 'var(--primary)' }}
                              >
                                + Trip
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'vehicles' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '400px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-light)' }} />
                <input
                  type="text"
                  placeholder="Search vehicle number, driver, owner..."
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  style={{ width: '100%', paddingLeft: '32px', height: '36px', borderRadius: '6px', border: '1px solid var(--border)' }}
                />
              </div>
            </div>

            <button className="btn btn-primary" onClick={openAddVehicle} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={16} /> Add Vehicle
            </button>
          </div>

          {filteredVehicles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)' }}>
              No vehicles found. Click <b>+ Add Vehicle</b> to add your first truck / trailer.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', backgroundColor: '#f8fafc', color: 'var(--secondary)' }}>
                    <th style={{ padding: '12px' }}>Vehicle #</th>
                    <th style={{ padding: '12px' }}>Type</th>
                    <th style={{ padding: '12px' }}>Driver Info</th>
                    <th style={{ padding: '12px' }}>Owner</th>
                    <th style={{ padding: '12px' }}>Engine / Chassis</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.map(veh => {
                    const activeTrip = trips.find(t => t.vehicleNumber === veh.vehicleNumber && t.status === 'On Trip');
                    const vehTripsCount = trips.filter(t => t.vehicleNumber === veh.vehicleNumber).length;
                    return (
                      <tr key={veh.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--dark)' }}>
                            {veh.vehicleNumber}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--secondary)' }}>
                            {vehTripsCount} Total Trips
                          </div>
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text)' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#f1f5f9', fontSize: '12px', fontWeight: 600 }}>
                            {veh.vehicleType || 'Truck / Trailer'}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 600 }}>{veh.driverName || '—'}</div>
                          {veh.driverMobile && (
                            <div style={{ fontSize: '12px', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Phone size={12} /> {veh.driverMobile}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>{veh.ownerName || 'Self / Company'}</td>
                        <td style={{ padding: '12px', fontSize: '12px', color: 'var(--secondary)' }}>
                          <div><b>Eng:</b> {veh.engineNumber || '—'}</div>
                          <div><b>Chas:</b> {veh.chassisNumber || '—'}</div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          {activeTrip ? (
                            <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, backgroundColor: '#fef3c7', color: '#92400e' }}>
                              On Trip ({activeTrip.destination})
                            </span>
                          ) : (
                            <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, backgroundColor: '#dcfce7', color: '#166534' }}>
                              Available
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-sm"
                              onClick={() => {
                                setMonthlyFilterVehicle(veh.vehicleNumber);
                                setActiveTab('monthly');
                              }}
                              title="View Monthly Account"
                              style={{ backgroundColor: '#eff6ff', color: 'var(--primary)' }}
                            >
                              <FileText size={14} />
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={() => openEditVehicle(veh)}
                              title="Edit Vehicle"
                              style={{ backgroundColor: '#f1f5f9', color: 'var(--text)' }}
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={() => deleteVehicle(veh)}
                              title="Delete Vehicle"
                              style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'trips' && (
        <div>
          <div className="card" style={{ marginBottom: '16px', padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '10px', flex: 1, maxWidth: '600px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-light)' }} />
                  <input
                    type="text"
                    placeholder="Search trips by vehicle, route, destination..."
                    value={tripSearch}
                    onChange={(e) => setTripSearch(e.target.value)}
                    style={{ width: '100%', paddingLeft: '32px', height: '36px', borderRadius: '6px', border: '1px solid var(--border)' }}
                  />
                </div>

                <select
                  value={tripStatusFilter}
                  onChange={(e) => setTripStatusFilter(e.target.value)}
                  style={{ height: '36px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px', fontSize: '13px' }}
                >
                  <option value="All">All Statuses</option>
                  <option value="On Trip">On Trip (Active)</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <button className="btn btn-primary" onClick={() => openAddTrip()} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#059669' }}>
                <Plus size={16} /> Add New Trip
              </button>
            </div>
          </div>

          {filteredTrips.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)' }}>
              No trips recorded matching criteria. Click <b>+ Add New Trip</b> to record a trip.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredTrips.map(trip => {
                const calc = tripCalculations[trip.id] || { totalIncome: 0, totalExpense: 0, profit: 0, profitMargin: '0', expenseCount: 0 };
                const tripExpenses = expenses.filter(e => String(e.tripId) === String(trip.id));

                return (
                  <div key={trip.id} className="card" style={{ padding: '18px', borderLeft: '5px solid ' + (trip.status === 'On Trip' ? '#f59e0b' : '#10b981') }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', marginBottom: '14px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--dark)' }}>
                            {trip.vehicleNumber}
                          </span>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: trip.status === 'On Trip' ? '#fef3c7' : '#dcfce7',
                            color: trip.status === 'On Trip' ? '#92400e' : '#166534'
                          }}>
                            {trip.status}
                          </span>
                          <span style={{ fontSize: '13px', color: 'var(--secondary)' }}>
                            Date: {trip.startDate} {trip.returnDate ? 'to ' + trip.returnDate : ''} ({trip.totalDays || 1} Days)
                          </span>
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)', marginTop: '4px' }}>
                          Route: {trip.from} to {trip.destination} {trip.weight ? ' • Weight: ' + trip.weight : ''}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => openAddExpenseForTrip(trip)}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#eff6ff', color: 'var(--primary)', fontWeight: 600 }}
                        >
                          <Plus size={14} /> Add Expense
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => openEditTrip(trip)}
                          style={{ backgroundColor: '#f1f5f9', color: 'var(--text)' }}
                          title="Edit Trip Details"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => deleteTrip(trip)}
                          style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}
                          title="Delete Trip"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: '10px',
                      backgroundColor: '#f8fafc',
                      padding: '12px',
                      borderRadius: '8px',
                      marginBottom: '16px'
                    }}>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--secondary)', textTransform: 'uppercase' }}>Going Freight</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{formatRs(trip.goingFreight)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--secondary)', textTransform: 'uppercase' }}>Return Freight</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{formatRs(trip.returnFreight)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#059669', textTransform: 'uppercase', fontWeight: 700 }}>Total Income</div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: '#059669' }}>{formatRs(calc.totalIncome)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#dc2626', textTransform: 'uppercase', fontWeight: 700 }}>Total Expenses</div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: '#dc2626' }}>{formatRs(calc.totalExpense)}</div>
                      </div>
                      <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: '10px' }}>
                        <div style={{ fontSize: '11px', color: calc.profit >= 0 ? '#059669' : '#dc2626', textTransform: 'uppercase', fontWeight: 700 }}>
                          Trip Profit
                        </div>
                        <div style={{ fontSize: '17px', fontWeight: 800, color: calc.profit >= 0 ? '#059669' : '#dc2626' }}>
                          {formatRs(calc.profit)}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--dark)' }}>
                          Trip Expenses ({tripExpenses.length})
                        </div>
                        <button
                          className="btn btn-sm"
                          onClick={() => openAddExpenseForTrip(trip)}
                          style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}
                        >
                          + Add Expense
                        </button>
                      </div>

                      {tripExpenses.length === 0 ? (
                        <div style={{ fontSize: '12px', color: 'var(--text-light)', fontStyle: 'italic', padding: '6px 0' }}>
                          No expenses added yet. Click "+ Add Expense" to record fuel, toll, driver advance, engine work, etc.
                        </div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left', color: 'var(--secondary)' }}>
                                <th style={{ padding: '6px 10px' }}>Expense Name</th>
                                <th style={{ padding: '6px 10px' }}>Amount</th>
                                <th style={{ padding: '6px 10px' }}>Supplier</th>
                                <th style={{ padding: '6px 10px' }}>Payment Type</th>
                                <th style={{ padding: '6px 10px' }}>Date</th>
                                <th style={{ padding: '6px 10px' }}>Notes</th>
                                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tripExpenses.map(exp => (
                                <tr key={exp.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                  <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--dark)' }}>
                                    {exp.expenseName}
                                  </td>
                                  <td style={{ padding: '6px 10px', fontWeight: 700, color: '#dc2626' }}>
                                    {formatRs(exp.amount)}
                                  </td>
                                  <td style={{ padding: '6px 10px', color: 'var(--secondary)' }}>
                                    {exp.supplierName || '—'}
                                  </td>
                                  <td style={{ padding: '6px 10px' }}>
                                    <span style={{
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '10px',
                                      fontWeight: 600,
                                      backgroundColor: exp.paymentType === 'Credit' ? '#fee2e2' : '#dcfce7',
                                      color: exp.paymentType === 'Credit' ? '#dc2626' : '#166534'
                                    }}>
                                      {exp.paymentType || 'Paid'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '6px 10px', color: 'var(--secondary)' }}>{exp.date}</td>
                                  <td style={{ padding: '6px 10px', color: 'var(--text-light)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {exp.notes || '—'}
                                  </td>
                                  <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                      <button
                                        onClick={() => openEditExpense(exp, trip)}
                                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--secondary)' }}
                                        title="Edit Expense"
                                      >
                                        <Edit3 size={13} />
                                      </button>
                                      <button
                                        onClick={() => deleteExpense(exp)}
                                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#dc2626' }}
                                        title="Delete Expense"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'maintenance' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-light)' }} />
              <input
                type="text"
                placeholder="Search maintenance by work, vehicle, supplier..."
                value={maintenanceSearch}
                onChange={(e) => setMaintenanceSearch(e.target.value)}
                style={{ width: '100%', paddingLeft: '32px', height: '36px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>

            <button className="btn btn-primary" onClick={() => openAddMaintenance()} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#d97706' }}>
              <Plus size={16} /> Add Maintenance
            </button>
          </div>

          {filteredMaintenance.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)' }}>
              No maintenance records found. Click <b>+ Add Maintenance</b> to record engine, tyre, oil or body work.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', backgroundColor: '#f8fafc', color: 'var(--secondary)' }}>
                    <th style={{ padding: '12px' }}>Date</th>
                    <th style={{ padding: '12px' }}>Vehicle #</th>
                    <th style={{ padding: '12px' }}>Work Name / Description</th>
                    <th style={{ padding: '12px' }}>Amount</th>
                    <th style={{ padding: '12px' }}>Supplier / Workshop</th>
                    <th style={{ padding: '12px' }}>Payment Status</th>
                    <th style={{ padding: '12px' }}>Notes</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMaintenance.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '12px', color: 'var(--secondary)', fontSize: '13px' }}>{m.date}</td>
                      <td style={{ padding: '12px', fontWeight: 800, color: 'var(--dark)' }}>{m.vehicleNumber}</td>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{m.workName}</td>
                      <td style={{ padding: '12px', fontWeight: 800, color: '#dc2626' }}>{formatRs(m.amount)}</td>
                      <td style={{ padding: '12px', color: 'var(--secondary)' }}>{m.supplierName || '—'}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: m.paymentType === 'Credit' ? '#fee2e2' : '#dcfce7',
                          color: m.paymentType === 'Credit' ? '#dc2626' : '#166534'
                        }}>
                          {m.paymentType || 'Paid'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--text-light)', fontSize: '12px' }}>{m.notes || '—'}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-sm"
                            onClick={() => openEditMaintenance(m)}
                            style={{ backgroundColor: '#f1f5f9', color: 'var(--text)' }}
                            title="Edit Maintenance"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => deleteMaintenance(m)}
                            style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}
                            title="Delete Maintenance"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'monthly' && (
        <div>
          <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--secondary)', marginBottom: '4px' }}>
                    Select Vehicle:
                  </label>
                  <select
                    value={monthlyFilterVehicle}
                    onChange={(e) => setMonthlyFilterVehicle(e.target.value)}
                    style={{ height: '36px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 12px', fontWeight: 600 }}
                  >
                    <option value="All">All Vehicles</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.vehicleNumber}>{v.vehicleNumber} ({v.driverName || 'No driver'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--secondary)', marginBottom: '4px' }}>
                    Select Month:
                  </label>
                  <input
                    type="month"
                    value={monthlyFilterMonth}
                    onChange={(e) => setMonthlyFilterMonth(e.target.value)}
                    style={{ height: '36px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 12px', fontWeight: 600 }}
                  />
                </div>
              </div>

              <button className="btn btn-secondary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Printer size={16} /> Print Monthly Statement
              </button>
            </div>
          </div>

          {monthlyAccountSummary.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)' }}>
              No vehicles found. Add vehicles and trips first.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {monthlyAccountSummary.map(({ vehicle, tripsCount, trips: vehTrips, maintenance: vehMaint, totalIncome, totalTripExpenses, totalMaintenance, totalExpenses, totalProfit }) => (
                <div key={vehicle.id} className="card" style={{ padding: '20px' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border)', paddingBottom: '12px', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--dark)' }}>
                        🚛 {vehicle.vehicleNumber} — Monthly Account ({monthlyFilterMonth || 'All Months'})
                      </h2>
                      <div style={{ fontSize: '13px', color: 'var(--secondary)', marginTop: '2px' }}>
                        Driver: <b>{vehicle.driverName || '—'}</b> {vehicle.driverMobile ? '(' + vehicle.driverMobile + ')' : ''} • Owner: <b>{vehicle.ownerName || 'Company'}</b> • Type: <b>{vehicle.vehicleType}</b>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: 800,
                        backgroundColor: totalProfit >= 0 ? '#dcfce7' : '#fee2e2',
                        color: totalProfit >= 0 ? '#166534' : '#dc2626'
                      }}>
                        Net Monthly Profit: {formatRs(totalProfit)}
                      </span>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: '12px',
                    marginBottom: '18px'
                  }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--secondary)', textTransform: 'uppercase' }}>Total Trips</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b' }}>{tripsCount}</div>
                    </div>
                    <div style={{ backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                      <div style={{ fontSize: '11px', color: '#166534', textTransform: 'uppercase' }}>Total Income</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#166534' }}>{formatRs(totalIncome)}</div>
                    </div>
                    <div style={{ backgroundColor: '#fef2f2', padding: '12px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                      <div style={{ fontSize: '11px', color: '#dc2626', textTransform: 'uppercase' }}>Trip Expenses</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#dc2626' }}>{formatRs(totalTripExpenses)}</div>
                    </div>
                    <div style={{ backgroundColor: '#fffbeb', padding: '12px', borderRadius: '6px', border: '1px solid #fde68a' }}>
                      <div style={{ fontSize: '11px', color: '#b45309', textTransform: 'uppercase' }}>Maintenance Expenses</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#b45309' }}>{formatRs(totalMaintenance)}</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700 }}>Trips in this period</h4>
                    {vehTrips.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-light)', fontStyle: 'italic' }}>No trips recorded for this vehicle in {monthlyFilterMonth}.</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid var(--border-light)' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left', color: 'var(--secondary)' }}>
                            <th style={{ padding: '8px' }}>Date</th>
                            <th style={{ padding: '8px' }}>Route</th>
                            <th style={{ padding: '8px' }}>Going + Return</th>
                            <th style={{ padding: '8px' }}>Total Income</th>
                            <th style={{ padding: '8px' }}>Trip Expenses</th>
                            <th style={{ padding: '8px' }}>Trip Profit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vehTrips.map(t => (
                            <tr key={t.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                              <td style={{ padding: '8px' }}>{t.startDate}</td>
                              <td style={{ padding: '8px', fontWeight: 600 }}>{t.from} to {t.destination}</td>
                              <td style={{ padding: '8px' }}>{formatRs(t.goingFreight)} + {formatRs(t.returnFreight)}</td>
                              <td style={{ padding: '8px', fontWeight: 700, color: '#059669' }}>{formatRs(t.totalIncome)}</td>
                              <td style={{ padding: '8px', color: '#dc2626' }}>{formatRs(t.totalExpense)}</td>
                              <td style={{ padding: '8px', fontWeight: 800, color: t.profit >= 0 ? '#059669' : '#dc2626' }}>
                                {formatRs(t.profit)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div>
                    <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700 }}>Maintenance in this period</h4>
                    {vehMaint.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-light)', fontStyle: 'italic' }}>No maintenance expenses recorded for this vehicle in {monthlyFilterMonth}.</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid var(--border-light)' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left', color: 'var(--secondary)' }}>
                            <th style={{ padding: '8px' }}>Date</th>
                            <th style={{ padding: '8px' }}>Work Description</th>
                            <th style={{ padding: '8px' }}>Workshop / Supplier</th>
                            <th style={{ padding: '8px' }}>Amount</th>
                            <th style={{ padding: '8px' }}>Payment Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vehMaint.map(m => (
                            <tr key={m.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                              <td style={{ padding: '8px' }}>{m.date}</td>
                              <td style={{ padding: '8px', fontWeight: 600 }}>{m.workName}</td>
                              <td style={{ padding: '8px' }}>{m.supplierName || '—'}</td>
                              <td style={{ padding: '8px', fontWeight: 700, color: '#dc2626' }}>{formatRs(m.amount)}</td>
                              <td style={{ padding: '8px' }}>{m.paymentType}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'suppliers' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-light)' }} />
              <input
                type="text"
                placeholder="Search supplier name..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                style={{ width: '100%', paddingLeft: '32px', height: '36px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>

            <button className="btn btn-primary" onClick={() => openAddPayment()} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#2563eb' }}>
              <CreditCard size={16} /> + Add Supplier Payment
            </button>
          </div>

          {filteredSuppliers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)' }}>
              No supplier credit records or payments yet. When you add a trip expense or maintenance with a supplier and select <b>Credit</b>, it automatically appears here.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', backgroundColor: '#f8fafc', color: 'var(--secondary)' }}>
                    <th style={{ padding: '12px' }}>Supplier / Vendor Name</th>
                    <th style={{ padding: '12px' }}>Total Credit Bills</th>
                    <th style={{ padding: '12px' }}>Total Paid</th>
                    <th style={{ padding: '12px' }}>Remaining Payable</th>
                    <th style={{ padding: '12px' }}>Transactions</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map(sup => (
                    <tr key={sup.name} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '12px', fontWeight: 800, fontSize: '15px', color: 'var(--dark)' }}>
                        {sup.name}
                      </td>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#dc2626' }}>
                        {formatRs(sup.totalBills)}
                      </td>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#059669' }}>
                        {formatRs(sup.totalPaid)}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: 800,
                          backgroundColor: sup.remainingPayable > 0 ? '#fee2e2' : '#dcfce7',
                          color: sup.remainingPayable > 0 ? '#dc2626' : '#166534'
                        }}>
                          {formatRs(sup.remainingPayable)}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '12px', color: 'var(--secondary)' }}>
                        {sup.bills.length} Bills • {sup.payments.length} Payments
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-sm"
                            onClick={() => openAddPayment(sup.name)}
                            style={{ backgroundColor: '#eff6ff', color: 'var(--primary)', fontWeight: 600 }}
                            title="Make Payment"
                          >
                            Pay
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => setSelectedSupplierLedger(sup)}
                            style={{ backgroundColor: '#f1f5f9', color: 'var(--text)' }}
                            title="View Full Ledger Statement"
                          >
                            <Eye size={14} /> Ledger
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {vehicleModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                {vehicleEditing ? 'Edit Vehicle' : 'Add New Vehicle'}
              </h3>
              <button onClick={() => setVehicleModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={saveVehicle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Vehicle Number <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LES-1234, T-402, KHI-9988"
                    value={vehicleForm.vehicleNumber}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, vehicleNumber: e.target.value })}
                    style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px', textTransform: 'uppercase', fontWeight: 700 }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Vehicle Type</label>
                    <input
                      type="text"
                      list="vehicle-types-list"
                      placeholder="e.g. 22-Wheeler Trailer"
                      value={vehicleForm.vehicleType}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, vehicleType: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px' }}
                    />
                    <datalist id="vehicle-types-list">
                      <option value="Trailer (22 Wheeler)" />
                      <option value="Trailer (10 Wheeler)" />
                      <option value="Flatbed Trailer" />
                      <option value="Bed Trailer" />
                      <option value="Mazda (6 Wheeler)" />
                      <option value="Container Carrier" />
                      <option value="Lowbed Trailer" />
                    </datalist>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Owner Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Haji Abid / Self"
                      value={vehicleForm.ownerName}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, ownerName: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Driver Name</label>
                    <input
                      type="text"
                      placeholder="Driver full name"
                      value={vehicleForm.driverName}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, driverName: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Driver Mobile</label>
                    <input
                      type="text"
                      placeholder="0300-1234567"
                      value={vehicleForm.driverMobile}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, driverMobile: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Engine Number</label>
                    <input
                      type="text"
                      placeholder="Optional"
                      value={vehicleForm.engineNumber}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, engineNumber: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Chassis Number</label>
                    <input
                      type="text"
                      placeholder="Optional"
                      value={vehicleForm.chassisNumber}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, chassisNumber: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Notes / Remarks</label>
                  <textarea
                    rows={2}
                    placeholder="Additional vehicle notes..."
                    value={vehicleForm.notes}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, notes: e.target.value })}
                    style={{ width: '100%', borderRadius: '6px', border: '1px solid var(--border)', padding: '8px 10px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setVehicleModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {vehicleEditing ? 'Update Vehicle' : 'Save Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tripModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                {tripEditing ? 'Edit Trip' : 'Add New Trip'}
              </h3>
              <button onClick={() => setTripModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={saveTrip}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Vehicle Number <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  {vehicles.length > 0 ? (
                    <select
                      required
                      value={tripForm.vehicleNumber}
                      onChange={(e) => setTripForm({ ...tripForm, vehicleNumber: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px', fontWeight: 700 }}
                    >
                      <option value="">-- Select Vehicle --</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.vehicleNumber}>
                          {v.vehicleNumber} ({v.driverName || 'No Driver'} - {v.vehicleType})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="Enter Vehicle Number"
                      value={tripForm.vehicleNumber}
                      onChange={(e) => setTripForm({ ...tripForm, vehicleNumber: e.target.value.toUpperCase() })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px', fontWeight: 700 }}
                    />
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>From Location</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Karachi"
                      value={tripForm.from}
                      onChange={(e) => setTripForm({ ...tripForm, from: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Destination</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Lahore / Islamabad"
                      value={tripForm.destination}
                      onChange={(e) => setTripForm({ ...tripForm, destination: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Trip Date</label>
                    <input
                      type="date"
                      required
                      value={tripForm.startDate}
                      onChange={(e) => setTripForm({ ...tripForm, startDate: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Return Date</label>
                    <input
                      type="date"
                      value={tripForm.returnDate}
                      onChange={(e) => {
                        const rDate = e.target.value;
                        const days = rDate ? calculateDays(tripForm.startDate, rDate) : tripForm.totalDays;
                        setTripForm({ ...tripForm, returnDate: rDate, totalDays: days });
                      }}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Total Days</label>
                    <input
                      type="number"
                      min="1"
                      value={tripForm.totalDays}
                      onChange={(e) => setTripForm({ ...tripForm, totalDays: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Weight (Tons / KG)</label>
                    <input
                      type="text"
                      placeholder="e.g. 35 Tons"
                      value={tripForm.weight}
                      onChange={(e) => setTripForm({ ...tripForm, weight: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Trip Status</label>
                    <select
                      value={tripForm.status}
                      onChange={(e) => setTripForm({ ...tripForm, status: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px', fontWeight: 600 }}
                    >
                      <option value="On Trip">On Trip (Active)</option>
                      <option value="Completed">Completed / Returned</option>
                    </select>
                  </div>
                </div>

                <div style={{ backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#166534' }}>
                        Going Freight (Rs.)
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={tripForm.goingFreight}
                        onChange={(e) => setTripForm({ ...tripForm, goingFreight: e.target.value })}
                        style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #86efac', padding: '0 10px', fontWeight: 700 }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#166534' }}>
                        Return Freight (Rs.)
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={tripForm.returnFreight}
                        onChange={(e) => setTripForm({ ...tripForm, returnFreight: e.target.value })}
                        style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #86efac', padding: '0 10px', fontWeight: 700 }}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#166534' }}>
                      Total Income (Going + Return):
                    </span>
                    <span style={{ fontSize: '17px', fontWeight: 900, color: '#15803d' }}>
                      {formatRs((parseFloat(tripForm.goingFreight) || 0) + (parseFloat(tripForm.returnFreight) || 0))}
                    </span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Trip Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Route details, party name, etc."
                    value={tripForm.notes}
                    onChange={(e) => setTripForm({ ...tripForm, notes: e.target.value })}
                    style={{ width: '100%', borderRadius: '6px', border: '1px solid var(--border)', padding: '8px 10px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setTripModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#059669' }}>
                  {tripEditing ? 'Update Trip' : 'Save Trip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {expenseModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                  {expenseEditing ? 'Edit Expense' : '+ Add Trip Expense'}
                </h3>
                {activeTripForExpense && (
                  <div style={{ fontSize: '12px', color: 'var(--secondary)' }}>
                    Vehicle: <b>{activeTripForExpense.vehicleNumber}</b> ({activeTripForExpense.from} to {activeTripForExpense.destination})
                  </div>
                )}
              </div>
              <button onClick={() => setExpenseModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={saveExpense}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Expense Name <span style={{ color: '#ef4444' }}>*</span> (Custom name, e.g. Engine Work, Toll, Advance)
                  </label>
                  <input
                    type="text"
                    required
                    list="common-expense-suggestions"
                    placeholder="e.g. Engine Work, Toll, Driver Advance, Fuel, Tyre Puncture"
                    value={expenseForm.expenseName}
                    onChange={(e) => setExpenseForm({ ...expenseForm, expenseName: e.target.value })}
                    style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px', fontWeight: 600 }}
                  />
                  <datalist id="common-expense-suggestions">
                    <option value="Fuel / Diesel" />
                    <option value="Engine Work" />
                    <option value="Toll Tax" />
                    <option value="Driver Advance" />
                    <option value="Tyre Puncture & Air" />
                    <option value="Police / Entry Kharcha" />
                    <option value="Loading / Labour" />
                    <option value="Oil Change" />
                    <option value="Driver Kharcha / Food" />
                  </datalist>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Amount (Rs.) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 50000"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px', fontWeight: 800, color: '#dc2626' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Expense Date</label>
                    <input
                      type="date"
                      required
                      value={expenseForm.date}
                      onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Supplier / Workshop (Optional)
                    </label>
                    <input
                      type="text"
                      list="supplier-names-list"
                      placeholder="e.g. Shell Pump, Ustad Aslam"
                      value={expenseForm.supplierName}
                      onChange={(e) => setExpenseForm({ ...expenseForm, supplierName: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px' }}
                    />
                    <datalist id="supplier-names-list">
                      {allSupplierNames.map(name => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Payment Status
                    </label>
                    <select
                      value={expenseForm.paymentType}
                      onChange={(e) => setExpenseForm({ ...expenseForm, paymentType: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px', fontWeight: 600 }}
                    >
                      <option value="Paid">Paid (Cash/Online)</option>
                      <option value="Credit">Credit (Udhar / Supplier Payable)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Notes</label>
                  <input
                    type="text"
                    placeholder="Optional notes..."
                    value={expenseForm.notes}
                    onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                    style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setExpenseModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {expenseEditing ? 'Update Expense' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {maintenanceModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {maintenanceEditing ? 'Edit Maintenance' : '+ Add Maintenance Work'}
              </h3>
              <button onClick={() => setMaintenanceModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={saveMaintenance}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Vehicle Number <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  {vehicles.length > 0 ? (
                    <select
                      required
                      value={maintenanceForm.vehicleNumber}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, vehicleNumber: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px', fontWeight: 700 }}
                    >
                      <option value="">-- Select Vehicle --</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.vehicleNumber}>{v.vehicleNumber} ({v.driverName || 'No Driver'})</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="Vehicle Number"
                      value={maintenanceForm.vehicleNumber}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, vehicleNumber: e.target.value.toUpperCase() })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px', fontWeight: 700 }}
                    />
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Work Name / Description <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="maintenance-suggestions"
                    placeholder="e.g. Engine Overhaul, Brake Shoe Change, Tyre Replacement"
                    value={maintenanceForm.workName}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, workName: e.target.value })}
                    style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px', fontWeight: 600 }}
                  />
                  <datalist id="maintenance-suggestions">
                    <option value="Engine Overhaul" />
                    <option value="Tyre Replacement" />
                    <option value="Oil & Filter Change" />
                    <option value="Brake Lining & Shoe" />
                    <option value="Suspension / Kamani Work" />
                    <option value="Battery Replacement" />
                    <option value="Radiator & Water Pump" />
                    <option value="Welding & Body Repair" />
                    <option value="Electrical Wiring & Lights" />
                  </datalist>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Amount (Rs.) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 75000"
                      value={maintenanceForm.amount}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, amount: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px', fontWeight: 800, color: '#dc2626' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Date</label>
                    <input
                      type="date"
                      required
                      value={maintenanceForm.date}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, date: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Workshop / Supplier (Optional)
                    </label>
                    <input
                      type="text"
                      list="supplier-names-list"
                      placeholder="e.g. Ustad Tariq Workshop"
                      value={maintenanceForm.supplierName}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, supplierName: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Payment Status</label>
                    <select
                      value={maintenanceForm.paymentType}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, paymentType: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px', fontWeight: 600 }}
                    >
                      <option value="Paid">Paid (Cash/Bank)</option>
                      <option value="Credit">Credit (Udhar / Supplier Payable)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Notes</label>
                  <input
                    type="text"
                    placeholder="Additional notes..."
                    value={maintenanceForm.notes}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })}
                    style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setMaintenanceModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#d97706' }}>
                  {maintenanceEditing ? 'Update Maintenance' : 'Save Maintenance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {paymentModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '460px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {paymentEditing ? 'Edit Payment' : '+ Add Supplier Payment'}
              </h3>
              <button onClick={() => setPaymentModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={savePayment}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Supplier Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="supplier-names-list"
                    placeholder="Enter or select supplier"
                    value={paymentForm.supplierName}
                    onChange={(e) => setPaymentForm({ ...paymentForm, supplierName: e.target.value })}
                    style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px', fontWeight: 700 }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Amount (Rs.) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 50000"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px', fontWeight: 800, color: '#059669' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Payment Date</label>
                    <input
                      type="date"
                      required
                      value={paymentForm.date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Payment Mode</label>
                  <select
                    value={paymentForm.paymentMode}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                    style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px' }}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer / Online</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Notes / Slip #</label>
                  <input
                    type="text"
                    placeholder="Cheque # or transaction slip details"
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid var(--border)', padding: '0 10px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setPaymentModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#059669' }}>
                  {paymentEditing ? 'Update Payment' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedSupplierLedger && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                  Supplier Statement: {selectedSupplierLedger.name}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--secondary)', marginTop: '2px' }}>
                  Credit bills and payments history
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-sm btn-secondary" onClick={handlePrint}>
                  <Printer size={14} /> Print
                </button>
                <button onClick={() => setSelectedSupplierLedger(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              backgroundColor: '#f8fafc',
              padding: '14px',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--secondary)', textTransform: 'uppercase' }}>Total Credit Bills</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#dc2626' }}>{formatRs(selectedSupplierLedger.totalBills)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--secondary)', textTransform: 'uppercase' }}>Total Payments Made</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#059669' }}>{formatRs(selectedSupplierLedger.totalPaid)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--secondary)', textTransform: 'uppercase' }}>Remaining Balance Payable</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: selectedSupplierLedger.remainingPayable > 0 ? '#dc2626' : '#059669' }}>
                  {formatRs(selectedSupplierLedger.remainingPayable)}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700 }}>Credit Bills / Expenses</h4>
              {selectedSupplierLedger.bills.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-light)', fontStyle: 'italic' }}>No credit bills recorded.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid var(--border-light)' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left', color: 'var(--secondary)' }}>
                      <th style={{ padding: '8px' }}>Date</th>
                      <th style={{ padding: '8px' }}>Category / Type</th>
                      <th style={{ padding: '8px' }}>Description / Work</th>
                      <th style={{ padding: '8px' }}>Reference</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSupplierLedger.bills.map(b => (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '8px' }}>{b.date}</td>
                        <td style={{ padding: '8px' }}>{b.type}</td>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{b.name}</td>
                        <td style={{ padding: '8px', color: 'var(--secondary)' }}>{b.reference}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{formatRs(b.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Payments Made to Supplier</h4>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    openAddPayment(selectedSupplierLedger.name);
                    setSelectedSupplierLedger(null);
                  }}
                  style={{ fontSize: '11px', padding: '2px 8px' }}
                >
                  + Add Payment
                </button>
              </div>
              {selectedSupplierLedger.payments.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-light)', fontStyle: 'italic' }}>No payments recorded yet.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid var(--border-light)' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left', color: 'var(--secondary)' }}>
                      <th style={{ padding: '8px' }}>Date</th>
                      <th style={{ padding: '8px' }}>Payment Mode</th>
                      <th style={{ padding: '8px' }}>Notes / Slip</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSupplierLedger.payments.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '8px' }}>{p.date}</td>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{p.paymentMode}</td>
                        <td style={{ padding: '8px', color: 'var(--secondary)' }}>{p.notes || '—'}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>{formatRs(p.amount)}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          <button
                            onClick={() => {
                              deletePayment(p);
                              setSelectedSupplierLedger(null);
                            }}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#dc2626' }}
                            title="Delete Payment"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedSupplierLedger(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
