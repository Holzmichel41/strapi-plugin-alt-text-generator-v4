import { Strapi } from '@strapi/strapi';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const PLUGIN_ID = 'strapi-plugin-alt-text-generator';
const MAX_BULK_IMAGES = 10;
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

interface GenerateRequest {
  fileId: number;
}

interface GenerateBulkRequest {
  fileIds: number[];
}

interface SaveLicenseKeyRequest {
  licenseKey: string;
}

interface CustomerPortalRequest {
  returnUrl: string;
}

interface AutoTaggingRequest {
  enabled: boolean;
}

interface BulkProcessingRequest {
  enabled: boolean;
}

const readFileAsBase64 = async (
  strapi: Strapi,
  fileUrl: string,
  mimeType?: string
): Promise<string> => {
  const localPath = fileUrl.startsWith('/uploads/') ? `uploads${fileUrl.slice(8)}` : fileUrl;
  const absolutePath = path.isAbsolute(localPath)
    ? localPath
    : path.join(strapi.dirs.static.public, localPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Image file not found: ${absolutePath}`);
  }

  const isSvg = mimeType === 'image/svg+xml' || absolutePath.toLowerCase().endsWith('.svg');

  if (isSvg) {
    const imageBuffer = fs.readFileSync(absolutePath);
    const base64Image = imageBuffer.toString('base64');
    return `data:image/svg+xml;base64,${base64Image}`;
  }

  const image = sharp(absolutePath);
  const metadata = await image.metadata();

  const maxDimension = 1024;
  const needsResize =
    metadata.width && metadata.height
      ? metadata.width > maxDimension || metadata.height > maxDimension
      : false;

  let processedImage = image;

  if (needsResize) {
    processedImage = processedImage.resize(maxDimension, maxDimension, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const optimizedBuffer = await processedImage
    .jpeg({ quality: 75 })
    .toBuffer();

  const base64Image = optimizedBuffer.toString('base64');
  return `data:image/jpeg;base64,${base64Image}`;
};

const controller = ({ strapi }: { strapi: Strapi }) => ({
  async generate(ctx) {
    const { fileId } = ctx.request.body as GenerateRequest;

    if (!fileId) {
      return ctx.badRequest('fileId is required');
    }

    const subscriptionService = strapi.plugin(PLUGIN_ID).service('subscription');

    const hasLicenseKey = await subscriptionService.hasLicenseKey();
    if (!hasLicenseKey) {
      return ctx.badRequest('License key not configured');
    }

    try {
      const file = await strapi.plugin('upload').service('upload').findOne(fileId);

      if (!file) {
        return ctx.notFound('File not found');
      }

      if (!IMAGE_MIME_TYPES.includes(file.mime)) {
        return ctx.badRequest('File is not an image');
      }

      const imageBase64 = await readFileAsBase64(strapi, file.url, file.mime);
      const altText = await subscriptionService.generateAltText(imageBase64);

      ctx.body = { success: true, altText };
    } catch (error) {
      strapi.log.error('Alt text generation failed:', error);
      const message = error instanceof Error ? error.message : 'Alt text generation failed';
      return ctx.badRequest(message);
    }
  },

  async generateBulk(ctx) {
    const { fileIds } = ctx.request.body as GenerateBulkRequest;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return ctx.badRequest('fileIds array is required');
    }

    if (fileIds.length > MAX_BULK_IMAGES) {
      return ctx.badRequest(`Maximum ${MAX_BULK_IMAGES} images allowed per request`);
    }

    const subscriptionService = strapi.plugin(PLUGIN_ID).service('subscription');
    const settingsService = strapi.plugin(PLUGIN_ID).service('settings');

    const hasLicenseKey = await subscriptionService.hasLicenseKey();
    if (!hasLicenseKey) {
      return ctx.badRequest('License key not configured');
    }

    const parallelEnabled = await settingsService.getBulkProcessingParallelEnabled();

    const results: Array<{ fileId: number; success: boolean; altText?: string; error?: string }> =
      [];

    if (parallelEnabled) {
      const imageData: Array<{ fileId: number; imageBase64: string }> = [];
      const fileIdToIndex = new Map<number, number>();

      for (let i = 0; i < fileIds.length; i++) {
        const fileId = fileIds[i];
        try {
          const file = await strapi.plugin('upload').service('upload').findOne(fileId);

          if (!file) {
            results.push({ fileId, success: false, error: 'File not found' });
            continue;
          }

          if (!IMAGE_MIME_TYPES.includes(file.mime)) {
            results.push({ fileId, success: false, error: 'File is not an image' });
            continue;
          }

          const imageBase64 = await readFileAsBase64(strapi, file.url, file.mime);
          imageData.push({ fileId, imageBase64 });
          fileIdToIndex.set(fileId, imageData.length - 1);
        } catch (error) {
          strapi.log.error(`Failed to read file ${fileId}:`, error);
          results.push({
            fileId,
            success: false,
            error: 'Failed to read image file',
          });
        }
      }

      if (imageData.length > 0) {
        try {
          const images = imageData.map((item) => item.imageBase64);
          const batchResults = await subscriptionService.generateAltTextBatch(images);

          for (let i = 0; i < batchResults.length; i++) {
            const batchResult = batchResults[i];
            const { fileId } = imageData[i];

            if (batchResult.success && batchResult.altText) {
              try {
                await strapi.entityService.update('plugin::upload.file', fileId, {
                  data: { alternativeText: batchResult.altText } as any,
                });
                results.push({ fileId, success: true, altText: batchResult.altText });
              } catch (error) {
                strapi.log.error(`Failed to update file ${fileId}:`, error);
                results.push({
                  fileId,
                  success: false,
                  error: 'Failed to save alt text',
                });
              }
            } else {
              results.push({
                fileId,
                success: false,
                error: batchResult.error || 'Generation failed',
              });
            }
          }
        } catch (error) {
          strapi.log.error('Batch processing failed:', error);
          const message = error instanceof Error ? error.message : 'Batch processing failed';
          for (const { fileId } of imageData) {
            const alreadyProcessed = results.some((r) => r.fileId === fileId);
            if (!alreadyProcessed) {
              results.push({ fileId, success: false, error: message });
            }
          }
        }
      }
    } else {
      for (const fileId of fileIds) {
        try {
          const file = await strapi.plugin('upload').service('upload').findOne(fileId);

          if (!file) {
            results.push({ fileId, success: false, error: 'File not found' });
            continue;
          }

          if (!IMAGE_MIME_TYPES.includes(file.mime)) {
            results.push({ fileId, success: false, error: 'File is not an image' });
            continue;
          }

          const imageBase64 = await readFileAsBase64(strapi, file.url, file.mime);
          const altText = await subscriptionService.generateAltText(imageBase64);

          await strapi.entityService.update('plugin::upload.file', fileId, {
            data: { alternativeText: altText } as any,
          });

          results.push({ fileId, success: true, altText });
        } catch (error) {
          strapi.log.error(`Alt text generation failed for file ${fileId}:`, error);
          const message = error instanceof Error ? error.message : 'Generation failed';
          results.push({ fileId, success: false, error: message });
        }
      }
    }

    ctx.body = { results };
  },

  async getSettings(ctx) {
    const settingsService = strapi.plugin(PLUGIN_ID).service('settings');
    const hasLicenseKey = await settingsService.hasLicenseKey();
    ctx.body = { hasLicenseKey };
  },

  async getLicenseKey(ctx) {
    const settingsService = strapi.plugin(PLUGIN_ID).service('settings');
    const hasLicenseKey = await settingsService.hasLicenseKey();
    ctx.body = { hasLicenseKey };
  },

  async saveLicenseKey(ctx) {
    const { licenseKey } = ctx.request.body as SaveLicenseKeyRequest;

    if (!licenseKey || typeof licenseKey !== 'string' || licenseKey.trim().length === 0) {
      return ctx.badRequest('licenseKey is required');
    }

    const trimmed = licenseKey.trim();
    if (!trimmed.startsWith('strapix_')) {
      return ctx.badRequest('Invalid license key format');
    }

    const settingsService = strapi.plugin(PLUGIN_ID).service('settings');
    await settingsService.setLicenseKey(trimmed);
    ctx.body = { success: true };
  },

  async deleteLicenseKey(ctx) {
    const settingsService = strapi.plugin(PLUGIN_ID).service('settings');
    await settingsService.deleteLicenseKey();
    ctx.body = { success: true };
  },

  async getSubscription(ctx) {
    const subscriptionService = strapi.plugin(PLUGIN_ID).service('subscription');
    const subscription = await subscriptionService.getSubscription();
    ctx.body = subscription;
  },

  async getPricingInfo(ctx) {
    const subscriptionService = strapi.plugin(PLUGIN_ID).service('subscription');
    const pricingUrl = subscriptionService.getPricingUrl();
    const dashboardUrl = subscriptionService.getDashboardUrl();
    const hasLicenseKey = await subscriptionService.hasLicenseKey();
    ctx.body = { pricingUrl, dashboardUrl, hasLicenseKey };
  },

  async createCustomerPortal(ctx) {
    const { returnUrl } = ctx.request.body as CustomerPortalRequest;

    if (!returnUrl) {
      return ctx.badRequest('returnUrl is required');
    }

    try {
      const subscriptionService = strapi.plugin(PLUGIN_ID).service('subscription');
      const portalUrl = await subscriptionService.getPortalUrl(returnUrl);
      ctx.body = { url: portalUrl };
    } catch (error) {
      strapi.log.error('Failed to create customer portal session:', error);
      const message = error instanceof Error ? error.message : 'Failed to create portal session';
      return ctx.badRequest(message);
    }
  },

  async getUsage(ctx) {
    const subscriptionService = strapi.plugin(PLUGIN_ID).service('subscription');
    const usage = await subscriptionService.getUsageWithLimits();
    ctx.body = usage;
  },

  async getAutoTagging(ctx) {
    const settingsService = strapi.plugin(PLUGIN_ID).service('settings');
    const subscriptionService = strapi.plugin(PLUGIN_ID).service('subscription');

    let enabled = await settingsService.getAutoTaggingEnabled();
    const subscription = await subscriptionService.getSubscription();
    const available = subscription.isActive && subscription.autoTagging;

    if (enabled && !available) {
      await settingsService.setAutoTaggingEnabled(false);
      enabled = false;
    }

    ctx.body = { enabled, available };
  },

  async setAutoTagging(ctx) {
    const { enabled } = ctx.request.body as AutoTaggingRequest;

    if (typeof enabled !== 'boolean') {
      return ctx.badRequest('enabled must be a boolean');
    }

    if (enabled) {
      const subscriptionService = strapi.plugin(PLUGIN_ID).service('subscription');
      const subscription = await subscriptionService.getSubscription();

      if (!subscription.isActive || !subscription.autoTagging) {
        return ctx.forbidden('Auto-tagging feature is not available on your current plan');
      }
    }

    const settingsService = strapi.plugin(PLUGIN_ID).service('settings');
    await settingsService.setAutoTaggingEnabled(enabled);
    ctx.body = { success: true, enabled };
  },

  async getBulkProcessing(ctx) {
    const settingsService = strapi.plugin(PLUGIN_ID).service('settings');
    const subscriptionService = strapi.plugin(PLUGIN_ID).service('subscription');

    let enabled = await settingsService.getBulkProcessingParallelEnabled();
    const subscription = await subscriptionService.getSubscription();
    const available = subscription.isActive && subscription.bulkProcessing;

    if (enabled && !available) {
      await settingsService.setBulkProcessingParallelEnabled(false);
      enabled = false;
    }

    ctx.body = { enabled, available };
  },

  async setBulkProcessing(ctx) {
    const { enabled } = ctx.request.body as BulkProcessingRequest;

    if (typeof enabled !== 'boolean') {
      return ctx.badRequest('enabled must be a boolean');
    }

    if (enabled) {
      const subscriptionService = strapi.plugin(PLUGIN_ID).service('subscription');
      const subscription = await subscriptionService.getSubscription();

      if (!subscription.isActive || !subscription.bulkProcessing) {
        return ctx.forbidden('Bulk processing feature is not available on your current plan');
      }
    }

    const settingsService = strapi.plugin(PLUGIN_ID).service('settings');
    await settingsService.setBulkProcessingParallelEnabled(enabled);
    ctx.body = { success: true, enabled };
  },

  async getCheckoutUrl(ctx) {
    const { returnUrl } = ctx.request.body as { returnUrl?: string };

    try {
      const subscriptionService = strapi.plugin(PLUGIN_ID).service('subscription');
      const url = await subscriptionService.getCheckoutUrl(returnUrl);
      ctx.body = { url };
    } catch (error) {
      strapi.log.error('Failed to get checkout URL:', error);
      const message = error instanceof Error ? error.message : 'Failed to get checkout URL';
      return ctx.badRequest(message);
    }
  },
});

export default controller;
