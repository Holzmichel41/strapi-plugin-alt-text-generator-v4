export default {
  default: {
    baseUrl: 'https://strapix.com',
  },
  validator(config: { baseUrl?: string }) {
    if (config.baseUrl && typeof config.baseUrl !== 'string') {
      throw new Error('baseUrl must be a string');
    }
  },
};
