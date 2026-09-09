import { Truck, Users, Route as RouteIcon, DollarSign, FileText, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ContainerTransportFTL() {
  const navigate = useNavigate();

  const cards = [
    {
      title: 'Broker Management (FTL)',
      description: 'Add, edit, and manage broker profiles including CNIC, phone, NTN, and address details.',
      icon: Users,
      color: '#6366f1',
      path: '/container-transport-ftl/broker-management',
    },
    {
      title: 'Trips Management',
      description: 'Manage daily trips, track bilty fares, vehicle fares, expenses, and calculate gross & net profit.',
      icon: RouteIcon,
      color: '#10b981',
      path: '/container-transport-ftl/trips-management',
    },
    {
      title: 'Broker Accounts',
      description: 'View broker-wise profit ledger, track payments received, and monitor pending balances.',
      icon: DollarSign,
      color: '#f59e0b',
      path: '/container-transport-ftl/broker-accounts',
    },
    {
      title: 'Booking Receipt',
      description: 'Create and manage booking receipts with full shipment details, freight, container info, and GD number.',
      icon: FileText,
      color: '#e11d48',
      path: '/container-transport-ftl/booking-receipt',
    },
    {
      title: 'All Booking Receipts',
      description: 'View all saved booking receipts with full details, search by receipt number, sender, or destination.',
      icon: BookOpen,
      color: '#0891b2',
      path: '/container-transport-ftl/all-booking-receipts',
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <Truck size={28} color="var(--primary-color)" />
        <h1 className="page-title" style={{ marginBottom: 0 }}>Container Transport (FTL)</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="card"
              onClick={() => navigate(card.path)}
              style={{
                cursor: 'pointer',
                padding: '32px',
                borderLeft: `5px solid ${card.color}`,
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <div style={{ background: card.color + '18', borderRadius: '12px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={28} color={card.color} />
                </div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{card.title}</h2>
              </div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>{card.description}</p>
              <div style={{ marginTop: '20px', color: card.color, fontWeight: 600, fontSize: '0.85rem' }}>{'Open →'}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
