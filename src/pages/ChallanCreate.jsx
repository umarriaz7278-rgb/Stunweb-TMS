import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useSettings } from '../context/SettingsContext';
import { Truck } from 'lucide-react';
import { applyTenantFilter, withTenantId, getScopedKey, getCurrentTenantId, getTenantItem } from '../utils/tenantStorage';

export default function ChallanCreate() {
  const { challanHeaderUrl, primaryBranchName } = useSettings();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [savedChallan, setSavedChallan] = useState(null);

  // Branch filter (not printed)
  const [selectedBranch, setSelectedBranch] = useState('');

  // DB brokers (e.g. from islamabad_brokers)
  const [dbBrokers, setDbBrokers] = useState([]);

  // Manual Mode Switch: Auto (From Warehouse) vs Manual Challan
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualForm, setManualForm] = useState({
    rent_amount: '',
    local_fare: '',
    loading: ''
  });

  // Form Fields
  const [formData, setFormData] = useState({
    vehicle_number: '',
    route_number: '',
    broker_name: '',
    driver_name: '',
    commission_deduction: 0,
    vehicle_freight: 0,
    branch_deposit: 0
  });

  // Commission percentage state
  const [commissionPct, setCommissionPct] = useState('');

  // Challan Date
  const [challanDate, setChallanDate] = useState(new Date().toISOString().split('T')[0]);

  // Selected Bilties: { bilty_id: { loaded_quantity, total_amount, remaining_quantity } }
  const [selectedBilties, setSelectedBilties] = useState({});

  // Store bilty charges keyed by bilty id
  const [biltyCharges, setBiltyCharges] = useState({});

  // All dispatch branches (loaded from Supabase, excluding Karachi)
  const [allBranches, setAllBranches] = useState([primaryBranchName || 'Islamabad']);
  const [nextChallanNumber, setNextChallanNumber] = useState(null);

  async function fetchNextChallanNumber() {
    try {
      let q = supabase
        .from('challans')
        .select('challan_number')
        .order('challan_number', { ascending: false })
        .limit(1);
      q = applyTenantFilter(q);
      const { data, error } = await q;
      if (!error && data && data.length > 0 && typeof data[0].challan_number === 'number') {
        const nextNum = data[0].challan_number + 1;
        setNextChallanNumber(nextNum);
        return nextNum;
      }
      setNextChallanNumber(1);
      return 1;
    } catch (e) {
      console.error('Error fetching next tenant challan number:', e);
      setNextChallanNumber(1);
      return 1;
    }
  }

  useEffect(() => {
    async function fetchDbBrokers() {
      try {
        let q = supabase.from('islamabad_brokers').select('*');
        q = applyTenantFilter(q);
        const { data, error } = await q;
        if (!error && data) setDbBrokers(data);
      } catch (e) {}
    }
    fetchDbBrokers();
    fetchNextChallanNumber();
  }, []);

  const getBranchBrokers = (branch) => {
    const list = [];
    const bTarget = (branch || '').trim().toLowerCase();
    const isTenantActive = () => {
      const t = getCurrentTenantId();
      return t && t !== 'master' && t !== 'guest';
    };

    const loadFromKey = (k) => {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) list.push(...parsed);
        }
      } catch {}
    };

    if (bTarget) {
      if (isTenantActive()) {
        loadFromKey(getScopedKey(`${bTarget}_broker_accounts`));
      } else {
        loadFromKey(`${bTarget}_broker_accounts`);
      }

      const prim = (primaryBranchName || 'Islamabad').trim().toLowerCase();
      if (bTarget === prim || bTarget === 'islamabad') {
        if (isTenantActive()) {
          loadFromKey(getScopedKey('islamabad_broker_accounts'));
        } else {
          loadFromKey('islamabad_broker_accounts');
        }
        if (dbBrokers && dbBrokers.length > 0) list.push(...dbBrokers);
      }
    } else {
      if (isTenantActive()) {
        loadFromKey(getScopedKey('islamabad_broker_accounts'));
      } else {
        loadFromKey('islamabad_broker_accounts');
      }
      if (dbBrokers && dbBrokers.length > 0) list.push(...dbBrokers);
      allBranches.forEach(b => {
        if (b && b.trim()) {
          const bName = b.trim().toLowerCase();
          if (isTenantActive()) {
            loadFromKey(getScopedKey(`${bName}_broker_accounts`));
          } else {
            loadFromKey(`${bName}_broker_accounts`);
          }
        }
      });
    }

    const uniqueMap = new Map();
    list.forEach(b => {
      if (b && b.name && b.name.trim()) {
        const key = b.name.trim().toLowerCase();
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, { id: b.id || key, name: b.name.trim(), phone: b.phone || '' });
        }
      }
    });
    return Array.from(uniqueMap.values());
  };

  useEffect(() => {
    async function fetchInventory() {
      let inventoryData = null;

      // 1. Try querying pending_warehouse_inventory view with tenant filter
      try {
        let q = supabase
          .from('pending_warehouse_inventory')
          .select('*');
        q = applyTenantFilter(q);
        const { data, error } = await q;
        if (!error && data && data.length > 0) {
          inventoryData = data;
        }
      } catch (e) {
        console.warn("View fetch error:", e);
      }

      // 2. Direct fallback: query bilties directly with tenant filter (100% reliable)
      if (!inventoryData || inventoryData.length === 0) {
        try {
          let bQ = supabase
            .from('bilties')
            .select('*, branches(name)')
            .order('bilty_number', { ascending: false });
          bQ = applyTenantFilter(bQ);
          const { data: biltiesData, error: bErr } = await bQ;

          if (!bErr && biltiesData && biltiesData.length > 0) {
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
          console.error("Direct bilties fallback error:", err);
        }
      }

      const finalData = inventoryData || [];
      setInventory(finalData);

      // Fetch charges for each bilty from bilties table
      const ids = finalData.map(d => d.id);
      if (ids.length > 0) {
        const { data: chargesData } = await supabase
          .from('bilties')
          .select('id, custom_amount, local_freight, labor_charges, tt_expense')
          .in('id', ids);
        if (chargesData) {
          const chargesMap = {};
          chargesData.forEach(b => { chargesMap[b.id] = b; });
          setBiltyCharges(chargesMap);
        }
      }
    }

    function fetchBranches() {
      const currentPrimary = (primaryBranchName || 'Islamabad').trim();
      const custom = getTenantItem('custom_branches', []) || [];
      const customNames = custom
        .map(b => (b.name || '').trim())
        .filter(n => n && n.toLowerCase() !== 'karachi' && n.toLowerCase() !== currentPrimary.toLowerCase());

      const list = [currentPrimary, ...customNames];
      const unique = Array.from(new Set(list));
      if (unique.length > 0) {
        setAllBranches(unique);
        setSelectedBranch(prev => prev || unique[0]);
      }
    }

    fetchInventory();
    fetchBranches();
  }, [primaryBranchName]);


  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelection = (item, checked) => {
    if (checked) {
      setSelectedBilties(prev => ({
        ...prev,
        [item.id]: {
          loaded_quantity: item.remaining_quantity, // default full remaining
          remaining_quantity: item.remaining_quantity,
          total_amount: item.total_amount,
          total_quantity: item.total_quantity
        }
      }));
    } else {
      setSelectedBilties(prev => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
    }
  };

  const handleQuantityChange = (id, newQty) => {
    setSelectedBilties(prev => ({
      ...prev,
      [id]: { ...prev[id], loaded_quantity: parseInt(newQty) || 0 }
    }));
  };

  // Calculations
  // Filtered inventory based on selected branch
  const filteredInventory = selectedBranch
    ? inventory.filter(item => {
        const dName = (item.destination_name || '').trim().toLowerCase();
        const dest = (item.destination || '').trim().toLowerCase();
        const sel = selectedBranch.trim().toLowerCase();
        return dName === sel || dest === sel || dName.startsWith(sel) || sel.startsWith(dName);
      })
    : [];

  const calculatedTotalBiltyAmount = Object.values(selectedBilties).reduce((acc, b) => {
    const ratio = b.loaded_quantity / b.total_quantity;
    return acc + (b.total_amount * ratio);
  }, 0);

  // Sum of all selected bilties' Local Fare
  const totalLocalFare = Object.keys(selectedBilties).reduce((acc, bid) => {
    const charges = biltyCharges[bid] || {};
    return acc + Number(charges.local_freight || 0);
  }, 0);

  // Sum of all selected bilties' Loading charges
  const totalLoading = Object.keys(selectedBilties).reduce((acc, bid) => {
    const charges = biltyCharges[bid] || {};
    return acc + Number(charges.labor_charges || 0);
  }, 0);

  // Effective amounts depending on Auto vs Manual mode
  const effectiveTotalBiltyAmount = isManualMode
    ? (parseFloat(manualForm.rent_amount) || 0)
    : calculatedTotalBiltyAmount;

  const effectiveLocalFare = isManualMode
    ? (parseFloat(manualForm.local_fare) || 0)
    : totalLocalFare;

  const effectiveLoading = isManualMode
    ? (parseFloat(manualForm.loading) || 0)
    : totalLoading;

  // Net Rent Amount = Total Rent Amount - (Total Local Fare + Total Loading)
  const netRentAmount = effectiveTotalBiltyAmount - (effectiveLocalFare + effectiveLoading);

  // Commission Deduction on Net Rent Amount
  const commissionDeduction = parseFloat(formData.commission_deduction || 0);

  // After Commission = Net Rent Amount - Commission Deduction
  const afterCommission = netRentAmount - commissionDeduction;

  // After Vehicle Freight
  const afterVehicleFreight = afterCommission - parseFloat(formData.vehicle_freight || 0);

  // Profit = After Vehicle Freight + Total Local Fare + Total Loading
  const profit = afterVehicleFreight + effectiveLocalFare + effectiveLoading;

  // Receivable from Broker = Profit - Branch Deposit
  const branchDeposit = parseFloat(formData.branch_deposit || 0);
  const receivableFromBroker = profit - branchDeposit;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedBranch) {
      setMessage('Error: Please select a destination branch in Step 1.');
      return;
    }
    if (!formData.vehicle_number || !formData.vehicle_number.trim()) {
      setMessage('Error: Vehicle number is required.');
      return;
    }
    if (!formData.driver_name || !formData.driver_name.trim()) {
      setMessage('Error: Driver name is required.');
      return;
    }
    if (!isManualMode && Object.keys(selectedBilties).length === 0) {
      setMessage('Error: Please select at least one bilty to create a challan.');
      return;
    }
    if (isManualMode && effectiveTotalBiltyAmount <= 0) {
      setMessage('Error: Please enter a valid Total Rent Amount for the manual challan.');
      return;
    }

    if (formData.broker_name && formData.broker_name.trim()) {
      const confirmed = window.confirm(`Broker name entered: ${formData.broker_name}\n\nPlease confirm you have obtained permission from this broker before dispatching.`);
      if (!confirmed) {
        setMessage('Dispatch canceled. Please obtain broker permission before proceeding.');
        return;
      }
    }
    setLoading(true);
    setMessage('');

    const nextChallanNum = await fetchNextChallanNumber();

    const challanPayload = {
      challan_number: nextChallanNum,
      vehicle_number: formData.vehicle_number,
      route_number: formData.route_number,
      broker_name: formData.broker_name,
      driver_name: formData.driver_name,
      challan_date: challanDate,
      total_bilty_amount: effectiveTotalBiltyAmount,
      labor_deduction: effectiveLoading,
      commission_deduction: commissionDeduction,
      other_deduction: effectiveLocalFare,
      vehicle_freight: parseFloat(formData.vehicle_freight || 0),
      branch_deposit: branchDeposit,
      status: 'in_transit'
    };

    let { data: challanData, error: challanError } = await supabase
      .from('challans')
      .insert([withTenantId(challanPayload)])
      .select();

    if (challanError && challanError.message && challanError.message.includes('tenant_id')) {
      const retry = await supabase
        .from('challans')
        .insert([challanPayload])
        .select();
      challanData = retry.data;
      challanError = retry.error;
    }

    if (challanError) {
      setMessage(`Error creating challan: ${challanError.message}`);
      setLoading(false);
      return;
    }

    const challanId = challanData[0].id;
    const challanNum = challanData[0].challan_number;

    if (!isManualMode) {
      // 2. Create Challan Bilties link
      const links = Object.entries(selectedBilties).map(([bilty_id, obj]) => ({
        challan_id: challanId,
        bilty_id: bilty_id,
        loaded_quantity: obj.loaded_quantity
      }));

      const { error: linkError } = await supabase.from('challan_bilties').insert(links);

      if (linkError) {
        setMessage(`Details error: ${linkError.message}`);
      } else {
        setMessage(`Challan #${challanNum} Created Successfully and dispatched!`);
        // Snapshot for print
        const biltySnapshot = Object.entries(selectedBilties).map(([bid, obj]) => {
          const inv = inventory.find(i => String(i.id) === String(bid));
          const charges = biltyCharges[bid] || {};
          return { ...obj, bilty_number: inv?.bilty_number, destination: inv?.destination_name, description: inv?.description, sender: inv?.sender_name, receiver: inv?.receiver_name, local_fare: Number(charges.local_freight || 0), loading: Number(charges.labor_charges || 0) };
        });
        setSavedChallan({
          challan_number: challanNum,
          date: new Date(challanDate + 'T00:00:00').toLocaleDateString('en-PK'),
          vehicle_number: formData.vehicle_number,
          driver_name: formData.driver_name,
          route_number: formData.route_number,
          broker_name: formData.broker_name,
          branch: selectedBranch,
          bilties: biltySnapshot,
          total_bilty_amount: effectiveTotalBiltyAmount,
          total_local_fare: effectiveLocalFare,
          total_loading: effectiveLoading,
          net_rent_amount: netRentAmount,
          commission_deduction: commissionDeduction,
          vehicle_freight: parseFloat(formData.vehicle_freight || 0),
          branch_deposit: branchDeposit,
          receivable_from_broker: receivableFromBroker,
          profit,
          is_manual: false
        });
        // Update inventory list locally to remove loaded quantities
        setInventory(prev => prev.map(inv => {
          if(selectedBilties[inv.id]) {
            return { ...inv, remaining_quantity: inv.remaining_quantity - selectedBilties[inv.id].loaded_quantity };
          }
          return inv;
        }).filter(inv => inv.remaining_quantity > 0));
        setSelectedBilties({});
        setSelectedBranch('');
        setCommissionPct('');
        setChallanDate(new Date().toISOString().split('T')[0]);
        setFormData({
          vehicle_number: '', route_number: '', broker_name: '', driver_name: '',
          commission_deduction: 0, vehicle_freight: 0, branch_deposit: 0
        });
        fetchNextChallanNumber();
      }
    } else {
      // Manual Mode: Link to destination branch for ledger/broker account reporting
      try {
        let branchId = null;
        const { data: bData } = await supabase.from('branches').select('id, name');
        if (bData && bData.length > 0) {
          const match = bData.find(b => (b.name || '').trim().toLowerCase() === (selectedBranch || '').trim().toLowerCase());
          if (match) branchId = match.id;
        }

        // Get next bilty number for this tenant (works for all clients - new clients start at 1)
        const nextManualBiltyNum = await fetchNextBiltyNumber();

        const manualBiltyPayload = {
          bilty_number: nextManualBiltyNum,
          destination: selectedBranch,
          destination_branch_id: branchId,
          total_amount: effectiveTotalBiltyAmount,
          custom_amount: effectiveTotalBiltyAmount,
          local_freight: effectiveLocalFare,
          labor_charges: effectiveLoading,
          total_quantity: 1,
          description: `Manual Challan #${challanNum} Dispatch`,
          sender_name: 'Direct Dispatch',
          receiver_name: selectedBranch,
          bilty_date: challanDate
        };

        let { data: bRes, error: bErr } = await supabase.from('bilties').insert([withTenantId(manualBiltyPayload)]).select();
        if (bErr && bErr.message && bErr.message.includes('tenant_id')) {
          const retryB = await supabase.from('bilties').insert([manualBiltyPayload]).select();
          bRes = retryB.data;
          bErr = retryB.error;
        }

        if (bErr) {
          console.error("Manual bilty insert error:", bErr);
        }

        if (bRes && bRes.length > 0) {
          const { error: cbLinkErr } = await supabase.from('challan_bilties').insert([{
            challan_id: challanId,
            bilty_id: bRes[0].id,
            loaded_quantity: 1
          }]);
          if (cbLinkErr) console.error("challan_bilties link error:", cbLinkErr);
        }
      } catch (err) {
        console.warn('Manual bilty link notice:', err);
      }

      setMessage(`Manual Challan #${challanNum} Created Successfully and dispatched!`);
      const manualSnapshot = [{
        bilty_number: `MANUAL-${challanNum}`,
        destination: selectedBranch,
        description: 'Manual Challan Direct Entry',
        sender: 'Direct Dispatch',
        receiver: selectedBranch,
        loaded_quantity: 1,
        total_quantity: 1,
        total_amount: effectiveTotalBiltyAmount,
        local_fare: effectiveLocalFare,
        loading: effectiveLoading
      }];

      setSavedChallan({
        challan_number: challanNum,
        date: new Date(challanDate + 'T00:00:00').toLocaleDateString('en-PK'),
        vehicle_number: formData.vehicle_number,
        driver_name: formData.driver_name,
        route_number: formData.route_number,
        broker_name: formData.broker_name,
        branch: selectedBranch,
        bilties: manualSnapshot,
        total_bilty_amount: effectiveTotalBiltyAmount,
        total_local_fare: effectiveLocalFare,
        total_loading: effectiveLoading,
        net_rent_amount: netRentAmount,
        commission_deduction: commissionDeduction,
        vehicle_freight: parseFloat(formData.vehicle_freight || 0),
        branch_deposit: branchDeposit,
        receivable_from_broker: receivableFromBroker,
        profit,
        is_manual: true
      });

      setSelectedBilties({});
      setManualForm({ rent_amount: '', local_fare: '', loading: '' });
      setSelectedBranch('');
      setCommissionPct('');
      setChallanDate(new Date().toISOString().split('T')[0]);
      setFormData({
        vehicle_number: '', route_number: '', broker_name: '', driver_name: '',
        commission_deduction: 0, vehicle_freight: 0, branch_deposit: 0
      });
      fetchNextChallanNumber();
    }
    setLoading(false);
  };

  const handlePrint = async () => {
    if (!savedChallan) return;
    const c = savedChallan;

    // Convert header image to base64 or use direct data URL
    let headerBase64 = '';
    const srcUrl = challanHeaderUrl || '/challan-header.jpg';
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

    const biltyRows = c.bilties.map((b, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><b>${b.bilty_number || '-'}</b></td>
        <td>${b.description || '-'}</td>
        <td>${b.sender || '-'}</td>
        <td>${b.receiver || '-'}</td>
        <td style='text-align:right'>${b.loaded_quantity} / ${b.total_quantity}</td>
        <td style='text-align:right'>Rs. ${Number(b.local_fare || 0).toLocaleString()}</td>
        <td style='text-align:right'>Rs. ${Number(b.loading || 0).toLocaleString()}</td>
        <td style='text-align:right'>Rs. ${Number(b.total_amount * (b.loaded_quantity / b.total_quantity)).toLocaleString()}</td>
      </tr>`).join('');

    const challanHTML = `
      <div class="challan-copy">
        <div class="header-img"><img src="${headerBase64}" alt="Header" /></div>
        <div class="info-row">
          <div class="info-cell"><span class="label">Challan #</span><span class="value bold">${c.challan_number}</span></div>
          <div class="info-cell"><span class="label">Date</span><span class="value">${c.date}</span></div>
          <div class="info-cell"><span class="label">Vehicle</span><span class="value">${c.vehicle_number}</span></div>
          <div class="info-cell"><span class="label">Driver</span><span class="value">${c.driver_name}</span></div>
          ${c.route_number ? `<div class="info-cell"><span class="label">Route #</span><span class="value">${c.route_number}</span></div>` : ''}
          ${c.broker_name ? `<div class="info-cell"><span class="label">Broker</span><span class="value">${c.broker_name}</span></div>` : ''}
          ${c.branch ? `<div class="info-cell"><span class="label">Branch</span><span class="value bold">${c.branch}</span></div>` : ''}
        </div>
        <div class="section-title">Bilties in this Challan</div>
        <table>
          <thead><tr><th>#</th><th>Bilty #</th><th>Description</th><th>Sender</th><th>Receiver</th><th>Loaded/Total</th><th>Local Fare</th><th>Loading</th><th class="total-col">Amount</th></tr></thead>
          <tbody>${biltyRows}</tbody>
        </table>
        <div class="section-title">Financial Summary</div>
        <div class="finance-box">
          <div class="fin-row"><span>Total Rent Amount:</span><strong>Rs. ${c.total_bilty_amount.toLocaleString()}</strong></div>
          <div class="fin-row dim"><span>Total Local Fare (all bilties):</span><strong>- Rs. ${c.total_local_fare.toLocaleString()}</strong></div>
          <div class="fin-row dim"><span>Total Loading (all bilties):</span><strong>- Rs. ${c.total_loading.toLocaleString()}</strong></div>
          <div class="fin-row net"><span>Net Rent Amount:</span><strong>Rs. ${c.net_rent_amount.toLocaleString()}</strong></div>
          <div class="fin-row dim"><span>Delivery:</span><strong>- Rs. ${c.commission_deduction.toLocaleString()}</strong></div>
          <div class="fin-row add"><span>+ Add Local Fare:</span><strong>+ Rs. ${c.total_local_fare.toLocaleString()}</strong></div>
          <div class="fin-row add"><span>+ Add Loading:</span><strong>+ Rs. ${c.total_loading.toLocaleString()}</strong></div>
          <div class="fin-row dim"><span>Branch Deposit:</span><strong>- Rs. ${(c.branch_deposit || 0).toLocaleString()}</strong></div>
          <div class="fin-row profit"><span>Topay:</span><strong style="color:#3B82F6">Rs. ${(c.net_rent_amount - c.commission_deduction + c.total_local_fare + c.total_loading - (c.branch_deposit || 0)).toLocaleString()}</strong></div>
        </div>

      </div>`;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Challan #${c.challan_number}</title><style>
      @page { size: A4; margin: 8mm 10mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; font-weight: 900 !important; -webkit-text-stroke: 0.3px #000; color: #000 !important; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #000; background: #f5f0e8; }
      .challan-copy { width: 100%; padding: 4mm 2mm 2mm 2mm; border: 2px solid #000; border-radius: 3px; overflow: hidden; page-break-inside: avoid; background: #f5f0e8; }
      .challan-copy + .challan-copy { margin-top: 3vh; }
      .header-img { margin-bottom: 0; width: 100%; background: #fff; }
      .header-img img { width: 100%; height: auto; display: block; }
      .info-row { display: flex; justify-content: space-between; border: 1.5px solid #000; border-radius: 3px; padding: 5px 10px; margin-bottom: 6px; }
      .info-cell { display: flex; flex-direction: column; align-items: center; }
      .info-cell .label { font-size: 10px; text-transform: uppercase; color: #000 !important; font-weight: 900 !important; }
      .info-cell .value { font-size: 12px; font-weight: 900 !important; color: #000 !important; }
      .info-cell .value.bold { font-size: 14px; font-weight: 900 !important; }
      .section-title { font-size: 11px; font-weight: 900 !important; color: #000 !important; text-transform: uppercase; padding: 3px 8px; margin-bottom: 3px; border-bottom: 1.5px solid #000; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
      th { background: #f5f0e8; color: #000 !important; padding: 5px 6px; font-size: 10px; text-align: left; font-weight: 900 !important; border-bottom: 1.5px solid #000; }
      td { padding: 5px 6px; font-size: 11px; border-bottom: 1px solid #999; font-weight: 900 !important; color: #000 !important; }
      .total-col { text-align: right; font-size: 13px; color: #c0392b !important; font-weight: 900 !important; }
      th.total-col { color: #000 !important; text-align: right; }
      .profit-col { text-align: right; font-size: 12px; color: ${c.profit >= 0 ? '#16a34a' : '#dc2626'} !important; font-weight: 900 !important; }
      th.profit-col { color: #000 !important; text-align: right; }
      .signatures { display: flex; justify-content: space-between; margin-top: 6px; padding-top: 4px; }
      .sig-box { text-align: center; width: 28%; }
      .sig-line { border-bottom: 1.5px solid #000; margin-bottom: 3px; height: 20px; }
      .sig-box span { font-size: 9px; color: #000 !important; text-transform: uppercase; font-weight: 800 !important; }
      .finance-box { padding: 8px 10px; border: 1.5px solid #000; border-radius: 3px; margin-bottom: 6px; }
      .fin-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; font-weight: 900 !important; color: #000 !important; }
      .fin-row.dim { color: #000 !important; }
      .fin-row.net { border-top: 1.5px solid #000; padding-top: 5px; margin-top: 3px; font-weight: 900 !important; }
      .fin-row.add { color: #000 !important; }
      .fin-row.profit { border-top: 2px solid #000; padding-top: 6px; margin-top: 4px; font-size: 15px; font-weight: 900 !important; }
      @media print { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    </style></head><body>
      ${challanHTML}
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 600);
  };

  const handleWhatsApp = () => {
    if (!savedChallan) return;
    const c = savedChallan;
    const biltyLines = c.bilties.map((b, i) =>
      `${i + 1}. Bilty #${b.bilty_number || '-'} | ${b.destination || '-'} | ${b.description || '-'} | Qty: ${b.loaded_quantity}/${b.total_quantity} | Rs. ${Number(b.total_amount * (b.loaded_quantity / b.total_quantity)).toLocaleString()}`
    ).join('\n');

    const text = [
      `*GUL-E-PAKISTAN*`,
      `Challan Dispatch`,
      ``,
      `*Challan #:* ${c.challan_number}`,
      `*Date:* ${c.date}`,
      `*Vehicle:* ${c.vehicle_number}`,
      `*Driver:* ${c.driver_name}`,
      c.route_number ? `*Route #:* ${c.route_number}` : '',
      c.broker_name ? `*Broker:* ${c.broker_name}` : '',
      ``,
      `*--- Loaded Bilties ---*`,
      biltyLines,
      ``,
      `*--- Financial Summary ---*`,
      `Total Rent Amount: Rs. ${c.total_bilty_amount.toLocaleString()}`,
      `Total Local Fare: Rs. ${c.total_local_fare.toLocaleString()}`,
      `Total Loading: Rs. ${c.total_loading.toLocaleString()}`,
      `Net Rent Amount: Rs. ${c.net_rent_amount.toLocaleString()}`,
      `Delivery: Rs. ${c.commission_deduction.toLocaleString()}`,
      `Vehicle Freight: Rs. ${c.vehicle_freight.toLocaleString()}`,
      `*Profit: Rs. ${c.profit.toLocaleString()}*`,
      `Branch Deposit: Rs. ${(c.branch_deposit || 0).toLocaleString()}`,
      `*Receivable from Broker: Rs. ${(c.receivable_from_broker || 0).toLocaleString()}*`,
    ].filter(Boolean).join('\n');

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Truck size={28} color="var(--primary-color)" />
          <h1 className="page-title" style={{ marginBottom: 0 }}>Create Challan (Dispatch)</h1>
        </div>

        {savedChallan && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={handlePrint} style={{ padding: '7px 16px', fontSize: '0.85rem', fontWeight: 700, border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', background: '#f1f5f9', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🖨️ Print Challan #{savedChallan.challan_number}
            </button>
            <button type="button" onClick={handleWhatsApp} style={{ padding: '7px 16px', fontSize: '0.85rem', fontWeight: 700, border: 'none', borderRadius: '8px', cursor: 'pointer', background: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              💬 WhatsApp
            </button>
          </div>
        )}
      </div>

      {/* Prominent Mode Selection Banner */}
      <div className="card no-print" style={{ marginBottom: '18px', padding: '12px 16px', background: isManualMode ? '#f5f3ff' : '#eff6ff', border: isManualMode ? '2px solid #8b5cf6' : '2px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: isManualMode ? '#6d28d9' : '#1d4ed8' }}>
            {isManualMode ? '✍️ Manual Challan Mode Active' : '📦 Automatic (Warehouse) Mode Active'}
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.83rem', color: isManualMode ? '#5b21b6' : '#1e40af' }}>
            {isManualMode 
              ? 'Warehouse bilties bypassed. Step 3 me amounts direct enter kar sakte hain.' 
              : 'Warehouse se bilties select karein jo load karni hain.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '6px', background: '#fff', padding: '4px', borderRadius: '10px', border: '1.5px solid #cbd5e1' }}>
          <button
            type="button"
            onClick={() => setIsManualMode(false)}
            style={{
              padding: '8px 18px',
              borderRadius: '7px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.9rem',
              background: !isManualMode ? '#2563eb' : 'transparent',
              color: !isManualMode ? '#fff' : '#64748b',
              boxShadow: !isManualMode ? '0 2px 5px rgba(37,99,235,0.3)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            📦 Auto (Warehouse)
          </button>
          <button
            type="button"
            onClick={() => setIsManualMode(true)}
            style={{
              padding: '8px 18px',
              borderRadius: '7px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.9rem',
              background: isManualMode ? '#7c3aed' : 'transparent',
              color: isManualMode ? '#fff' : '#64748b',
              boxShadow: isManualMode ? '0 2px 5px rgba(124,58,237,0.3)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            ✍️ Manual Challan
          </button>
        </div>
      </div>

      {message && (
        <div style={{ padding: '12px', marginBottom: '20px', borderRadius: '6px', backgroundColor: message.includes('Error') ? '#fee2e2' : '#d1fae5', color: message.includes('Error') ? '#991b1b' : '#065f46', fontWeight: 600 }}>
          {message}
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()}>
        <div className="card no-print" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ color: '#2563eb', fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>📍 Step 1: Select Destination Branch</h3>
            {isManualMode && (
              <span style={{ background: '#ede9fe', color: '#7c3aed', padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700 }}>
                Manual Mode Active
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>Choose the destination branch for this challan (data will link to this branch ledger & broker account).</p>
          <div className="branch-select-grid">
            {allBranches.map(branch => (
              <button
                key={branch}
                type="button"
                onClick={() => { setSelectedBranch(branch); setSelectedBilties({}); }}
                style={{
                  padding: '9px 14px',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: selectedBranch === branch ? '2px solid var(--primary-color)' : '2px solid var(--border-color)',
                  background: selectedBranch === branch ? 'var(--primary-color)' : '#fff',
                  color: selectedBranch === branch ? '#fff' : 'var(--text-color)',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                  minHeight: '40px'
                }}
              >
                {branch}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 style={{ color: '#d97706', fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>🚛 Vehicle & Driver Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '14px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Vehicle Number</label>
              <input type="text" name="vehicle_number" value={formData.vehicle_number} onChange={handleFormChange} placeholder="e.g. TLA-123" required style={{ padding: '9px 12px', fontSize: '0.98rem', height: '42px', width: '100%' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Driver Name</label>
              <input type="text" name="driver_name" value={formData.driver_name} onChange={handleFormChange} placeholder="Driver name" required style={{ padding: '9px 12px', fontSize: '0.98rem', height: '42px', width: '100%' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Challan Date</label>
              <input type="date" value={challanDate} onChange={e => setChallanDate(e.target.value)} required style={{ padding: '9px 12px', fontSize: '0.98rem', height: '42px', width: '100%' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              {(() => {
                const branchBrokers = getBranchBrokers(selectedBranch);
                return (
                  <>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                      <span>
                        Broker Name
                        {selectedBranch && (
                          <span style={{ color: '#2563eb', marginLeft: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                            ({selectedBranch} Brokers: {branchBrokers.length})
                          </span>
                        )}
                      </span>
                      {branchBrokers.length > 0 && (
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          Select or type custom
                        </span>
                      )}
                    </label>
                    {branchBrokers.length > 0 ? (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <select
                          name="broker_name"
                          value={formData.broker_name}
                          onChange={handleFormChange}
                          style={{
                            flex: 1,
                            padding: '9px 12px',
                            fontSize: '0.95rem',
                            height: '42px',
                            border: '1.5px solid #2563eb',
                            borderRadius: '6px',
                            background: '#eff6ff',
                            color: '#1e40af',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <option value="">-- Select {selectedBranch || 'Branch'} Broker --</option>
                          {branchBrokers.map((b, idx) => (
                            <option key={b.id || idx} value={b.name}>
                              {b.name}{b.phone ? ` (${b.phone})` : ''}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          name="broker_name"
                          value={formData.broker_name}
                          onChange={handleFormChange}
                          placeholder="Or type custom name"
                          style={{
                            width: '42%',
                            padding: '9px 12px',
                            fontSize: '0.88rem',
                            height: '42px',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '6px'
                          }}
                        />
                      </div>
                    ) : (
                      <input
                        type="text"
                        name="broker_name"
                        value={formData.broker_name}
                        onChange={handleFormChange}
                        placeholder={`Broker name (optional${selectedBranch ? ` - add in ${selectedBranch} Broker A/C` : ''})`}
                        style={{
                          padding: '9px 12px',
                          fontSize: '0.98rem',
                          height: '42px',
                          width: '100%',
                          border: '1.5px solid #cbd5e1',
                          borderRadius: '6px'
                        }}
                      />
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Step 2: Auto (Warehouse bilties) vs Manual Mode */}
        {!isManualMode ? (
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#7c3aed', fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>📦 Step 2: Select Bilties from Warehouse</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '8px 0 16px 0' }}>Select bilties and specify how many packages you are loading. You can dispatch partial quantities.</p>
            
            <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
              <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '10px 8px', color: '#0f172a', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Select</th>
                    <th style={{ padding: '10px 8px', color: '#0f172a', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bilty #</th>
                    <th style={{ padding: '10px 8px', color: '#0f172a', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Destination</th>
                    <th style={{ padding: '10px 8px', color: '#0f172a', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Available Qty</th>
                    <th style={{ padding: '10px 8px', color: '#c0392b', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rent Amount</th>
                    <th style={{ padding: '10px 8px', color: '#059669', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Local Fare</th>
                    <th style={{ padding: '10px 8px', color: '#d97706', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Loading</th>
                    <th style={{ padding: '10px 8px', color: '#2563eb', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TT Expense</th>
                    <th style={{ padding: '10px 8px', color: '#0f172a', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Load Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {!selectedBranch && <tr><td colSpan="9" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Please select a destination branch above to view bilties.</td></tr>}
                  {filteredInventory.map(item => {
                    const charges = biltyCharges[item.id] || {};
                    return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px' }}>
                        <input 
                          type="checkbox" 
                          onChange={(e) => handleSelection(item, e.target.checked)}
                          checked={!!selectedBilties[item.id]}
                        />
                      </td>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{item.bilty_number}</td>
                      <td style={{ padding: '8px' }}>{item.destination_name}</td>
                      <td style={{ padding: '8px' }}>{item.remaining_quantity}</td>
                      <td style={{ padding: '8px', color: '#c0392b', fontWeight: 600 }}>{Number(charges.custom_amount || 0).toLocaleString()}</td>
                      <td style={{ padding: '8px' }}>{Number(charges.local_freight || 0).toLocaleString()}</td>
                      <td style={{ padding: '8px' }}>{Number(charges.labor_charges || 0).toLocaleString()}</td>
                      <td style={{ padding: '8px' }}>{Number(charges.tt_expense || 0).toLocaleString()}</td>
                      <td style={{ padding: '8px' }}>
                         <input 
                            type="number" 
                            min="1" 
                            max={item.remaining_quantity}
                            value={selectedBilties[item.id]?.loaded_quantity || ''}
                            disabled={!selectedBilties[item.id]}
                            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                            style={{ width: '80px', padding: '4px 8px' }}
                         />
                      </td>
                    </tr>
                    );
                  })}
                  {selectedBranch && filteredInventory.length === 0 && <tr><td colSpan="9" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No bilties found for {selectedBranch}.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card" style={{ marginBottom: '20px', border: '1.5px dashed #7c3aed', background: '#faf5ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>✍️</span>
                <h3 style={{ color: '#7c3aed', fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>
                  Manual Challan Mode Active
                </h3>
              </div>
              <span style={{ fontSize: '0.8rem', background: '#7c3aed', color: '#fff', padding: '4px 12px', borderRadius: '12px', fontWeight: 700 }}>
                Warehouse Search Bypassed
              </span>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#5b21b6', margin: '8px 0 0 0', fontWeight: 600 }}>
              Warehouse se bilties search ya select karne ki zarurat nahi hai. Neeche Step 3 me apni marzi se Total Rent, Local Fare aur Loading amounts enter karein.
            </p>
          </div>
        )}

        {/* Step 3: Financial Calculations */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 style={{ color: '#059669', fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>💰 Step 3: Financial Calculations</h3>
          
          {/* If in Manual Mode: Show Direct Inputs for Rent, Local Fare, Loading */}
          {isManualMode && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '14px', padding: '14px', background: '#faf5ff', borderRadius: '8px', border: '1.5px solid #e9d5ff' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 800, color: '#c0392b' }}>Total Rent Amount (Rs.) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 50000"
                  value={manualForm.rent_amount}
                  onChange={e => setManualForm(prev => ({ ...prev, rent_amount: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', fontSize: '1rem', height: '42px', fontWeight: 700, border: '1.5px solid #c0392b', borderRadius: '6px' }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 800, color: '#059669' }}>Total Local Fare (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={manualForm.local_fare}
                  onChange={e => setManualForm(prev => ({ ...prev, local_fare: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', fontSize: '1rem', height: '42px', fontWeight: 700, border: '1.5px solid #059669', borderRadius: '6px' }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 800, color: '#d97706' }}>Total Loading (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={manualForm.loading}
                  onChange={e => setManualForm(prev => ({ ...prev, loading: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', fontSize: '1rem', height: '42px', fontWeight: 700, border: '1.5px solid #d97706', borderRadius: '6px' }}
                />
              </div>
            </div>
          )}

          <div className="challan-fin-calc-grid" style={{ marginTop: '14px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>Delivery (%)</label>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="%"
                  value={commissionPct}
                  onChange={e => {
                    const pct = e.target.value;
                    setCommissionPct(pct);
                    const calcAmt = (netRentAmount * (parseFloat(pct) || 0)) / 100;
                    setFormData(prev => ({ ...prev, commission_deduction: parseFloat(calcAmt.toFixed(2)) }));
                  }}
                  style={{ width: '65px', padding: '8px', fontSize: '0.95rem', height: '42px', flexShrink: 0 }}
                />
                <span style={{ fontWeight: 700, color: '#64748b' }}>%</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="commission_deduction"
                  value={formData.commission_deduction}
                  onChange={e => {
                    setCommissionPct('');
                    handleFormChange(e);
                  }}
                  placeholder="Amount"
                  style={{ flex: 1, minWidth: '100px', padding: '8px 10px', fontSize: '0.95rem', height: '42px' }}
                />
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>Vehicle Freight (-)</label>
              <input 
                type="number" 
                min="0" 
                step="0.01" 
                name="vehicle_freight" 
                value={formData.vehicle_freight} 
                onChange={handleFormChange} 
                placeholder="0"
                style={{ width: '100%', padding: '9px 12px', fontSize: '0.98rem', height: '42px' }}
              />
            </div>
          </div>
          
          <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 600, color: '#1e293b' }}>Total Rent Amount:</span>
              <strong style={{ color: '#0f172a' }}>Rs. {effectiveTotalBiltyAmount.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#dc2626' }}>
              <span>Total Local Fare (all bilties):</span>
              <strong>- Rs. {effectiveLocalFare.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#dc2626' }}>
              <span>Total Loading (all bilties):</span>
              <strong>- Rs. {effectiveLoading.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderTop: '1px solid #cbd5e1', paddingTop: '8px' }}>
              <span style={{ fontWeight: 700, color: '#2563eb' }}>Net Rent Amount:</span>
              <strong style={{ color: '#2563eb' }}>Rs. {netRentAmount.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#dc2626' }}>
              <span>Delivery:</span>
              <strong>- Rs. {commissionDeduction.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#059669' }}>
              <span>+ Add Local Fare:</span>
              <strong>+ Rs. {effectiveLocalFare.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#059669' }}>
              <span>+ Add Loading:</span>
              <strong>+ Rs. {effectiveLoading.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#dc2626' }}>
              <span>Vehicle Freight:</span>
              <strong>- Rs. {parseFloat(formData.vehicle_freight || 0).toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '1.2rem', fontWeight: 700, borderTop: '2px solid #cbd5e1', paddingTop: '12px' }}>
              <span style={{ color: '#0f172a' }}>Profit:</span>
              <span style={{ color: profit >= 0 ? '#10b981' : '#ef4444' }}>Rs. {profit.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', marginBottom: '8px' }}>
              <span style={{ fontWeight: 700, color: '#d97706' }}>Branch Deposit (-):</span>
              <input type="number" min="0" step="0.01" name="branch_deposit" value={formData.branch_deposit} onChange={handleFormChange} style={{ width: '180px', padding: '6px 10px', fontSize: '0.95rem', textAlign: 'right' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '1.1rem', fontWeight: 700, borderTop: '2px solid #cbd5e1', paddingTop: '12px' }}>
              <span style={{ color: '#2563eb' }}>Receivable from Broker:</span>
              <span style={{ color: receivableFromBroker >= 0 ? '#2563eb' : '#ef4444' }}>Rs. {receivableFromBroker.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <button 
          type="button" 
          className="btn btn-primary" 
          style={{ width: '100%', padding: '16px', fontSize: '1.1rem', background: isManualMode ? '#7c3aed' : 'var(--primary-color)' }} 
          disabled={loading} 
          onClick={handleSubmit}
        >
          {loading 
            ? 'Dispatching Vehicle...' 
            : isManualMode 
              ? '✍️ Create Manual Challan & Dispatch Vehicle' 
              : 'Create Challan & Dispatch Vehicle'
          }
        </button>

      </form>
    </div>
  );
}
