import { Strapi } from '@strapi/strapi';

const PLUGIN_NAME = 'strapi-plugin-alt-text-generator';
const FREE_TIER_LIMIT = 10;

export interface SubscriptionResponse {
  hasSubscription: boolean;
  isActive: boolean;
  cancelAtPeriodEnd: boolean;
  status: string | null;
  planName: string | null;
  currentPeriodEnd: number | null;
  generationsLimit: number;
  autoTagging: boolean;
  bulkProcessing: boolean;
  usage: UsageResponse | null;
}

export interface PortalResponse {
  url: string;
}

export interface UsageResponse {
  used: number;
  limit: number;
  periodStart: string;
  periodEnd: string;
}

export interface IncrementResponse {
  used: number;
  limit: number;
  remaining: number;
}

export interface GenerateAltTextResponse {
  altText: string;
}

export interface BatchGenerateResult {
  success: boolean;
  altText?: string;
  error?: string;
  index?: number;
}

export interface BatchGenerateResponse {
  results: BatchGenerateResult[];
}

export interface CheckoutResponse {
  url: string;
}

const subscriptionService = ({ strapi }: { strapi: Strapi }) => {
  const getBaseUrl = (): string => {
    if (process.env.ALT_TEXT_BASE_URL) {
      return process.env.ALT_TEXT_BASE_URL;
    }
    const config = strapi.config.get('plugin::strapi-plugin-alt-text-generator') as
      | { baseUrl?: string }
      | undefined;
    return config?.baseUrl || 'https://strapix.com';
  };

  const getLicenseKey = async (): Promise<string | null> => {
    const settingsService = strapi.plugin(PLUGIN_NAME).service('settings');
    return settingsService.getLicenseKey();
  };

  const defaultSubscription: SubscriptionResponse = {
    hasSubscription: false,
    isActive: false,
    cancelAtPeriodEnd: false,
    status: null,
    planName: null,
    currentPeriodEnd: null,
    generationsLimit: FREE_TIER_LIMIT,
    autoTagging: false,
    bulkProcessing: false,
    usage: null,
  };

  return {
    async hasLicenseKey(): Promise<boolean> {
      const licenseKey = await getLicenseKey();
      return !!licenseKey;
    },

    async getSubscription(): Promise<SubscriptionResponse> {
      const licenseKey = await getLicenseKey();
      if (!licenseKey) {
        return defaultSubscription;
      }

      strapi.log.info("[getSubscription] Getting subscription for license key:", licenseKey.substring(0, 10) + "...");
      try {
        const response = await fetch(`${getBaseUrl()}/api/plugin/subscription`, {
          headers: {
            'x-authorization': licenseKey,
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            strapi.log.warn('License key is invalid or expired');
            strapi.log.error('Returned status text:', response.statusText);
          } else {
            strapi.log.error(`Subscription API error: ${response.status}`);
          }
          return defaultSubscription;
        }

        return (await response.json()) as SubscriptionResponse;
      } catch (error) {
        strapi.log.error('Failed to fetch subscription status:', error);
        return defaultSubscription;
      }
    },

    async isSubscriptionActive(): Promise<boolean> {
      const subscription = await this.getSubscription();
      return subscription.isActive;
    },

    async getPortalUrl(returnUrl: string): Promise<string> {
      const licenseKey = await getLicenseKey();
      if (!licenseKey) {
        throw new Error('No license key configured');
      }

      const response = await fetch(`${getBaseUrl()}/api/plugin/portal`, {
        method: 'POST',
        headers: {
          'x-authorization': licenseKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ returnUrl }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error || 'Failed to create portal session');
      }

      const data = (await response.json()) as PortalResponse;
      return data.url;
    },

    getBaseUrl(): string {
      return getBaseUrl();
    },

    getPricingUrl(): string {
      return `${getBaseUrl()}/pricing`;
    },

    getDashboardUrl(): string {
      return `${getBaseUrl()}/dashboard`;
    },

    async getUsageWithLimits(): Promise<UsageResponse> {
      const licenseKey = await getLicenseKey();
      if (!licenseKey) {
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return {
          used: 0,
          limit: FREE_TIER_LIMIT,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
        };
      }

      try {
        const response = await fetch(`${getBaseUrl()}/api/plugin/usage`, {
          headers: {
            'x-authorization': licenseKey,
          },
        });

        if (!response.ok) {
          strapi.log.error(`Usage API error: ${response.status}`);
          const now = new Date();
          const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          return {
            used: 0,
            limit: FREE_TIER_LIMIT,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
          };
        }

        return (await response.json()) as UsageResponse;
      } catch (error) {
        strapi.log.error('Failed to fetch usage:', error);
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return {
          used: 0,
          limit: FREE_TIER_LIMIT,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
        };
      }
    },

    async incrementUsage(count: number = 1): Promise<IncrementResponse> {
      const licenseKey = await getLicenseKey();
      if (!licenseKey) {
        throw new Error('No license key configured');
      }

      const response = await fetch(`${getBaseUrl()}/api/plugin/usage/increment`, {
        method: 'POST',
        headers: {
          'x-authorization': licenseKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ count }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error || 'Failed to increment usage');
      }

      return (await response.json()) as IncrementResponse;
    },

    async canGenerate(count: number = 1): Promise<{ allowed: boolean; remaining: number }> {
      const usage = await this.getUsageWithLimits();
      const remaining = usage.limit - usage.used;
      return {
        allowed: remaining >= count,
        remaining: Math.max(0, remaining),
      };
    },

    getFreeLimit(): number {
      return FREE_TIER_LIMIT;
    },

    async generateAltText(imageBase64: string): Promise<string> {
      const licenseKey = await getLicenseKey();
      if (!licenseKey) {
        throw new Error('No license key configured');
      }

      const response = await fetch(`${getBaseUrl()}/api/plugin/generate`, {
        method: 'POST',
        headers: {
          'x-authorization': licenseKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageBase64 }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error || 'Failed to generate alt text');
      }

      const data = (await response.json()) as GenerateAltTextResponse;
      return data.altText;
    },

    async generateAltTextBatch(
      images: string[]
    ): Promise<Array<{ success: boolean; altText?: string; error?: string }>> {
      const licenseKey = await getLicenseKey();
      if (!licenseKey) {
        throw new Error('No license key configured');
      }

      if (!images || images.length === 0) {
        throw new Error('Images array is required and must not be empty');
      }

      const response = await fetch(`${getBaseUrl()}/api/plugin/generate-batch`, {
        method: 'POST',
        headers: {
          'x-authorization': licenseKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ images }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error || 'Failed to generate alt text batch');
      }

      const data = (await response.json()) as BatchGenerateResponse;
      return data.results.map(({ index, ...result }) => result);
    },

    async getCheckoutUrl(returnUrl?: string): Promise<string> {
      const licenseKey = await getLicenseKey();
      if (!licenseKey) {
        throw new Error('No license key configured');
      }

      const response = await fetch(`${getBaseUrl()}/api/plugin/checkout`, {
        method: 'POST',
        headers: {
          'x-authorization': licenseKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ returnUrl }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error || 'Failed to get checkout URL');
      }

      const data = (await response.json()) as CheckoutResponse;
      return data.url;
    },
  };
};

export default subscriptionService;
