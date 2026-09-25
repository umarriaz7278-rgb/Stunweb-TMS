import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { getTenantItem, setTenantItem, getCurrentTenant, applyTenantFilter, withTenantId } from '../utils/tenantStorage';

const SettingsContext = createContext();

const DEFAULT_SETTINGS = {
  companyName: 'ABID MEHMOOD',
  companySubtitle: 'Goods Transport System',
  primaryBranchName: 'Islamabad',
  biltyHeaderUrl: '/bilty-header.jpg',
  challanHeaderUrl: '/challan-header.jpg',
  bookingReceiptHeaderUrl: '/booking-header.jpg',
};

export const SettingsProvider = ({ children }) => {
  const currentTenant = getCurrentTenant();
  const initialCompanyName = currentTenant?.company_name || DEFAULT_SETTINGS.companyName;

  const [companyName, setCompanyName] = useState(() => {
    return getTenantItem('app_settings_company_name', initialCompanyName);
  });

  const [companySubtitle, setCompanySubtitle] = useState(() => {
    return getTenantItem('app_settings_company_subtitle', DEFAULT_SETTINGS.companySubtitle);
  });

  const [primaryBranchName, setPrimaryBranchName] = useState(() => {
    return getTenantItem('app_settings_primary_branch_name', DEFAULT_SETTINGS.primaryBranchName);
  });

  const [biltyHeaderUrl, setBiltyHeaderUrl] = useState(() => {
    return getTenantItem('app_settings_bilty_header_url', DEFAULT_SETTINGS.biltyHeaderUrl);
  });

  const [challanHeaderUrl, setChallanHeaderUrl] = useState(() => {
    return getTenantItem('app_settings_challan_header_url', DEFAULT_SETTINGS.challanHeaderUrl);
  });

  const [bookingReceiptHeaderUrl, setBookingReceiptHeaderUrl] = useState(() => {
    return getTenantItem('app_settings_booking_receipt_header_url', DEFAULT_SETTINGS.bookingReceiptHeaderUrl);
  });

  const [loading, setLoading] = useState(false);

  // Sync settings whenever session changes
  useEffect(() => {
    const tenant = getCurrentTenant();
    if (tenant?.company_name) {
      setCompanyName(getTenantItem('app_settings_company_name', tenant.company_name));
    } else {
      setCompanyName(getTenantItem('app_settings_company_name', DEFAULT_SETTINGS.companyName));
    }
    setCompanySubtitle(getTenantItem('app_settings_company_subtitle', DEFAULT_SETTINGS.companySubtitle));
    setPrimaryBranchName(getTenantItem('app_settings_primary_branch_name', DEFAULT_SETTINGS.primaryBranchName));
    setBiltyHeaderUrl(getTenantItem('app_settings_bilty_header_url', DEFAULT_SETTINGS.biltyHeaderUrl));
    setChallanHeaderUrl(getTenantItem('app_settings_challan_header_url', DEFAULT_SETTINGS.challanHeaderUrl));
    setBookingReceiptHeaderUrl(getTenantItem('app_settings_booking_receipt_header_url', DEFAULT_SETTINGS.bookingReceiptHeaderUrl));
  }, []);

  // Load from Supabase on mount
  useEffect(() => {
    async function loadRemoteSettings() {
      try {
        let query = supabase.from('app_settings').select('*');
        query = applyTenantFilter(query);
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          data.forEach(item => {
            if (item.key === 'company_name' && item.value) {
              setCompanyName(item.value);
              setTenantItem('app_settings_company_name', item.value);
            }
            if (item.key === 'company_subtitle' && item.value) {
              setCompanySubtitle(item.value);
              setTenantItem('app_settings_company_subtitle', item.value);
            }
            if (item.key === 'primary_branch_name' && item.value) {
              setPrimaryBranchName(item.value);
              setTenantItem('app_settings_primary_branch_name', item.value);
            }
            if (item.key === 'bilty_header_url' && item.value) {
              setBiltyHeaderUrl(item.value);
              setTenantItem('app_settings_bilty_header_url', item.value);
            }
            if (item.key === 'challan_header_url' && item.value) {
              setChallanHeaderUrl(item.value);
              setTenantItem('app_settings_challan_header_url', item.value);
            }
            if (item.key === 'booking_receipt_header_url' && item.value) {
              setBookingReceiptHeaderUrl(item.value);
              setTenantItem('app_settings_booking_receipt_header_url', item.value);
            }
          });
        }
      } catch (err) {
        console.warn('Could not fetch app_settings from Supabase, using local defaults:', err);
      }
    }

    loadRemoteSettings();
  }, []);

  const saveSettings = async (newSettings) => {
    setLoading(true);
    try {
      if (newSettings.companyName !== undefined) {
        setCompanyName(newSettings.companyName);
        setTenantItem('app_settings_company_name', newSettings.companyName);
      }
      if (newSettings.companySubtitle !== undefined) {
        setCompanySubtitle(newSettings.companySubtitle);
        setTenantItem('app_settings_company_subtitle', newSettings.companySubtitle);
      }
      if (newSettings.primaryBranchName !== undefined) {
        setPrimaryBranchName(newSettings.primaryBranchName);
        setTenantItem('app_settings_primary_branch_name', newSettings.primaryBranchName);
      }
      if (newSettings.biltyHeaderUrl !== undefined) {
        setBiltyHeaderUrl(newSettings.biltyHeaderUrl);
        setTenantItem('app_settings_bilty_header_url', newSettings.biltyHeaderUrl);
      }
      if (newSettings.challanHeaderUrl !== undefined) {
        setChallanHeaderUrl(newSettings.challanHeaderUrl);
        setTenantItem('app_settings_challan_header_url', newSettings.challanHeaderUrl);
      }
      if (newSettings.bookingReceiptHeaderUrl !== undefined) {
        setBookingReceiptHeaderUrl(newSettings.bookingReceiptHeaderUrl);
        setTenantItem('app_settings_booking_receipt_header_url', newSettings.bookingReceiptHeaderUrl);
      }

      // Sync to Supabase app_settings table
      const upsertList = [];
      if (newSettings.companyName !== undefined) {
        upsertList.push({ key: 'company_name', value: newSettings.companyName, updated_at: new Date().toISOString() });
      }
      if (newSettings.companySubtitle !== undefined) {
        upsertList.push({ key: 'company_subtitle', value: newSettings.companySubtitle, updated_at: new Date().toISOString() });
      }
      if (newSettings.primaryBranchName !== undefined) {
        upsertList.push({ key: 'primary_branch_name', value: newSettings.primaryBranchName, updated_at: new Date().toISOString() });
      }
      if (newSettings.biltyHeaderUrl !== undefined) {
        upsertList.push({ key: 'bilty_header_url', value: newSettings.biltyHeaderUrl, updated_at: new Date().toISOString() });
      }
      if (newSettings.challanHeaderUrl !== undefined) {
        upsertList.push({ key: 'challan_header_url', value: newSettings.challanHeaderUrl, updated_at: new Date().toISOString() });
      }
      if (newSettings.bookingReceiptHeaderUrl !== undefined) {
        upsertList.push({ key: 'booking_receipt_header_url', value: newSettings.bookingReceiptHeaderUrl, updated_at: new Date().toISOString() });
      }

      if (upsertList.length > 0) {
        const payload = withTenantId(upsertList);
        await supabase.from('app_settings').upsert(payload, { onConflict: 'key' });
      }

      return { success: true };
    } catch (err) {
      console.warn('Error saving settings to remote DB, saved locally:', err);
      return { success: true, localOnly: true };
    } finally {
      setLoading(false);
    }
  };

  const resetBiltyHeader = async () => {
    return saveSettings({ biltyHeaderUrl: DEFAULT_SETTINGS.biltyHeaderUrl });
  };

  const resetChallanHeader = async () => {
    return saveSettings({ challanHeaderUrl: DEFAULT_SETTINGS.challanHeaderUrl });
  };

  const resetBookingReceiptHeader = async () => {
    return saveSettings({ bookingReceiptHeaderUrl: DEFAULT_SETTINGS.bookingReceiptHeaderUrl });
  };

  const resetAllSettings = async () => {
    return saveSettings(DEFAULT_SETTINGS);
  };

  return (
    <SettingsContext.Provider
      value={{
        companyName,
        companySubtitle,
        primaryBranchName,
        biltyHeaderUrl,
        challanHeaderUrl,
        bookingReceiptHeaderUrl,
        loading,
        saveSettings,
        resetBiltyHeader,
        resetChallanHeader,
        resetBookingReceiptHeader,
        resetAllSettings,
        DEFAULT_SETTINGS,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    const currentTenant = getCurrentTenant();
    return {
      companyName: getTenantItem('app_settings_company_name', currentTenant?.company_name || DEFAULT_SETTINGS.companyName),
      companySubtitle: getTenantItem('app_settings_company_subtitle', DEFAULT_SETTINGS.companySubtitle),
      primaryBranchName: getTenantItem('app_settings_primary_branch_name', DEFAULT_SETTINGS.primaryBranchName),
      biltyHeaderUrl: getTenantItem('app_settings_bilty_header_url', DEFAULT_SETTINGS.biltyHeaderUrl),
      challanHeaderUrl: getTenantItem('app_settings_challan_header_url', DEFAULT_SETTINGS.challanHeaderUrl),
      bookingReceiptHeaderUrl: getTenantItem('app_settings_booking_receipt_header_url', DEFAULT_SETTINGS.bookingReceiptHeaderUrl),
      loading: false,
      saveSettings: () => {},
      resetBiltyHeader: () => {},
      resetChallanHeader: () => {},
      resetBookingReceiptHeader: () => {},
      resetAllSettings: () => {},
      DEFAULT_SETTINGS,
    };
  }
  return context;
};
