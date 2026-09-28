import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css']);
const DEFAULT_SCOPE = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const PREFIX = '(bg|text|border(?:-[xytrblse])?|ring|outline|divide|placeholder|fill|stroke|from|via|to|shadow|decoration|caret|accent)';
const OPACITY = '(?:\\/(\\d+|\\[[\\d.]+\\]))';
const FAMILIES = {
  neutral: ['gray', 'slate', 'zinc', 'neutral', 'stone'],
  accent: ['blue', 'indigo', 'violet', 'purple', 'sky', 'fuchsia'],
  coral: ['red', 'rose', 'pink'],
  amber: ['yellow', 'amber', 'orange'],
  green: ['green', 'emerald', 'lime'],
  teal: ['teal', 'cyan'],
};
const FAMILY_OF = Object.fromEntries(
  Object.entries(FAMILIES).flatMap(([family, names]) => names.map((name) => [name, family])),
);
const TOKENS = [
  '(?:primary|secondary|muted|accent|destructive|popover|card)(?:-foreground)?',
  'background|foreground|border|input|ring',
  'accent-(?:strong|soft|softer)|mint(?:-ink|-soft)?|coral(?:-ink|-soft)?|amber(?:-soft)?',
  'label(?:-[234])?|window|content|surface(?:-sunken)?|fill(?:-[23])?|separator|hairline',
  'glass(?:-strong|-rim|-edge)?|scrim|series-(?:blue|orange|green|purple|teal|pink|gray)',
].join('|');
const PALETTE = new RegExp(`^${PREFIX}-(${Object.keys(FAMILY_OF).join('|')})-(50|[1-9]00|950)${OPACITY}?$`);
const MONO = new RegExp(`^(bg-white|bg-black|text-black|border-white)${OPACITY}?$`);
const TOKEN_OPACITY = new RegExp(`^${PREFIX}-(${TOKENS})${OPACITY}$`);
const HSL_VARIABLE = /hsl\(\s*var\(--[\w-]+\)[^)]*\)/g;
const CANDIDATE = /(\s?)([^\s"'`{}(),;]+)/g;
const MONO_MAP = {
  'bg-white': ['bg-content', 'bg-glass-strong'],
  'bg-black': ['bg-label', 'bg-scrim'],
  'text-black': ['text-label', 'text-label'],
  'border-white': ['border-glass-rim', 'border-glass-rim'],
};

const isOutline = (prefix) => /^(border|ring|outline|divide)/.test(prefix);

function parseOpacity(raw) {
  if (raw === undefined) return null;
  const value = Number(raw.replace(/[[\]]/g, ''));
  return value < 1 ? value * 100 : value;
}

function splitVariant(token) {
  let depth = 0;
  let cut = -1;
  [...token].forEach((character, index) => {
    if (character === '[') depth += 1;
    if (character === ']') depth -= 1;
    if (character === ':' && depth === 0) cut = index;
  });
  const rest = token.slice(cut + 1);
  const important = rest.startsWith('!') ? '!' : '';
  return { variant: token.slice(0, cut + 1) + important, utility: rest.slice(important.length) };
}

function neutralName(prefix, shade) {
  if (prefix === 'text') return shade >= 700 ? 'label' : shade >= 500 ? 'label-2' : shade === 400 ? 'label-3' : 'label-4';
  if (prefix === 'bg') {
    if (shade === 50) return 'surface-sunken';
    return shade === 100 ? 'fill' : shade === 200 ? 'fill-2' : shade <= 400 ? 'fill-3' : 'label';
  }
  if (prefix === 'ring') return 'hairline';
  if (isOutline(prefix)) return shade <= 200 ? 'separator' : 'hairline';
  return prefix === 'placeholder' ? 'label-3' : 'label-2';
}

function accentName(prefix, shade, opacity) {
  if (prefix === 'bg') {
    if (opacity !== null && opacity <= 20) return 'accent-soft';
    return shade === 50 ? 'accent-softer' : shade <= 200 ? 'accent-soft' : shade <= 600 ? 'accent' : 'accent-strong';
  }
  if (prefix === 'text') return shade >= 700 ? 'accent-strong' : 'accent';
  if (isOutline(prefix)) return shade <= 200 ? 'accent-soft' : 'accent';
  return 'accent';
}

function tintName(prefix, shade, opacity, base, soft, ink) {
  const faint = shade <= 200 || (opacity !== null && opacity <= 20);
  if (prefix === 'bg') return faint ? soft : base;
  return prefix === 'text' ? ink : base;
}

function paletteName(prefix, family, shade, opacity) {
  if (family === 'neutral') return neutralName(prefix, shade);
  if (family === 'accent') return accentName(prefix, shade, opacity);
  if (family === 'coral') return tintName(prefix, shade, opacity, 'coral', 'coral-soft', 'coral-ink');
  if (family === 'amber') return tintName(prefix, shade, opacity, 'amber', 'amber-soft', 'amber');
  const series = family === 'green' ? 'series-green' : 'series-teal';
  return tintName(prefix, shade, opacity, series, 'fill', series);
}

function tokenName(prefix, token) {
  const softOrInk = (soft, ink, base) => (prefix === 'text' ? ink : prefix === 'bg' || isOutline(prefix) ? soft : base);
  if (['primary', 'accent', 'ring'].includes(token)) return softOrInk('accent-soft', 'accent', 'accent');
  if (token === 'destructive') return softOrInk('coral-soft', 'coral-ink', 'coral');
  const neutral = { bg: 'fill', outline: 'separator' };
  if (['secondary', 'muted', 'card', 'popover', 'background'].includes(token)) {
    return prefix === 'bg' ? neutral.bg : isOutline(prefix) ? neutral.outline : null;
  }
  if (token === 'foreground') return prefix === 'text' ? 'label-2' : prefix === 'bg' ? neutral.bg : isOutline(prefix) ? neutral.outline : null;
  if (['border', 'input'].includes(token)) return prefix === 'bg' || isOutline(prefix) ? 'separator' : null;
  return null;
}

function mapUtility(utility) {
  const palette = PALETTE.exec(utility);
  if (palette) {
    const [, prefix, name, shade, opacity] = palette;
    return prefix === 'shadow' ? '' : `${prefix}-${paletteName(prefix, FAMILY_OF[name], Number(shade), parseOpacity(opacity))}`;
  }
  const mono = MONO.exec(utility);
  if (mono) return MONO_MAP[mono[1]][mono[2] === undefined ? 0 : 1];
  const token = TOKEN_OPACITY.exec(utility);
  if (!token) return null;
  if (token[1] === 'shadow') return '';
  const name = tokenName(token[1], token[2]);
  return name === null ? null : `${token[1]}-${name}`;
}

function isOffender(token) {
  const { utility } = splitVariant(token);
  return PALETTE.test(utility) || MONO.test(utility) || TOKEN_OPACITY.test(utility);
}

export function mapClass(token) {
  if (!isOffender(token)) return null;
  const { variant, utility } = splitVariant(token);
  const mapped = mapUtility(utility);
  if (mapped === null) return null;
  return mapped === '' ? '' : `${variant}${mapped}`;
}

export function findOffenders(source) {
  return source.split('\n').flatMap((text, index) => {
    const line = index + 1;
    const classes = [...text.matchAll(CANDIDATE)].map((match) => match[2]).filter(isOffender);
    const variables = text.match(HSL_VARIABLE) ?? [];
    return [...classes, ...variables].map((token) => ({ line, token }));
  });
}

function migrateSource(source) {
  let replaced = 0;
  let unmapped = 0;
  const output = source.replace(CANDIDATE, (whole, space, token) => {
    if (!isOffender(token)) return whole;
    const mapped = mapClass(token);
    if (mapped === null) {
      unmapped += 1;
      return whole;
    }
    replaced += 1;
    return mapped === '' ? '' : `${space}${mapped}`;
  });
  return { output, replaced, unmapped };
}

function collectFiles(path) {
  const stats = statSync(path);
  if (stats.isFile()) return SOURCE_EXTENSIONS.has(extname(path)) ? [path] : [];
  return readdirSync(path)
    .filter((name) => name !== 'node_modules' && !name.startsWith('.'))
    .sort()
    .flatMap((name) => collectFiles(join(path, name)));
}

function check(paths) {
  const offenders = paths.flatMap(collectFiles).flatMap((file) =>
    findOffenders(readFileSync(file, 'utf8')).map((offender) => ({ file, ...offender })),
  );
  offenders.forEach(({ file, line, token }) => console.log(`${file}:${line}  ${token}`));
  console.log(`${offenders.length} offending classes`);
  return offenders.length === 0 ? 0 : 1;
}

function migrate(paths) {
  paths.flatMap(collectFiles).forEach((file) => {
    const source = readFileSync(file, 'utf8');
    const { output, replaced, unmapped } = migrateSource(source);
    if (output !== source) writeFileSync(file, output);
    if (replaced > 0 || unmapped > 0) console.log(`${file}: ${replaced} replaced, ${unmapped} left for review`);
  });
  return 0;
}

function main([command, ...paths]) {
  if (command === 'check') return check(paths.length > 0 ? paths : [DEFAULT_SCOPE]);
  if (command === 'migrate' && paths.length > 0) return migrate(paths);
  console.error('usage: telu-palette.mjs check [paths…] | migrate <paths…>');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`telu-palette: ${error.message}`);
    process.exitCode = 2;
  }
}
