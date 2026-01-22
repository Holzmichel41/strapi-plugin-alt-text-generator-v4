import { Strapi } from '@strapi/strapi';

const STORE_KEY = 'settings';
const PLUGIN_NAME = 'strapi-plugin-alt-text-generator';

interface PluginSettings {
  licenseKey?: string;
  autoTaggingEnabled?: boolean;
  bulkProcessingParallelEnabled?: boolean;
}

const settingsService = ({ strapi }: { strapi: Strapi }) => {
  const getStore = () => strapi.store({ type: 'plugin', name: PLUGIN_NAME });

  const getSettings = async (): Promise<PluginSettings> => {
    const store = getStore();
    const settings = (await store.get({ key: STORE_KEY })) as PluginSettings | null;
    return settings || {};
  };

  const updateSettings = async (updates: Partial<PluginSettings>): Promise<void> => {
    const store = getStore();
    const current = await getSettings();
    await store.set({ key: STORE_KEY, value: { ...current, ...updates } });
  };

  return {
    async getLicenseKey(): Promise<string | null> {
      const settings = await getSettings();
      return settings.licenseKey || null;
    },

    async setLicenseKey(licenseKey: string): Promise<void> {
      await updateSettings({ licenseKey });
    },

    async hasLicenseKey(): Promise<boolean> {
      const licenseKey = await this.getLicenseKey();
      return !!licenseKey;
    },

    async deleteLicenseKey(): Promise<void> {
      const settings = await getSettings();
      delete settings.licenseKey;
      const store = getStore();
      await store.set({ key: STORE_KEY, value: settings });
    },

    async getAutoTaggingEnabled(): Promise<boolean> {
      const settings = await getSettings();
      return settings.autoTaggingEnabled === true;
    },

    async setAutoTaggingEnabled(enabled: boolean): Promise<void> {
      await updateSettings({ autoTaggingEnabled: enabled });
    },

    async getBulkProcessingParallelEnabled(): Promise<boolean> {
      const settings = await getSettings();
      return settings.bulkProcessingParallelEnabled === true;
    },

    async setBulkProcessingParallelEnabled(enabled: boolean): Promise<void> {
      await updateSettings({ bulkProcessingParallelEnabled: enabled });
    },
  };
};

export default settingsService;
