import { prefixPluginTranslations } from '@strapi/helper-plugin';

import pluginPkg from '../../package.json';
import pluginId from './pluginId';
import Initializer from './components/Initializer';
import PluginIcon from './components/PluginIcon';
import { getTranslation } from './utils/getTrad';

const name = pluginPkg.strapi.name;

export default {
  register(app: any) {
    app.registerPlugin({
      id: pluginId,
      initializer: Initializer,
      isReady: false,
      name,
    });

    app.addMenuLink({
      to: `/plugins/${pluginId}`,
      icon: PluginIcon,
      intlLabel: {
        id: getTranslation('plugin.name'),
        defaultMessage: 'Alternative Text Generator',
      },
      Component: async () => {
        const component = await import('./pages/BulkPage');
        return component.default;
      },
    });

    app.createSettingSection(
      {
        id: pluginId,
        intlLabel: {
          id: getTranslation('plugin.name'),
          defaultMessage: 'Alternative Text Generator',
        },
      },
      [
        {
          intlLabel: {
            id: getTranslation('settings.title'),
            defaultMessage: 'Settings',
          },
          id: 'settings',
          to: `/settings/${pluginId}/settings`,
          Component: async () => {
            const component = await import('./pages/SettingsPage');
            return component.default;
          },
        },
      ]
    );
  },

  bootstrap() { },

  async registerTrads(app: any) {
    const { locales } = app;

    const importedTrads = await Promise.all(
      (locales as any[]).map((locale) => {
        return import(`./translations/${locale}.json`)
          .then(({ default: data }) => {
            return {
              data: prefixPluginTranslations(data, pluginId),
              locale,
            };
          })
          .catch(() => {
            return {
              data: {},
              locale,
            };
          });
      })
    );

    return Promise.resolve(importedTrads);
  },
};
