import { useState, useEffect } from 'react';
import { MapPin, Plus, ArrowLeft, Save } from 'lucide-react';

const ACCOUNTS_KEY = 'islamabad_account_statement_accounts';
const TRANSACTIONS_KEY = 'islamabad_account_statement_transactions';

function loadAccounts() {
  try {
    const data = localStorage.getItem(ACCOUNTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function loadTransactions() {
  try {
    const data = localStorage.getItem(TRANSACTIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveTransactions(transactions) {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
}

const PENDING_LINK_KEY = 'islamabad_account_statement_pending_link';

function loadPendingLink() {
  try {
    const data = localStorage.getItem(PENDING_LINK_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function clearPendingLink() {
  localStorage.removeItem(PENDING_LINK_KEY);
}

export default function IslamabadAccountStatement() {
  const [accounts, setAccounts] = useState(loadAccounts);
  const [transactions, setTransactions] = useState(loadTransactions);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountForm, setAccountForm] = useState({
    name: '',
    address: '',
    cnic: '',
    ntn: '',
    opening_balance: ''
  });
  const [txnForm, setTxnForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    type: 'debit',
    amount: ''
  });
  const [editingTxnId, setEditingTxnId] = useState(null);
  const [editTxnForm, setEditTxnForm] = useState({
    date: '',
    description: '',
    type: 'debit',
    amount: ''
  });
  const [message, setMessage] = useState('');
  const [pendingLink, setPendingLink] = useState(loadPendingLink);

  useEffect(() => {
    saveAccounts(accounts);
  }, [accounts]);

  useEffect(() => {
    saveTransactions(transactions);
  }, [transactions]);

  const resetAccountForm = () => {
    setAccountForm({ name: '', address: '', cnic: '', ntn: '', opening_balance: '' });
    setShowAccountForm(false);
  };

  const handleAccountChange = (e) => {
    const { name, value } = e.target;
    setAccountForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAccountSubmit = (e) => {
    e.preventDefault();
    if (!accountForm.name.trim()) {
      setMessage('Account name is required.');
      return;
    }
    const proceed = window.confirm(`You are about to add a new account for ${accountForm.name}. Please confirm you have permission to create this account.`);
    if (!proceed) {
      setMessage('Account creation cancelled.');
      return;
    }
    const newAccount = {
      id: Date.now().toString(),
      name: accountForm.name.trim(),
      address: accountForm.address.trim(),
      cnic: accountForm.cnic.trim(),
      ntn: accountForm.ntn.trim(),
      opening_balance: parseFloat(accountForm.opening_balance || 0) || 0,
      created_at: new Date().toISOString()
    };
    setAccounts(prev => [...prev, newAccount]);
    resetAccountForm();
    setMessage(`Account for ${newAccount.name} created successfully.`);
  };

  const handleDeleteAccount = (account) => {
    const proceed = window.confirm(`Please confirm deleting this customer account.\n\nName: ${account.name}\nAddress: ${account.address || 'N/A'}\nPhone Number: ${account.cnic || 'N/A'}\n\nAll transactions for this account will also be deleted. This action cannot be undone.`);
    if (!proceed) {
      setMessage('Account deletion cancelled.');
      return;
    }
    setAccounts(prev => prev.filter(acc => acc.id !== account.id));
    setTransactions(prev => prev.filter(txn => txn.account_id !== account.id));
    setMessage(`Account for ${account.name} and all related transactions deleted successfully.`);
  };

  const handleLinkBillToAccount = (account) => {
    if (!pendingLink) {
      setMessage('No pending bill to link.');
      return;
    }
    const newTransaction = {
      id: Date.now().toString(),
      account_id: account.id,
      date: pendingLink.date,
      description: pendingLink.description,
      type: 'debit',
      amount: Number(pendingLink.total_amount) || 0,
      created_at: new Date().toISOString()
    };

    setTransactions(prev => [...prev, newTransaction]);
    setSelectedAccount(account);
    setPendingLink(null);
    clearPendingLink();
    setMessage(`Bill linked to ${account.name} successfully.`);
  };

  const handleTxnChange = (e) => {
    const { name, value } = e.target;
    setTxnForm(prev => ({ ...prev, [name]: value }));
  };

  const handleTxnSubmit = (e) => {
    e.preventDefault();
    if (!selectedAccount) return;
    if (!txnForm.description.trim() || !txnForm.amount) {
      setMessage('Please enter description and amount for the transaction.');
      return;
    }
    const proceed = window.confirm(`Please confirm adding this transaction to ${selectedAccount.name}.\n\nDescription: ${txnForm.description}\nType: ${txnForm.type}\nAmount: Rs. ${Number(txnForm.amount).toLocaleString()}`);
    if (!proceed) {
      setMessage('Transaction cancelled.');
      return;
    }
    const newTxn = {
      id: Date.now().toString(),
      account_id: selectedAccount.id,
      date: txnForm.date,
      description: txnForm.description.trim(),
      type: txnForm.type,
      amount: parseFloat(txnForm.amount) || 0,
      created_at: new Date().toISOString()
    };
    setTransactions(prev => [...prev, newTxn]);
    setTxnForm({ date: new Date().toISOString().split('T')[0], description: '', type: 'debit', amount: '' });
    setMessage('Transaction recorded successfully.');
  };

  const handleEditTransaction = (txn) => {
    setEditingTxnId(txn.id);
    setEditTxnForm({
      date: txn.date,
      description: txn.description,
      type: txn.type,
      amount: txn.amount.toString()
    });
  };

  const handleEditTxnChange = (e) => {
    const { name, value } = e.target;
    setEditTxnForm(prev => ({ ...prev, [name]: value }));
  };

  const handleEditTxnSubmit = () => {
    if (!editTxnForm.description.trim() || !editTxnForm.amount) {
      setMessage('Please enter description and amount.');
      return;
    }
    const proceed = window.confirm(`Please confirm updating this transaction.\n\nDescription: ${editTxnForm.description}\nType: ${editTxnForm.type}\nAmount: Rs. ${Number(editTxnForm.amount).toLocaleString()}`);
    if (!proceed) {
      setMessage('Update cancelled.');
      return;
    }
    setTransactions(prev =>
      prev.map(tx =>
        tx.id === editingTxnId
          ? { ...tx, date: editTxnForm.date, description: editTxnForm.description.trim(), type: editTxnForm.type, amount: parseFloat(editTxnForm.amount) }
          : tx
      )
    );
    setEditingTxnId(null);
    setMessage('Transaction updated successfully.');
  };

  const handleDeleteTransaction = (txn) => {
    const proceed = window.confirm(`Please confirm deleting this transaction.\n\nDescription: ${txn.description}\nType: ${txn.type}\nAmount: Rs. ${Number(txn.amount).toLocaleString()}\n\nThis action cannot be undone.`);
    if (!proceed) {
      setMessage('Delete cancelled.');
      return;
    }
    setTransactions(prev => prev.filter(tx => tx.id !== txn.id));
    setMessage('Transaction deleted successfully.');
  };

  const cancelEditTransaction = () => {
    setEditingTxnId(null);
  };

  const selectedTransactions = selectedAccount
    ? transactions
        .filter(tx => tx.account_id === selectedAccount.id)
        .sort((a, b) => new Date(a.date) - new Date(b.date) || a.created_at.localeCompare(b.created_at))
    : [];

  const computeLedgerRows = () => {
    const rows = [];
    let balance = selectedAccount ? selectedAccount.opening_balance : 0;
    rows.push({
      id: 'opening',
      date: '',
      description: 'Opening Balance',
      debit: selectedAccount ? selectedAccount.opening_balance : 0,
      credit: 0,
      balance
    });
    selectedTransactions.forEach(tx => {
      const debit = tx.type === 'debit' ? tx.amount : 0;
      const credit = tx.type === 'credit' ? tx.amount : 0;
      balance += debit;
      balance -= credit;
      rows.push({
        ...tx,
        debit,
        credit,
        balance
      });
    });
    return rows;
  };

  const ledgerRows = computeLedgerRows();
  const totalDebit = ledgerRows.reduce((sum, row) => sum + (row.debit || 0), 0);
  const totalCredit = ledgerRows.reduce((sum, row) => sum + (row.credit || 0), 0);
  const finalBalance = ledgerRows.length ? ledgerRows[ledgerRows.length - 1].balance : 0;

  const computeAccountClosingBalance = (accountId, openingBalance) => {
    const accountTxns = transactions
      .filter(tx => tx.account_id === accountId)
      .sort((a, b) => new Date(a.date) - new Date(b.date) || a.created_at.localeCompare(b.created_at));
    let balance = Number(openingBalance || 0);
    accountTxns.forEach(tx => {
      balance += tx.type === 'debit' ? tx.amount : 0;
      balance -= tx.type === 'credit' ? tx.amount : 0;
    });
    return balance;
  };

  const buildAccountsListPrintHtml = () => {
    const header = `
      <div style="padding: 18px 20px; background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%); color: #ffffff; border-radius: 14px 14px 0 0; text-align: center; margin-bottom: 18px; box-shadow: 0 6px 20px rgba(15, 23, 42, 0.14);">
        <div style="font-size:30px; font-weight:900; letter-spacing:2px; margin-bottom: 6px;">GUL-E-PAKISTAN GOODS</div>
        <div style="font-size:13px; opacity:0.92;">Islamabad Branch Account Statement</div>
      </div>`;

    const rowsHtml = accounts.map((account, index) => {
      const closingBalance = computeAccountClosingBalance(account.id, account.opening_balance);
      return `
        <tr style="background:${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding:12px 14px; border:1px solid #e2e8f0; font-size:11px; font-weight:700; color:#000;">${index + 1}</td>
          <td style="padding:12px 14px; border:1px solid #e2e8f0; font-size:11px; font-weight:700; color:#000;">${account.name}</td>
          <td style="padding:12px 14px; border:1px solid #e2e8f0; font-size:11px; font-weight:700; color:#000;">${account.address || '—'}</td>
          <td style="padding:12px 14px; border:1px solid #e2e8f0; font-size:11px; font-weight:700; color:#000;">${account.cnic || '—'}</td>
          <td style="padding:12px 14px; border:1px solid #e2e8f0; font-size:11px; font-weight:700; color:#000;">${account.ntn || '—'}</td>
          <td style="padding:12px 14px; border:1px solid #e2e8f0; font-size:11px; font-weight:700; color:#000; text-align:right;">Rs. ${Number(account.opening_balance || 0).toLocaleString()}</td>
          <td style="padding:12px 14px; border:1px solid #e2e8f0; font-size:11px; font-weight:700; color:#000; text-align:right;">Rs. ${closingBalance.toLocaleString()}</td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Islamabad Account Statements</title><style>
      html, body { margin: 0; padding: 0; background: #e2e8f0; }
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #000; }
      .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 16mm; background: #ffffff; box-sizing: border-box; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th { padding: 13px 12px; background: #0f172a; color: #ffffff; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
      td { padding: 12px 12px; border: 1px solid #e2e8f0; vertical-align: top; font-size: 11px; font-weight: 700; color: #000; }
      .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
      .summary-card { padding: 16px 18px; border-radius: 14px; background: #f8fafc; border: 1px solid #c7d2fe; }
      .summary-card strong { display: block; font-size: 10px; color: #000; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.8px; }
      .summary-card span { display: block; font-size: 18px; font-weight: 800; color: #000; }
      @page { size: A4; margin: 16mm; }
      @media print { html, body { background: #fff; color: #000; } .page { box-shadow: none; margin: 0; } td { color: #000 !important; font-weight: 700 !important; } th { color: #fff !important; } }
    </style></head><body>
      <div class="page">
        ${header}
        <div style="margin-bottom:16px; font-size:12px; color:#475569;">Total Accounts: ${accounts.length}</div>
        <table>
          <thead>
            <tr>
              <th style="width:5%;">#</th>
              <th style="width:20%;">Name</th>
              <th style="width:20%;">Address</th>
              <th style="width:15%;">Phone</th>
              <th style="width:15%;">NTN</th>
              <th style="width:12%; text-align:right;">Opening</th>
              <th style="width:13%; text-align:right;">Closing</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </body></html>`;
  };

  const printAccountsList = () => {
    const html = buildAccountsListPrintHtml();
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const buildPrintHtml = () => {
    const header = `
      <div style="padding: 18px 20px; background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%); color: #ffffff; border-radius: 14px 14px 0 0; text-align: center; margin-bottom: 18px; box-shadow: 0 6px 20px rgba(15, 23, 42, 0.14);">
        <div style="font-size:30px; font-weight:900; letter-spacing:2px; margin-bottom: 6px;">GUL-E-PAKISTAN GOODS</div>
        <div style="font-size:13px; opacity:0.92;">Islamabad Branch Account Statement</div>
      </div>`;

    const info = `
      <div style="display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; font-size:12px;">
        <div style="padding:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px;"><div style="font-weight:700; margin-bottom:6px; color:#0f172a; letter-spacing:0.3px;">Account Name</div><div style="font-weight:700; color:#000;">${selectedAccount.name}</div></div>
        <div style="padding:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px;"><div style="font-weight:700; margin-bottom:6px; color:#0f172a; letter-spacing:0.3px;">Address</div><div style="font-weight:700; color:#000;">${selectedAccount.address || '—'}</div></div>
        <div style="padding:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px;"><div style="font-weight:700; margin-bottom:6px; color:#0f172a; letter-spacing:0.3px;">Phone Number</div><div style="font-weight:700; color:#000;">${selectedAccount.cnic || '—'}</div></div>
        <div style="padding:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px;"><div style="font-weight:700; margin-bottom:6px; color:#0f172a; letter-spacing:0.3px;">NTN</div><div style="font-weight:700; color:#000;">${selectedAccount.ntn || '—'}</div></div>
      </div>`;

    const rowsHtml = ledgerRows.map((row, index) => `
        <tr style="background:${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding:12px 14px; border:1px solid #e2e8f0; font-size:11px; font-weight:700; color:#000;">${row.date || '-'}</td>
          <td style="padding:12px 14px; border:1px solid #e2e8f0; font-size:11px; font-weight:700; color:#000;">${row.description}</td>
          <td style="padding:12px 14px; border:1px solid #e2e8f0; font-size:11px; text-align:right; font-weight:700; color:#000;">Rs. ${Number(row.debit || 0).toLocaleString()}</td>
          <td style="padding:12px 14px; border:1px solid #e2e8f0; font-size:11px; text-align:right; font-weight:700; color:#000;">Rs. ${Number(row.credit || 0).toLocaleString()}</td>
          <td style="padding:12px 14px; border:1px solid #e2e8f0; font-size:11px; text-align:right; font-weight:700; color:#000;">Rs. ${Number(row.balance || 0).toLocaleString()}</td>
        </tr>`).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Account Statement - ${selectedAccount.name}</title><style>
      html, body { margin: 0; padding: 0; background: #e2e8f0; }
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #000; }
      .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 16mm; background: #ffffff; box-sizing: border-box; }
      .statement-info { margin-bottom: 18px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th { padding: 13px 12px; background: #0f172a; color: #ffffff; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
      td { padding: 12px 12px; border: 1px solid #e2e8f0; vertical-align: top; font-size: 11px; font-weight: 700; color: #000; }
      .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
      .summary-card { padding: 16px 18px; border-radius: 14px; background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%); border: 1px solid #c7d2fe; box-shadow: 0 10px 26px rgba(15, 23, 42, 0.08); }
      .summary-card strong { display: block; font-size: 10px; color: #000; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.8px; }
      .summary-card span { display: block; font-size: 18px; font-weight: 800; color: #000; }
      @page { size: A4; margin: 16mm; }
      @media print { html, body { background: #fff; color: #000; } .page { box-shadow: none; margin: 0; } td { color: #000 !important; font-weight: 700 !important; } th { color: #fff !important; } }
    </style></head><body>
      <div class="page">
        ${header}
        <div class="statement-info">${info}</div>
        <table>
          <thead>
            <tr>
              <th style="width:14%;">Date</th>
              <th style="width:42%;">Description</th>
              <th style="width:15%; text-align:right;">Debit</th>
              <th style="width:15%; text-align:right;">Credit</th>
              <th style="width:14%; text-align:right;">Balance</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="summary">
          <div class="summary-card"><strong>Total Debit</strong><span>Rs. ${totalDebit.toLocaleString()}</span></div>
          <div class="summary-card"><strong>Total Credit</strong><span>Rs. ${totalCredit.toLocaleString()}</span></div>
          <div class="summary-card"><strong>Closing Balance</strong><span>Rs. ${finalBalance.toLocaleString()}</span></div>
        </div>
      </div>
    </body></html>`;
  };

  const printAccountStatement = () => {
    if (!selectedAccount) return;
    const html = buildPrintHtml();
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const downloadAccountStatementPdf = async () => {
    if (!selectedAccount) return;
    try {
      const html = buildPrintHtml();
      const tempEl = document.createElement('div');
      tempEl.style.width = '210mm';
      tempEl.style.padding = '0';
      tempEl.innerHTML = html.replace(/^[\s\S]*?<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '');
      document.body.appendChild(tempEl);
      const { default: html2pdf } = await import('html2pdf.js');
      await html2pdf().set({
        filename: `${selectedAccount.name.replace(/\s+/g, '_') || 'Account'}_Statement.pdf`,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(tempEl).save();
      document.body.removeChild(tempEl);
    } catch (err) {
      console.error('PDF export failed:', err);
      setMessage(`PDF export failed: ${err.message || err}`);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <MapPin size={28} color="var(--primary-color)" />
        <h1 className="page-title" style={{ marginBottom: 0 }}>Islamabad Account Statement</h1>
      </div>

      {message && (
        <div style={{ padding: '12px', marginBottom: '20px', borderRadius: '6px', backgroundColor: message.includes('cancelled') ? '#fef3c7' : '#d1fae5', color: message.includes('cancelled') ? '#92400e' : '#065f46' }}>
          {message}
        </div>
      )}

      {!selectedAccount ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>Create customer accounts with Name, Address, Phone Number and NTN. Then open any account to see ledger detail.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowAccountForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Plus size={16} /> Add Customer Account</button>
          </div>

          {pendingLink && (
            <div className="card" style={{ marginBottom: '24px', border: '1px solid #f59e0b', backgroundColor: '#fffbeb' }}>
              <div style={{ marginBottom: '12px', fontWeight: 700, color: '#92400e' }}>Pending Bill Linking</div>
              <p style={{ margin: '0 0 8px', color: '#92400e' }}>A bill is ready to be linked to a customer account.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.95rem' }}>
                <div><strong>Bilty #</strong> {pendingLink.bilty_number}</div>
                <div><strong>Date</strong> {pendingLink.date}</div>
                <div style={{ gridColumn: '1 / -1' }}><strong>Total Amount</strong> Rs. {Number(pendingLink.total_amount).toLocaleString()}</div>
                <div style={{ gridColumn: '1 / -1' }}><strong>Description</strong> {pendingLink.description}</div>
              </div>
              <div style={{ marginTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" style={{ padding: '10px 16px' }} onClick={() => { clearPendingLink(); setPendingLink(null); setMessage('Pending bill link cleared.'); }}>Cancel Pending Link</button>
              </div>
            </div>
          )}

          {showAccountForm && (
            <div className="card" style={{ marginBottom: '24px' }}>
              <h2 style={{ marginTop: 0 }}>New Account</h2>
              <form onSubmit={handleAccountSubmit} className="form-grid">
                <div className="form-group"><label>Account Name</label><input type="text" name="name" value={accountForm.name} onChange={handleAccountChange} required /></div>
                <div className="form-group"><label>Address</label><input type="text" name="address" value={accountForm.address} onChange={handleAccountChange} /></div>
                <div className="form-group"><label>Phone Number</label><input type="text" name="cnic" value={accountForm.cnic} onChange={handleAccountChange} placeholder="0321-1234567" /></div>
                <div className="form-group"><label>NTN</label><input type="text" name="ntn" value={accountForm.ntn} onChange={handleAccountChange} placeholder="Enter NTN" /></div>
                <div className="form-group"><label>Opening Balance</label><input type="number" min="0" step="0.01" name="opening_balance" value={accountForm.opening_balance} onChange={handleAccountChange} /></div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Save size={16} /> Save Account</button>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={resetAccountForm}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0 }}>Customer Accounts</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{accounts.length} accounts</span>
                <button
                  className="btn btn-secondary"
                  onClick={printAccountsList}
                  style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  🖨️ Print List
                </button>
              </div>
            </div>
            {accounts.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No customer accounts found. Add a new account to begin.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ padding: '12px' }}>#</th>
                      <th style={{ padding: '12px' }}>Name</th>
                      <th style={{ padding: '12px' }}>Address</th>
                      <th style={{ padding: '12px' }}>Phone Number</th>
                      <th style={{ padding: '12px' }}>NTN</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>Opening Balance</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>Closing Balance</th>
                      <th style={{ padding: '12px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account, index) => {
                      const accountClosing = computeAccountClosingBalance(account.id, account.opening_balance);
                      return (
                        <tr key={account.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px' }}>{index + 1}</td>
                          <td style={{ padding: '12px', fontWeight: 700 }}>{account.name}</td>
                          <td style={{ padding: '12px' }}>{account.address || '—'}</td>
                          <td style={{ padding: '12px' }}>{account.cnic || '—'}</td>
                          <td style={{ padding: '12px' }}>{account.ntn || '—'}</td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>Rs. {Number(account.opening_balance || 0).toLocaleString()}</td>
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>Rs. {accountClosing.toLocaleString()}</td>
                          <td style={{ padding: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button className="btn btn-secondary" onClick={() => setSelectedAccount(account)} style={{ padding: '8px 12px' }}>Open Account</button>
                          {pendingLink && (
                            <button className="btn btn-primary" onClick={() => handleLinkBillToAccount(account)} style={{ padding: '8px 12px' }}>Link Bill</button>
                          )}
                          <button className="btn btn-secondary" onClick={() => handleDeleteAccount(account)} style={{ padding: '8px 12px', color: '#ef4444', borderColor: '#fecaca' }}>Delete</button>
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
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '18px' }}>
            <div>
              <button className="btn btn-secondary" onClick={() => setSelectedAccount(null)} style={{ marginBottom: '12px' }}><ArrowLeft size={16} /> Back to Accounts</button>
              <h2 style={{ margin: 0 }}>{selectedAccount.name}</h2>
              <div style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
                {selectedAccount.address || 'No address provided'}<br />
                Phone Number: {selectedAccount.cnic || '—'} | NTN: {selectedAccount.ntn || '—'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginLeft: 'auto' }}>
              <button className="btn btn-secondary" style={{ padding: '10px 16px' }} onClick={printAccountStatement}>Print</button>
              <button className="btn btn-secondary" style={{ padding: '10px 16px' }} onClick={printAccountsList}>Print List</button>
              <button className="btn btn-primary" style={{ padding: '10px 16px', backgroundColor: '#3b82f6', border: 'none' }} onClick={downloadAccountStatementPdf}>Download PDF</button>
            </div>
            {pendingLink && (
              <div className="card" style={{ marginBottom: '18px', border: '1px solid #f59e0b', backgroundColor: '#fffbeb', width: '100%' }}>
                <div style={{ marginBottom: '10px', fontWeight: 700, color: '#92400e' }}>Pending Bill Linking</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.95rem', marginBottom: '12px' }}>
                  <div><strong>Bilty #</strong> {pendingLink.bilty_number}</div>
                  <div><strong>Date</strong> {pendingLink.date}</div>
                  <div style={{ gridColumn: '1 / -1' }}><strong>Total Amount</strong> Rs. {Number(pendingLink.total_amount).toLocaleString()}</div>
                  <div style={{ gridColumn: '1 / -1' }}><strong>Description</strong> {pendingLink.description}</div>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" style={{ padding: '10px 16px' }} onClick={() => handleLinkBillToAccount(selectedAccount)}>Link to {selectedAccount.name}</button>
                  <button className="btn btn-secondary" style={{ padding: '10px 16px' }} onClick={() => { clearPendingLink(); setPendingLink(null); setMessage('Pending bill link cleared.'); }}>Cancel Pending Link</button>
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))', gap: '12px', width: '100%', maxWidth: '680px' }}>
              <div className="stat-card" style={{ padding: '14px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '6px' }}>Opening Balance</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>Rs. {Number(selectedAccount.opening_balance || 0).toLocaleString()}</div>
              </div>
              <div className="stat-card" style={{ padding: '14px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '6px' }}>Closing Balance</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{finalBalance >= 0 ? 'Rs. ' : '-Rs. '}{Math.abs(finalBalance).toLocaleString()}</div>
              </div>
              <div className="stat-card" style={{ padding: '14px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '6px' }}>Total Debit</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ef4444' }}>Rs. {totalDebit.toLocaleString()}</div>
              </div>
              <div className="stat-card" style={{ padding: '14px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '6px' }}>Total Credit</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981' }}>Rs. {totalCredit.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ marginTop: 0 }}>Transaction Ledger</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '12px' }}>Date</th>
                    <th style={{ padding: '12px' }}>Description</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Debit</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Credit</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Balance</th>
                    <th style={{ padding: '12px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerRows.map(row => (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px' }}>{row.date || '-'}</td>
                      <td style={{ padding: '12px' }}>{row.description}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>Rs. {Number(row.debit || 0).toLocaleString()}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>Rs. {Number(row.credit || 0).toLocaleString()}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>Rs. {Number(row.balance || 0).toLocaleString()}</td>
                      <td style={{ padding: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {row.id !== 'opening' && (
                          <>
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleEditTransaction(row)}
                              style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleDeleteTransaction(row)}
                              style={{ padding: '6px 10px', fontSize: '0.85rem', color: '#ef4444', borderColor: '#fecaca' }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '24px', marginTop: '16px', fontWeight: 700 }}>
              <div>Total Debit: Rs. {totalDebit.toLocaleString()}</div>
              <div>Total Credit: Rs. {totalCredit.toLocaleString()}</div>
              <div>Closing Balance: Rs. {finalBalance.toLocaleString()}</div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Add Transaction</h3>
            <form onSubmit={handleTxnSubmit} className="form-grid">
              <div className="form-group"><label>Date</label><input type="date" name="date" value={txnForm.date} onChange={handleTxnChange} required /></div>
              <div className="form-group"><label>Description</label><input type="text" name="description" value={txnForm.description} onChange={handleTxnChange} required placeholder="Enter transaction description" /></div>
              <div className="form-group"><label>Type</label><select name="type" value={txnForm.type} onChange={handleTxnChange} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ccc' }}>
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select></div>
              <div className="form-group"><label>Amount</label><input type="number" min="0" step="0.01" name="amount" value={txnForm.amount} onChange={handleTxnChange} required /></div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Transaction</button>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setSelectedAccount(null)}>Close Account</button>
              </div>
            </form>
          </div>

          {editingTxnId && (
            <div className="card" style={{ marginBottom: '24px', border: '2px solid #3b82f6', backgroundColor: '#eff6ff' }}>
              <h3 style={{ marginTop: 0, color: '#1e40af' }}>Edit Transaction</h3>
              <div className="form-grid">
                <div className="form-group"><label>Date</label><input type="date" name="date" value={editTxnForm.date} onChange={handleEditTxnChange} /></div>
                <div className="form-group"><label>Description</label><input type="text" name="description" value={editTxnForm.description} onChange={handleEditTxnChange} /></div>
                <div className="form-group"><label>Type</label><select name="type" value={editTxnForm.type} onChange={handleEditTxnChange} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ccc' }}>
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                </select></div>
                <div className="form-group"><label>Amount</label><input type="number" min="0" step="0.01" name="amount" value={editTxnForm.amount} onChange={handleEditTxnChange} /></div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button type="button" className="btn btn-primary" style={{ flex: 1, backgroundColor: '#3b82f6' }} onClick={handleEditTxnSubmit}>Save Changes</button>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={cancelEditTransaction}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
