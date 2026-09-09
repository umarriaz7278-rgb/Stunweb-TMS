import { useState, useEffect } from 'react';
import { Truck, Plus, Edit, Trash2, X, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'ftl_brokers';

function loadBrokers() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveBrokers(brokers) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(brokers));
}

export default function BrokerManagementFTL() {
  const navigate = useNavigate();
  const [brokers, setBrokers] = useState(loadBrokers);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    fullName: '',
    address: '',
    cnic: '',
    phone: '',
    ntn: '',
  });

  useEffect(() => {
    saveBrokers(brokers);
  }, [brokers]);

  const resetForm = () => {
    setForm({ fullName: '', address: '', cnic: '', phone: '', ntn: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingId) {
      setBrokers(prev => prev.map(b => b.id === editingId ? { ...b, ...form } : b));
    } else {
      setBrokers(prev => [...prev, { id: Date.now().toString(), ...form }]);
    }
    resetForm();
  };

  const handleEdit = (broker) => {
    setForm({
      fullName: broker.fullName,
      address: broker.address,
      cnic: broker.cnic,
      phone: broker.phone,
      ntn: broker.ntn,
    });
    setEditingId(broker.id);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this broker?')) {
      setBrokers(prev => prev.filter(b => b.id !== id));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Truck size={28} color="var(--primary-color)" />
        <h1 className="page-title" style={{ marginBottom: 0 }}>Broker Management (FTL)</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/container-transport-ftl')} style={{ marginLeft: 'auto', fontSize: '0.85rem', padding: '6px 16px' }}>← Back</button>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>All Brokers</h2>
          <button
            className="btn btn-primary"
            onClick={() => { resetForm(); setShowForm(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={18} /> Add Broker
          </button>
        </div>

        {showForm && (
          <div className="modal-overlay" style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)'
          }}>
            <div className="card" style={{ width: '480px', padding: '24px', animation: 'fadeIn 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>{editingId ? 'Edit Broker' : 'Add New Broker'}</h3>
                <button className="btn-icon" onClick={resetForm}><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label>Full Name *</label>
                  <input type="text" name="fullName" value={form.fullName} onChange={handleChange} required placeholder="Enter full name" />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input type="text" name="address" value={form.address} onChange={handleChange} placeholder="Enter address" />
                </div>
                <div className="form-group">
                  <label>CNIC Number</label>
                  <input type="text" name="cnic" value={form.cnic} onChange={handleChange} placeholder="e.g. 42101-1234567-1" maxLength={15} />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input type="text" name="phone" value={form.phone} onChange={handleChange} placeholder="e.g. 0300-1234567" />
                </div>
                <div className="form-group">
                  <label>NTN Number</label>
                  <input type="text" name="ntn" value={form.ntn} onChange={handleChange} placeholder="Enter NTN number" />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Save size={16} /> {editingId ? 'Update Broker' : 'Save Broker'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={resetForm} style={{ flex: 1 }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {brokers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            No brokers added yet. Click "Add Broker" to get started.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Full Name</th>
                  <th>Address</th>
                  <th>CNIC Number</th>
                  <th>Phone Number</th>
                  <th>NTN Number</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {brokers.map((broker, index) => (
                  <tr key={broker.id}>
                    <td>{index + 1}</td>
                    <td style={{ fontWeight: 600 }}>{broker.fullName}</td>
                    <td>{broker.address || '—'}</td>
                    <td>{broker.cnic || '—'}</td>
                    <td>{broker.phone || '—'}</td>
                    <td>{broker.ntn || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }} onClick={() => handleEdit(broker)}>
                          <Edit size={14} /> Edit
                        </button>
                        <button className="btn" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }} onClick={() => handleDelete(broker.id)}>
                          <Trash2 size={14} /> Delete
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
}
