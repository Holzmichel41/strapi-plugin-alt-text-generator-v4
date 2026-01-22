export default [
  {
    method: 'POST',
    path: '/generate',
    handler: 'controller.generate',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'POST',
    path: '/generate-bulk',
    handler: 'controller.generateBulk',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'GET',
    path: '/settings',
    handler: 'controller.getSettings',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'GET',
    path: '/license-key',
    handler: 'controller.getLicenseKey',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'POST',
    path: '/license-key',
    handler: 'controller.saveLicenseKey',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'DELETE',
    path: '/license-key',
    handler: 'controller.deleteLicenseKey',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'GET',
    path: '/subscription',
    handler: 'controller.getSubscription',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'GET',
    path: '/pricing-info',
    handler: 'controller.getPricingInfo',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'POST',
    path: '/customer-portal',
    handler: 'controller.createCustomerPortal',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'GET',
    path: '/usage',
    handler: 'controller.getUsage',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'GET',
    path: '/auto-tagging',
    handler: 'controller.getAutoTagging',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'POST',
    path: '/auto-tagging',
    handler: 'controller.setAutoTagging',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'GET',
    path: '/bulk-processing',
    handler: 'controller.getBulkProcessing',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'POST',
    path: '/bulk-processing',
    handler: 'controller.setBulkProcessing',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'POST',
    path: '/checkout',
    handler: 'controller.getCheckoutUrl',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
];
