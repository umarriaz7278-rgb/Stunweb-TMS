import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const SettingsContext = createContext();

const DEFAULT_SETTINGS = {
  companyName: 'ABID MEHMOOD',
  companySubtitle: 'Goods Transport System',
  biltyHeaderUrl: '/bilty-header.jpg',
  challanHeaderUrl: '/challan-header.jpg',
};

export const SettingsProvider = ({ children }) => {
  const [companyName, setCompanyName] = useState(() => {
    return localStorage.getItem('app_settings_company_name') || DEFAULT_SETTINGS.companyName;
  });

  const [companySubtitle, setCompanySubtitle] = useState(() => {
    return localStorage.getItem('app_settings_company_subtitle') || DEFAULT_SETTINGS.companySubtitle;
  });

  const [biltyHeaderUrl, setBiltyHeaderUrl] = useState(() => {
    return localStorage.getItem('app_settings_bilty_header_url') || DEFAULT_SETTINGS.biltyHeaderUrl;
  });

  const [challanHeaderUrl, setChallanHeaderUrl] = useState(() => {
    return localStorage.getItem('app_settings_challan_header_url') || DEFAULT_SETTINGS.challanHeaderUrl;
  });

  const [loading, setLoading] = useState(false);

  // Load from Supabase on mount
  useEffect(() => {
    async function loadRemoteSettings() {
      try {
        const { data, error } = await supabase.from('app_settings').select('*');
        if (!error && data && data.length > 0) {
          data.forEach(item => {
            if (item.key === 'company_name' && item.value) {
              setCompanyName(item.value);
              localStorage.setItem('app_settings_company_name', item.value);
            }
            if (item.key === 'company_subtitle' && item.value) {
              setCompanySubtitle(item.value);
              localStorage.setItem('app_settings_company_subtitle', item.value);
            }
            if (item.key === 'bilty_header_url' && item.value) {
              setBiltyHeaderUrl(item.value);
              localStorage.setItem('app_settings_bilty_header_url', item.value);
            }
            if (item.key === 'challan_header_url' && item.value) {
              setChallanHeaderUrl(item.value);
              localStorage.setItem('app_settings_challan_header_url', item.value);
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
        localStorage.setItem('app_settings_company_name', newSettings.companyName);
      }
      if (newSettings.companySubtitle !== undefined) {
        setCompanySubtitle(newSettings.companySubtitle);
        localStorage.setItem('app_settings_company_subtitle', newSettings.companySubtitle);
      }
      if (newSettings.biltyHeaderUrl !== undefined) {
        setBiltyHeaderUrl(newSettings.biltyHeaderUrl);
        localStorage.setItem('app_settings_bilty_header_url', newSettings.biltyHeaderUrl);
      }
      if (newSettings.challanHeaderUrl !== undefined) {
        setChallanHeaderUrl(newSettings.challanHeaderUrl);
        localStorage.setItem('app_settings_challan_header_url', newSettings.challanHeaderUrl);
      }

      // Sync to Supabase app_settings table
      const upsertList = [];
      if (newSettings.companyName !== undefined) {
        upsertList.push({ key: 'company_name', value: newSettings.companyName, updated_at: new Date().toISOString() });
      }
      if (newSettings.companySubtitle !== undefined) {
        upsertList.push({ key: 'company_subtitle', value: newSettings.companySubtitle, updated_at: new Date().toISOString() });
      }
      if (newSettings.biltyHeaderUrl !== undefined) {
        upsertList.push({ key: 'bilty_header_url', value: newSettings.biltyHeaderUrl, updated_at: new Date().toISOString() });
      }
      if (newSettings.challanHeaderUrl !== undefined) {
        upsertList.push({ key: 'challan_header_url', value: newSettings.challanHeaderUrl, updated_at: new Date().toISOString() });
      }

      if (upsertList.length > 0) {
        await supabase.from('app_settings').upsert(upsertList, { onConflict: 'key' });
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

  const resetAllSettings = async () => {
    return saveSettings(DEFAULT_SETTINGS);
  };

  return (
    <SettingsContext.Provider
      value={{
        companyName,
        companySubtitle,
        biltyHeaderUrl,
        challanHeaderUrl,
        loading,
        saveSettings,
        resetBiltyHeader,
        resetChallanHeader,
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
    return {
      companyName: localStorage.getItem('app_settings_company_name') || DEFAULT_SETTINGS.companyName,
      companySubtitle: localStorage.getItem('app_settings_company_subtitle') || DEFAULT_SETTINGS.companySubtitle,
      biltyHeaderUrl: localStorage.getItem('app_settings_bilty_header_url') || DEFAULT_SETTINGS.biltyHeaderUrl,
      challanHeaderUrl: localStorage.getItem('app_settings_challan_header_url') || DEFAULT_SETTINGS.challanHeaderUrl,
      loading: false,
      saveSettings: () => {},
      resetBiltyHeader: () => {},
      resetChallanHeader: () => {},
      resetAllSettings: () => {},
      DEFAULT_SETTINGS,
    };
  }
  return context;
};
