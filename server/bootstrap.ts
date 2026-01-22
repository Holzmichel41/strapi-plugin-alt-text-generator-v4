import { Strapi } from '@strapi/strapi';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const PLUGIN_NAME = 'strapi-plugin-alt-text-generator';
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

interface FileResult {
  id: number;
  mime: string;
  url: string;
  alternativeText?: string;
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

const bootstrap = async ({ strapi }: { strapi: Strapi }) => {
  const store = strapi.store({ type: 'plugin', name: PLUGIN_NAME });
  const instance = (await store.get({ key: 'instance' })) as { id?: string } | null;

  if (!instance?.id) {
    const instanceId = crypto.randomUUID();
    await store.set({ key: 'instance', value: { id: instanceId } });
    strapi.log.info(`[${PLUGIN_NAME}] Generated new instance ID: ${instanceId}`);
  }

  strapi.db.lifecycles.subscribe({
    models: ['plugin::upload.file'],
    async afterCreate(event: any) {
      const result = event.result as FileResult;

      if (!IMAGE_MIME_TYPES.includes(result.mime)) {
        return;
      }

      if (result.alternativeText) {
        return;
      }

      try {
        const settingsService = strapi.plugin(PLUGIN_NAME).service('settings');
        const subscriptionService = strapi.plugin(PLUGIN_NAME).service('subscription');

        const autoTaggingEnabled = await settingsService.getAutoTaggingEnabled();
        if (!autoTaggingEnabled) {
          return;
        }

        const hasLicenseKey = await subscriptionService.hasLicenseKey();
        if (!hasLicenseKey) {
          strapi.log.warn(`[${PLUGIN_NAME}] Auto-tagging skipped: no license key configured`);
          return;
        }

        const subscription = await subscriptionService.getSubscription();
        if (!subscription.isActive || !subscription.autoTagging) {
          return;
        }

        const imageBase64 = await readFileAsBase64(strapi, result.url, result.mime);
        const altText = await subscriptionService.generateAltText(imageBase64);

        await strapi.entityService.update('plugin::upload.file', result.id, {
          data: { alternativeText: altText } as any,
        });

        strapi.log.info(`[${PLUGIN_NAME}] Auto-generated alt text for file ${result.id}`);
      } catch (error) {
        strapi.log.error(`[${PLUGIN_NAME}] Auto-tagging failed for file ${result.id}:`, error);
      }
    },
  });
};

export default bootstrap;
