import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'Gemini Prompt Copy',
    description: 'Adds a button to copy prompts sent in Gemini',
    permissions: ['clipboardWrite']
  }
});
