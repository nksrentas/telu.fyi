import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type Step = { click?: string; rightClick?: string; waitFor?: string; press?: string; hover?: string; dispatch?: string; type?: string };
type StoreSeed = { keyPath: string; autoIncrement?: boolean; indexes?: [string, string | string[], boolean][]; records?: unknown[] };
type IndexedDbSeed = { name: string; version: number; stores: Record<string, StoreSeed> };
type Screen = {
  name: string;
  path: string;
  ipc?: Record<string, unknown>;
  steps?: Step[];
  themes?: string[];
  localStorage?: Record<string, string>;
  indexedDb?: IndexedDbSeed;
  viewport?: { width: number; height: number };
};
type GalleryWindow = Window & { __TELU_IPC__?: Record<string, unknown>; __TELU_THEME__?: string; __TELU_UNMOCKED__?: string[] };

const here = __dirname;
const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
const baseIpc = readJson<Record<string, unknown>>(path.join(here, 'fixtures', 'base-ipc.json'));
const screens = fs
  .readdirSync(path.join(here, 'screens'))
  .filter((file) => file.endsWith('.json'))
  .sort()
  .flatMap((file) => readJson<Screen[]>(path.join(here, 'screens', file)));
const stub = fs.readFileSync(path.join(here, 'tauri-ipc-stub.js'), 'utf8');
const label = process.env.GALLERY_LABEL;
const outputRoot = label
  ? path.resolve(here, '../../../.planning/phases/02-evidence-linked-post-meeting-knowledge/gallery', label)
  : path.join(here, '.output');

async function runStep(page: import('@playwright/test').Page, step: Step) {
  if (step.click) await page.locator(step.click).first().click();
  if (step.rightClick) await page.locator(step.rightClick).first().click({ button: 'right' });
  if (step.type) await page.keyboard.type(step.type);
  if (step.hover) await page.locator(step.hover).first().hover();
  if (step.waitFor) await page.locator(step.waitFor).first().waitFor();
  if (step.press) await page.keyboard.press(step.press);
  if (step.dispatch) await page.evaluate((name) => window.dispatchEvent(new Event(name)), step.dispatch);
}

function seedBrowserStorage(seed: { localStorage?: Record<string, string>; indexedDb?: IndexedDbSeed }) {
  Object.entries(seed.localStorage ?? {}).forEach(([key, value]) => window.localStorage.setItem(key, value));
  const database = seed.indexedDb;
  if (!database) return;
  const request = window.indexedDB.open(database.name, database.version);
  request.onupgradeneeded = () => {
    const db = request.result;
    Object.entries(database.stores).forEach(([name, store]) => {
      const created = db.createObjectStore(name, { keyPath: store.keyPath, autoIncrement: store.autoIncrement ?? false });
      (store.indexes ?? []).forEach(([indexName, keyPath, unique]) => created.createIndex(indexName, keyPath, { unique }));
    });
  };
  request.onsuccess = () => {
    const db = request.result;
    const names = Object.keys(database.stores);
    const transaction = db.transaction(names, 'readwrite');
    names.forEach((name) => (database.stores[name].records ?? []).forEach((record) => transaction.objectStore(name).put(record)));
    transaction.oncomplete = () => db.close();
  };
}

for (const screen of screens) {
  for (const theme of screen.themes ?? ['light', 'dark']) {
    test(`${screen.name} ${theme}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.emulateMedia({ colorScheme: theme as 'light' | 'dark', reducedMotion: 'reduce' });
      await page.addInitScript(
        ({ ipc, activeTheme }) => {
          const target = window as GalleryWindow;
          target.__TELU_IPC__ = ipc;
          target.__TELU_THEME__ = activeTheme;
        },
        { ipc: { ...baseIpc, ...(screen.ipc ?? {}) }, activeTheme: theme },
      );
      await page.addInitScript({ content: stub });
      await page.addInitScript(seedBrowserStorage, { localStorage: screen.localStorage, indexedDb: screen.indexedDb });
      if (screen.viewport) await page.setViewportSize(screen.viewport);
      await page.goto(screen.path);
      await page.waitForLoadState('networkidle');
      for (const step of screen.steps ?? []) {
        await runStep(page, step);
      }
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: path.join(outputRoot, theme, `${screen.name}.png`), animations: 'disabled', fullPage: false });
      const unmocked = await page.evaluate(() => (window as GalleryWindow).__TELU_UNMOCKED__ ?? []);
      expect(errors, 'page errors').toEqual([]);
      expect([...new Set(unmocked)], 'unmocked commands').toEqual([]);
    });
  }
}
