const { readFileSync, readdirSync } = require('node:fs');
const { join, relative } = require('node:path');

const REPO_ROOT = join(__dirname, '..');
const FRONTEND = join(REPO_ROOT, 'frontend');
const RUST_MODULES = ['documents', 'preparation', 'planning'].map((name) => join(FRONTEND, 'src-tauri/src', name));
const FRONTEND_FILES = [
  ...listFiles(join(FRONTEND, 'src/components/preparation'), '.tsx'),
  ...['document', 'planning', 'preparation'].map((name) => join(FRONTEND, `src/lib/${name}-service.ts`)),
  join(FRONTEND, 'src/app/preparation/page.tsx'),
];

const RUST_LOG_ALLOWED = new Set(['error', 'removed', 'run.id']);
const CONSOLE_ALLOWED = new Set(['error', 'loadError', 'result.code']);
const RUST_LOG_CALL = /(?<![\w:])(?:(?:log|tracing)::)?(?:info|warn|error)!\s*\(/g;
const RUST_PRINT_CALL = /(?<![\w:])(?:println|eprintln|print|eprint|dbg)!\s*\(/g;
const CONSOLE_CALL = /\bconsole\.(?:log|info|warn|error)\s*\(/g;
const PLACEHOLDER = /(?<!\{)\{([A-Za-z_][\w.]*)(?::[^}]*)?\}/g;
const RENDERER_FS_IMPORT = /['"]@tauri-apps\/plugin-(?:fs|dialog)['"]/g;
const ANALYTICS = /analytics/gi;
const REPLACE_SOURCE = /enum ReplaceSource \{\s*Paste \{ text: String \},\s*Import,\s*\}/;
const REPLACE_IMPORT_PICKS = /ReplaceSource::Import => \{[^}]*\bpick\(app\)/;
const CLOSERS = { '(': ')', '[': ']', '{': '}' };

function listFiles(dir, extension) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(path, extension);
    return path.endsWith(extension) ? [path] : [];
  });
}

function skipString(source, start) {
  const quote = source[start];
  let index = start + 1;
  while (index < source.length && source[index] !== quote) index += source[index] === '\\' ? 2 : 1;
  return index;
}

function callArguments(source, openParen) {
  const args = [];
  const stack = [')'];
  let current = '';
  for (let index = openParen + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"' || char === '`' || char === "'") {
      const end = skipString(source, index);
      current += source.slice(index, end + 1);
      index = end;
      continue;
    }
    if (CLOSERS[char]) stack.push(CLOSERS[char]);
    else if (char === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) return [...args, current.trim()].filter(Boolean);
    } else if (char === ',' && stack.length === 1) {
      args.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  return [...args, current.trim()].filter(Boolean);
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

function mentions(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => lineOf(source, match.index));
}

function calls(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => ({
    line: lineOf(source, match.index),
    args: callArguments(source, match.index + match[0].length - 1),
  }));
}

function isStringLiteral(arg) {
  return /^"(?:[^"\\]|\\.)*"$/.test(arg) || /^'(?:[^'\\]|\\.)*'$/.test(arg) || /^`[^`]*`$/.test(arg);
}

function rustLogExpressions(arg) {
  if (isStringLiteral(arg)) return [...arg.matchAll(PLACEHOLDER)].map((match) => match[1]);
  const field = arg.match(/^[\w.]+\s*=(?!=)\s*(.+)$/s);
  return [(field ? field[1] : arg).replace(/^[%?]/, '').trim()];
}

function rustFindings(source, file) {
  const logs = calls(source, RUST_LOG_CALL).flatMap(({ line, args }) =>
    args
      .flatMap(rustLogExpressions)
      .filter((expression) => !RUST_LOG_ALLOWED.has(expression))
      .map((expression) => ({ file, line, rule: 'log-content', expression })),
  );
  const prints = calls(source, RUST_PRINT_CALL).map(({ line }) => ({ file, line, rule: 'print' }));
  const analytics = mentions(source, ANALYTICS).map((line) => ({ file, line, rule: 'analytics' }));
  return [...logs, ...prints, ...analytics];
}

function consoleExpressions(arg) {
  if (arg.startsWith('`')) return [...arg.matchAll(/\$\{([^}]*)\}/g)].map((match) => match[1].trim());
  return isStringLiteral(arg) ? [] : [arg];
}

function frontendFindings(source, file) {
  const analytics = mentions(source, ANALYTICS).map((line) => ({ file, line, rule: 'analytics' }));
  const rendererFs = [...source.matchAll(RENDERER_FS_IMPORT)].map((match) => ({ file, rule: 'renderer-fs', expression: match[0] }));
  const logs = calls(source, CONSOLE_CALL).flatMap(({ line, args }) =>
    args
      .flatMap(consoleExpressions)
      .filter((expression) => !CONSOLE_ALLOWED.has(expression))
      .map((expression) => ({ file, line, rule: 'log-content', expression })),
  );
  return [...analytics, ...rendererFs, ...logs];
}

function importFindings({ rust, service, picker }) {
  const signature = rust.match(/fn documents_import\b[^(]*\(([^)]*(?:\([^)]*\)[^)]*)*)\)/);
  const params = signature ? signature[1].split(/,\s*\n/).map((param) => param.trim()).filter(Boolean) : [];
  const fromRenderer = params.filter((param) => !/^(app: AppHandle<R>|state: tauri::State<'_, AppState>),?$/.test(param));
  return [
    ...(signature ? [] : [{ rule: 'import-command' }]),
    ...fromRenderer.map((expression) => ({ rule: 'import-path-param', expression })),
    ...(/['"]documents_import['"]\s*\)/.test(service) ? [] : [{ rule: 'import-args' }]),
    ...(/\.dialog\(\)\s*\.file\(\)/.test(picker) ? [] : [{ rule: 'import-picker' }]),
    ...(REPLACE_SOURCE.test(rust) && REPLACE_IMPORT_PICKS.test(rust) ? [] : [{ rule: 'replace-import' }]),
  ];
}

function routeConfirmationFindings({ block, service, commands }) {
  const validated = block.match(/const (\w+) = await validateProviderRoute\(/);
  const generate = block.indexOf('generateBriefing(');
  const revalidated =
    validated &&
    validated.index < generate &&
    block.includes(`isRouteAvailable(${validated[1]})`) &&
    new RegExp(`generateBriefing\\(\\w+, ${validated[1]}\\)`).test(block);
  const notice = block.includes('<RunNotice') && /disabled=\{routeState\.status !== ["']validated["'] \|\| routeBlocked/.test(block);
  const begin = commands.indexOf('pub async fn begin(');
  const contract = commands.indexOf('validate_route_contract(', begin);
  const firstAwait = commands.indexOf('.await', begin);
  return [
    ...(revalidated ? [] : [{ rule: 'route-revalidation' }]),
    ...(notice ? [] : [{ rule: 'run-notice' }]),
    ...(/['"]prep_generate['"],\s*\{[^}]*\bexpectedRoute\b/.test(service) ? [] : [{ rule: 'route-in-command' }]),
    ...(begin >= 0 && contract > begin && (firstAwait < 0 || contract < firstAwait) ? [] : [{ rule: 'route-contract' }]),
  ];
}

function read(path) {
  return readFileSync(join(FRONTEND, path), 'utf8');
}

function scanRepository() {
  const rust = RUST_MODULES.flatMap((dir) => listFiles(dir, '.rs')).flatMap((path) =>
    rustFindings(readFileSync(path, 'utf8'), relative(REPO_ROOT, path)),
  );
  const frontend = FRONTEND_FILES.flatMap((path) => frontendFindings(readFileSync(path, 'utf8'), relative(REPO_ROOT, path)));
  const imports = importFindings({
    rust: read('src-tauri/src/documents/commands.rs'),
    service: read('src/lib/document-service.ts'),
    picker: read('src-tauri/src/documents/import.rs'),
  });
  const route = routeConfirmationFindings({
    block: read('src/components/preparation/briefing-block.tsx'),
    service: read('src/lib/preparation-service.ts'),
    commands: read('src-tauri/src/preparation/commands.rs'),
  });
  return [...rust, ...frontend, ...imports, ...route];
}

module.exports = { rustFindings, frontendFindings, importFindings, routeConfirmationFindings, scanRepository };
