import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const testsRoot = import.meta.dir;
const testFiles = (readdirSync(testsRoot, { recursive: true }) as string[])
  .filter(path => /\.test\.(ts|tsx|js|mjs)$/.test(path));

const specifiers = (source: string, pattern: RegExp) => new Set([...source.matchAll(pattern)].map(match => match[1]));

describe('module mocks', () => {
  test.each(testFiles)('%s restores every module it mocks', path => {
    const source = readFileSync(join(testsRoot, path), 'utf8');
    const mocked = specifiers(source, /mock\.module\(["'`]([^"'`]+)["'`]/g);
    const restored = specifiers(source, /mock\.module\(["'`]([^"'`]+)["'`], \(\) => original[\w.]*\)/g);
    expect([...mocked].filter(specifier => !restored.has(specifier))).toEqual([]);
    expect(source).not.toMatch(/afterAll\(\(\) => mock\.module/);
  });
});
