import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../api/openapi.json',
  output: 'src/app/api',
  plugins: ['@hey-api/client-fetch', '@hey-api/sdk'],
});
