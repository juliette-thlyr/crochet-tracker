import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// `npm run icons` rebuilds public/icons/icon.svg (scripts/make-icon.mjs) and every size from it.
// The SVG carries its own background and margin; padding is filled with the same colour.
const background = '#E4EEF9';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0.2, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background } },
  },
  images: ['public/icons/icon.svg'],
});
