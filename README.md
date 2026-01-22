# strapi-plugin-alt-text-generator-v4

Automatically generates AI-powered alt text for images in the Strapi Media Library to improve accessibility and content quality.

> **Note:** This plugin is currently only compatible with **Strapi v4**.
>
> **Looking for Strapi v5?** Use [@strapix/strapi-plugin-alt-text-generator](https://www.npmjs.com/package/@strapix/strapi-plugin-alt-text-generator) instead.

![Alternative Text Generator Plugin](https://strapix.com/plugin-screenshot-v4.png)

🎬 [Watch the demo video](https://strapix.com/preview.mov)

## Installation

### Step 1: Install the Plugin

Run the following command in your Strapi project:

```bash
npm install @strapix/strapi-plugin-alt-text-generator-v4
```

### Step 2: Enable the Plugin

In Strapi v4, you need to explicitly enable plugins in your configuration. Create or update the `config/plugins.js` file in your Strapi project root:

```javascript
module.exports = {
  'strapi-plugin-alt-text-generator': {
    enabled: true,
    resolve: './node_modules/@strapix/strapi-plugin-alt-text-generator-v4'
  },
};
```

### Step 3: Rebuild the Admin Panel

After installing and enabling the plugin, rebuild the admin panel:

```bash
npm run build
```

Then restart your Strapi server:

```bash
npm run develop
```

### Step 4: Add Your License Key

1. Copy your license key from the [Strapix Dashboard](https://strapix.com/dashboard)
2. Go to **Settings → Alternative Text Generator → Settings** in your Strapi admin panel
3. Paste your license key in the plugin settings

### Step 5: Start Generating

1. Find the **Alternative Text Generator** plugin in your Strapi sidebar menu
2. Optional: Upload images to your Strapi Media Library
3. Open the plugin to generate alternative text for your images

**Pro tip:** On Business or Enterprise plans, uploaded images can be automatically tagged with the generated alternative text during upload.

## License

MIT
