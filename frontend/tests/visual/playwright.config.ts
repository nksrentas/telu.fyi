import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const port = Number(process.env.TELU_GALLERY_PORT ?? 3218);
const frontendRoot = path.resolve(__dirname, '../..');
const galleryBrowser = {
  ...devices['Desktop Safari'],
  viewport: { width: 1100, height: 700 },
  reducedMotion: 'reduce' as const,
  baseURL: `http://localhost:${port}`,
};

export default defineConfig({
  testDir: __dirname,
  testMatch: '*.visual.ts',
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [['list']],
  outputDir: path.join(__dirname, '.output', 'test-results'),
  projects: [{ name: 'webkit', use: galleryBrowser }],
  webServer: {
    command: `pnpm exec next dev -p ${port}`,
    cwd: frontendRoot,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: { NEXT_TELEMETRY_DISABLED: '1', NEXT_DIST_DIR: '.next-gallery' },
  },
});
