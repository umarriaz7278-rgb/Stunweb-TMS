import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import './App.css';

// ─── Lazy-loaded pages ──────────────────────────────────────────────────────
const Dashboard                = lazy(() => import('./pages/Dashboard'));
const BiltyCreate              = lazy(() => import('./pages/BiltyCreate'));
const Warehouse                = lazy(() => import('./pages/Warehouse'));
const ChallanCreate            = lazy(() => import('./pages/ChallanCreate'));
const AllChallanRecord         = lazy(() => import('./pages/AllChallanRecord'));
const BranchOffice             = lazy(() => import('./pages/BranchOffice'));
const Claims                   = lazy(() => import('./pages/Claims'));
const KarachiLedger            = lazy(() => import('./pages/KarachiLedger'));
const FinanceDashboard         = lazy(() => import('./pages/FinanceDashboard'));
const LocalFreightParties      = lazy(() => import('./pages/LocalFreightParties'));
const WarehouseRentals         = lazy(() => import('./pages/WarehouseRentals/WarehouseRentals'));
const BranchFinance            = lazy(() => import('./pages/BranchFinance'));
const IslamabadAccountStatement= lazy(() => import('./pages/IslamabadAccountStatement'));
const VehicleManagement        = lazy(() => import('./pages/VehicleManagement'));
const ContainerTransportFTL    = lazy(() => import('./pages/ContainerTransportFTL'));
const BrokerManagementFTL      = lazy(() => import('./pages/BrokerManagementFTL'));
const TripsManagementFTL       = lazy(() => import('./pages/TripsManagementFTL'));
const BrokerAccountsFTL        = lazy(() => import('./pages/BrokerAccountsFTL'));
const BranchesAudit            = lazy(() => import('./pages/BranchesAudit'));
const BookingReceipt           = lazy(() => import('./pages/BookingReceipt'));
const AllBookingReceipts       = lazy(() => import('./pages/AllBookingReceipts'));
const AllBookingRecord         = lazy(() => import('./pages/AllBookingRecord'));
const CommissionReportIslamabad= lazy(() => import('./pages/CommissionReportIslamabad'));
const ProfitReportIslamabad    = lazy(() => import('./pages/ProfitReportIslamabad'));
const BrokerReceivable         = lazy(() => import('./pages/BrokerReceivable'));
const ProfitReportLahore       = lazy(() => import('./pages/ProfitReportLahore'));
const BrokerReceivableLahore   = lazy(() => import('./pages/BrokerReceivableLahore'));
const ProfitReportRawalpindi   = lazy(() => import('./pages/ProfitReportRawalpindi'));
const BrokerReceivableRawalpindi= lazy(() => import('./pages/BrokerReceivableRawalpindi'));
const BrokerLedger             = lazy(() => import('./pages/BrokerLedger'));
const Settings                 = lazy(() => import('./pages/Settings'));
const BranchDeliveryReport     = lazy(() => import('./pages/BranchDeliveryReport'));
const BranchReceivable         = lazy(() => import('./pages/BranchReceivable'));
const BranchBrokerAC           = lazy(() => import('./pages/BranchBrokerAC'));
const BranchAccountStatement   = lazy(() => import('./pages/BranchAccountStatement'));
import { useSettings } from './context/SettingsContext';


// ─── Page Loader ─────────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="page-loader">
      <div className="spinner" />
    </div>
  );
}

// ─── Sidebar nav definition ──────────────────────────────────────────────────
const NAV_ITEMS = [
  { path: '/',                    icon: '📊', label: 'Dashboard' },
  { path: '/bilty',               icon: '📝', label: 'Bilty Booking' },
  { path: '/bilty/all-records',   icon: '📋', label: 'All Booking Records' },
  { path: '/warehouse',           icon: '🏬', label: 'Karachi Warehouse' },
  { path: '/challan',             icon: '🚚', label: 'Challan Management' },
  { path: '/challan/all-records', icon: '📜', label: 'Challan History' },
  { divider: true },
  { path: '/karachi-office',      icon: '💵', label: 'Income/Expense Ledger' },
  { divider: true },
  { section: 'Branches & Accounts' },
  {
    key: 'islamabad',
    label: 'Islamabad Branch',
    icon: '🏛️',
    children: [
      { path: '/branch/islamabad',                   icon: '📋', label: 'Branch Overview' },
      { path: '/branch/islamabad/finance',           icon: '💵', label: 'Branch Finance' },
      { path: '/branch/islamabad/account-statement', icon: '📄', label: 'Account Statement' },
      { path: '/commission-report-islamabad',        icon: '💼', label: 'Delivery Report ISB' },
      { path: '/profit-report-islamabad',            icon: '📈', label: 'A/C Receivable ISB' },
      { path: '/broker-receivable',                  icon: '🤝', label: 'Broker A/C ISB' },
    ]
  },
  { divider: true },
  { section: 'Operations' },
  { path: '/warehouse-rentals',          icon: '📦', label: 'Warehouse Rentals' },
  { path: '/local-freight-parties',      icon: '🚛', label: 'Local Freight Parties' },
  { path: '/container-transport-ftl',    icon: '🏗️', label: 'Container Transport (FTL)' },
  { path: '/claims',                     icon: '⚠️', label: 'Short Claims' },
  { path: '/branches-audit',            icon: '🔍', label: 'Branches Audit' },
  { divider: true },
  { section: 'Admin' },
  { path: '/vehicle-management',         icon: '🚗', label: 'Vehicle Management' },
  { path: '/finance',                    icon: '💾', label: 'Finance Overview' },
  { path: '/settings',                   icon: '⚙️', label: 'Settings' },
];

// ─── Page title map ──────────────────────────────────────────────────────────
const PAGE_TITLES = {
  '/':                             'Dashboard',
  '/bilty':                        'Bilty Booking',
  '/bilty/all-records':            'All Booking Records',
  '/warehouse':                    'Karachi Warehouse',
  '/challan':                      'Challan Management',
  '/challan/all-records':          'Challan History',
  '/karachi-office':               'Income / Expense Ledger',
  '/branch/islamabad':             'Islamabad Branch Overview',
  '/branch/islamabad/finance':     'Islamabad Branch Finance',
  '/branch/islamabad/account-statement': 'Islamabad Account Statement',
  '/profit-report-islamabad':      'A/C Receivable — Islamabad',
  '/commission-report-islamabad':  'Delivery Report — Islamabad',
  '/broker-receivable':            'Broker A/C — Islamabad',
  '/warehouse-rentals':            'Warehouse Rentals',
  '/local-freight-parties':        'Local Freight Parties',
  '/container-transport-ftl':      'Container Transport (FTL)',
  '/claims':                       'Short Claims',
  '/branches-audit':               'Branches Audit',
  '/vehicle-management':           'Vehicle Management',
  '/finance':                      'Finance Overview',
  '/settings':                     'System Settings',
};

function getPageTitle(pathname, defaultCompany = 'ABID MEHMOOD') {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  for (const [key, val] of Object.entries(PAGE_TITLES)) {
    if (key !== '/' && pathname.startsWith(key)) return val;
  }
  return `${defaultCompany} — Goods Transport`;
}

function formatDate(date) {
  return date.toLocaleDateString('en-PK', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const location = useLocation();
  const { companyName, companySubtitle } = useSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({
    islamabad: true,
  });

  // Custom branches (user-created via Settings, excludes built-in ISB/Karachi)
  const BUILTIN_BRANCHES = ['islamabad', 'karachi'];
  const [customBranches, setCustomBranches] = useState([]);

  useEffect(() => {
    async function loadCustomBranches() {
      const { supabase: sb } = await import('./supabaseClient');
      const { data } = await sb.from('branches').select('*').order('name');
      if (data) {
        const custom = data.filter(b => !BUILTIN_BRANCHES.includes(b.name.toLowerCase()));
        setCustomBranches(custom);
        // Auto-expand newly added branch groups
        if (custom.length > 0) {
          setOpenGroups(prev => {
            const next = { ...prev };
            custom.forEach(b => { next[b.name.toLowerCase()] = true; });
            return next;
          });
        }
      }
    }
    loadCustomBranches();
  }, []);



  const toggleGroup = (key) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Close sidebar whenever the route changes (mobile nav)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Auto expand group if child is active
  useEffect(() => {
    NAV_ITEMS.forEach(item => {
      if (item.children) {
        const hasActive = item.children.some(c => location.pathname === c.path);
        if (hasActive) {
          setOpenGroups(prev => ({ ...prev, [item.key]: true }));
        }
      }
    });
  }, [location.pathname]);

  // Toggle body scroll lock when sidebar is open on mobile
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const pageTitle = getPageTitle(location.pathname, companyName);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <>
      {/* ── Sidebar ── */}
      <div className={`sidebar${sidebarOpen ? ' active' : ''}`}>
        <div className="sidebar-header">
          <h2>{companyName}</h2>
          <p>{companySubtitle}</p>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item, idx) => {
            if (item.divider) {
              return <div key={`div-${idx}`} className="nav-divider" />;
            }
            if (item.section) {
              return (
                <div key={`sec-${idx}`} className="nav-section-title">
                  {item.section}
                </div>
              );
            }

            // Collapsible branch group with subpages
            if (item.children) {
              const isOpen = openGroups[item.key];
              const isGroupActive = item.children.some(c => location.pathname === c.path);

              return (
                <div key={`grp-${item.key}`} style={{ marginBottom: '2px' }}>
                  <div
                    className={`nav-group-header${isGroupActive ? ' active' : ''}`}
                    onClick={() => toggleGroup(item.key)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '15px' }}>{item.icon}</span>
                      <span style={{ fontWeight: 600 }}>{item.label}</span>
                    </div>
                    <span className={`nav-group-arrow${isOpen ? ' open' : ''}`}>▶</span>
                  </div>

                  {isOpen && (
                    <div className="nav-sub-menu">
                      {item.children.map(child => {
                        const childActive = location.pathname === child.path;
                        return (
                          <Link
                            key={child.path}
                            to={child.path}
                            className={`nav-sub-item${childActive ? ' active' : ''}`}
                          >
                            <i>{child.icon}</i>
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item${isActive(item.path) ? ' active' : ''}`}
              >
                <i>{item.icon}</i>
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* ── Dynamic Custom Branches (user-created) ── */}
          {customBranches.map(branch => {
            const slug = branch.name.toLowerCase();
            const children = [
              { path: `/branch/${slug}`,                     icon: '📋', label: 'Branch Overview' },
              { path: `/branch/${slug}/finance`,             icon: '💵', label: 'Branch Finance' },
              { path: `/branch/${slug}/account-statement`,   icon: '📄', label: 'Account Statement' },
              { path: `/delivery-report/${slug}`,            icon: '💼', label: `Delivery Report` },
              { path: `/receivable/${slug}`,                 icon: '📈', label: `A/C Receivable` },
              { path: `/broker-ac/${slug}`,                  icon: '🤝', label: `Broker A/C` },
            ];
            const isOpen = openGroups[slug] !== false;
            const isGroupActive = children.some(c => location.pathname === c.path);
            return (
              <div key={`grp-${slug}`} style={{ marginBottom: '2px' }}>
                <div
                  className={`nav-group-header${isGroupActive ? ' active' : ''}`}
                  onClick={() => toggleGroup(slug)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '15px' }}>🏢</span>
                    <span style={{ fontWeight: 600 }}>{branch.name} Branch</span>
                  </div>
                  <span className={`nav-group-arrow${isOpen ? ' open' : ''}`}>▶</span>
                </div>
                {isOpen && (
                  <div className="nav-sub-menu">
                    {children.map(child => {
                      const childActive = location.pathname === child.path;
                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          className={`nav-sub-item${childActive ? ' active' : ''}`}
                        >
                          <i>{child.icon}</i>
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User pill */}
        <div className="sidebar-user">
          <div className="user-avatar">A</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              color: '#fff',
              fontSize: '12px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              Admin User
            </div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>
              Administrator
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile overlay ── */}
      <div
        className={`overlay${sidebarOpen ? ' active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── Top Header ── */}
      <header className="main-header">
        <div className="header-left">
          <button
            className="menu-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            ☰
          </button>
          <div className="header-title">
            <h1>{pageTitle}</h1>
          </div>
        </div>
        <div className="header-right">
          <span className="header-date">{formatDate(new Date())}</span>
          <span style={{ color: 'var(--secondary)', fontSize: '12px', fontWeight: 500 }}>
            👤 Admin
          </span>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="main-content">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"                                        element={<Dashboard />} />
            <Route path="/bilty"                                   element={<BiltyCreate />} />
            <Route path="/bilty/all-records"                       element={<AllBookingRecord />} />
            <Route path="/warehouse"                               element={<Warehouse />} />
            <Route path="/challan"                                 element={<ChallanCreate />} />
            <Route path="/challan/all-records"                     element={<AllChallanRecord />} />
            <Route path="/branch/lahore"                           element={<BranchOffice branchName="Lahore" />} />
            <Route path="/branch/lahore/finance"                   element={<BranchFinance branchName="Lahore" />} />
            <Route path="/branch/islamabad"                        element={<BranchOffice branchName="Islamabad" />} />
            <Route path="/branch/islamabad/finance"                element={<BranchFinance branchName="Islamabad" />} />
            <Route path="/branch/islamabad/account-statement"      element={<IslamabadAccountStatement />} />
            <Route path="/branch/rawalpindi"                       element={<BranchOffice branchName="Rawalpindi" />} />
            <Route path="/branch/rawalpindi/finance"               element={<BranchFinance branchName="Rawalpindi" />} />
            <Route path="/claims"                                  element={<Claims />} />
            <Route path="/branches-audit"                          element={<BranchesAudit />} />
            <Route path="/karachi-office"                          element={<KarachiLedger />} />
            <Route path="/finance"                                 element={<FinanceDashboard />} />
            <Route path="/local-freight-parties"                   element={<LocalFreightParties />} />
            <Route path="/warehouse-rentals"                       element={<WarehouseRentals />} />
            <Route path="/vehicle-management"                      element={<VehicleManagement />} />
            <Route path="/container-transport-ftl"                 element={<ContainerTransportFTL />} />
            <Route path="/container-transport-ftl/broker-management" element={<BrokerManagementFTL />} />
            <Route path="/container-transport-ftl/trips-management"  element={<TripsManagementFTL />} />
            <Route path="/container-transport-ftl/broker-accounts"   element={<BrokerAccountsFTL />} />
            <Route path="/container-transport-ftl/booking-receipt"   element={<BookingReceipt />} />
            <Route path="/container-transport-ftl/all-booking-receipts" element={<AllBookingReceipts />} />
            <Route path="/commission-report-islamabad"             element={<CommissionReportIslamabad />} />
            <Route path="/profit-report-islamabad"                 element={<ProfitReportIslamabad />} />
            <Route path="/profit-report-lahore"                    element={<ProfitReportLahore />} />
            <Route path="/profit-report-rawalpindi"                element={<ProfitReportRawalpindi />} />
            <Route path="/broker-receivable"                       element={<BrokerReceivable />} />
            <Route path="/broker-receivable-lahore"                element={<BrokerReceivableLahore />} />
            <Route path="/broker-receivable-rawalpindi"            element={<BrokerReceivableRawalpindi />} />
            <Route path="/broker-ledger"                           element={<BrokerLedger />} />
            <Route path="/settings"                                element={<Settings />} />

            {/* ── Dynamic Routes for Custom Branches ── */}
            {customBranches.map(branch => {
              const slug = branch.name.toLowerCase();
              return [
                <Route key={`${slug}-overview`}   path={`/branch/${slug}`}                   element={<BranchOffice branchName={branch.name} />} />,
                <Route key={`${slug}-finance`}    path={`/branch/${slug}/finance`}           element={<BranchFinance branchName={branch.name} />} />,
                <Route key={`${slug}-acstmt`}     path={`/branch/${slug}/account-statement`} element={<BranchAccountStatement branchName={branch.name} />} />,
                <Route key={`${slug}-delivery`}   path={`/delivery-report/${slug}`}          element={<BranchDeliveryReport branchName={branch.name} />} />,
                <Route key={`${slug}-receivable`} path={`/receivable/${slug}`}               element={<BranchReceivable branchName={branch.name} />} />,
                <Route key={`${slug}-broker`}     path={`/broker-ac/${slug}`}                element={<BranchBrokerAC branchName={branch.name} />} />,
              ];
            })}

            <Route path="*" element={
              <div className="card">
                <div className="card-header">
                  <h3>🚧 Coming Soon</h3>
                </div>
                <p style={{ color: 'var(--text-light)', fontSize: '13px' }}>
                  This module is under development as part of the Goods Transport System.
                </p>
              </div>
            } />
          </Routes>

        </Suspense>
      </main>
    </>
  );
}
