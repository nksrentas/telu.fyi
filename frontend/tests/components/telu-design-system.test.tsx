import { describe, expect, test } from 'bun:test';
import { BadgeCheck, BookOpen, CircleHelp, CornerDownRight } from 'lucide-react';
import { create, type ReactTestInstance } from 'react-test-renderer';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findOffenders, mapClass } from '../../scripts/telu-palette.mjs';
import { Button } from '../../src/components/ui/button';
import { KnowledgeType } from '../../src/components/telu-ui/knowledge-type';
import { RecDot, Skeleton, Spinner, Waveform } from '../../src/components/telu-ui/indicators';
import { cn } from '../../src/lib/utils';

const script = join(import.meta.dir, '../../scripts/telu-palette.mjs');

describe('telu-palette gate', () => {
  test('flags palette shades, white and black, token opacity and HSL variables only', () => {
    const offending = [
      'text-gray-600',
      'hover:bg-blue-700',
      'focus:ring-red-500/50',
      'bg-white',
      'text-black',
      'bg-primary/10',
      'border-destructive/25',
    ];
    const clean = ['bg-amber-soft', 'text-label-2', 'bg-fill-2', 'border-separator', 'bg-accent', 'text-white'];
    const source = [
      `<div className="${offending.join(' ')}" />`,
      `<div className="${clean.join(' ')}" />`,
      'const color = "hsl(var(--x))";',
    ].join('\n');

    const found = findOffenders(source);

    expect(found.filter((offender) => offender.line === 1).map((offender) => offender.token)).toEqual(offending);
    expect(found.filter((offender) => offender.line === 2)).toEqual([]);
    expect(found.filter((offender) => offender.line === 3).map((offender) => offender.token)).toEqual(['hsl(var(--x))']);
  });

  test('keeps variant prefixes when mapping', () => {
    expect(mapClass('hover:bg-blue-700')).toBe('hover:bg-accent-strong');
    expect(mapClass('dark:text-gray-400')).toBe('dark:text-label-3');
    expect(mapClass('md:hover:!bg-gray-100')).toBe('md:hover:!bg-fill');
  });

  test('maps each family deterministically', () => {
    const rows: [string, string][] = [
      ['text-gray-900', 'text-label'],
      ['text-slate-500', 'text-label-2'],
      ['text-zinc-400', 'text-label-3'],
      ['text-neutral-300', 'text-label-4'],
      ['bg-gray-50', 'bg-surface-sunken'],
      ['bg-gray-100', 'bg-fill'],
      ['bg-stone-200', 'bg-fill-2'],
      ['bg-gray-400', 'bg-fill-3'],
      ['bg-gray-800', 'bg-label'],
      ['border-gray-200', 'border-separator'],
      ['border-b-gray-300', 'border-b-hairline'],
      ['divide-gray-100', 'divide-separator'],
      ['ring-gray-300', 'ring-hairline'],
      ['placeholder-gray-500', 'placeholder-label-3'],
      ['from-gray-500', 'from-label-2'],
      ['bg-blue-50', 'bg-accent-softer'],
      ['bg-indigo-100', 'bg-accent-soft'],
      ['bg-blue-600', 'bg-accent'],
      ['bg-violet-700', 'bg-accent-strong'],
      ['text-blue-800', 'text-accent-strong'],
      ['text-sky-500', 'text-accent'],
      ['border-blue-200', 'border-accent-soft'],
      ['ring-blue-500', 'ring-accent'],
      ['bg-blue-500/10', 'bg-accent-soft'],
      ['bg-blue-500/40', 'bg-accent'],
      ['bg-red-50', 'bg-coral-soft'],
      ['bg-rose-500', 'bg-coral'],
      ['text-red-600', 'text-coral-ink'],
      ['border-red-300', 'border-coral'],
      ['bg-red-500/20', 'bg-coral-soft'],
      ['bg-yellow-100', 'bg-amber-soft'],
      ['bg-orange-500', 'bg-amber'],
      ['text-amber-700', 'text-amber'],
      ['bg-amber-500/15', 'bg-amber-soft'],
      ['bg-green-50', 'bg-fill'],
      ['bg-emerald-500', 'bg-series-green'],
      ['text-green-600', 'text-series-green'],
      ['bg-teal-100', 'bg-fill'],
      ['text-cyan-600', 'text-series-teal'],
      ['bg-white', 'bg-content'],
      ['bg-white/80', 'bg-glass-strong'],
      ['bg-black/50', 'bg-scrim'],
      ['bg-black', 'bg-label'],
      ['text-black', 'text-label'],
      ['border-white/20', 'border-glass-rim'],
      ['bg-primary/10', 'bg-accent-soft'],
      ['border-accent/40', 'border-accent-soft'],
      ['text-primary/80', 'text-accent'],
      ['bg-destructive/10', 'bg-coral-soft'],
      ['text-destructive/90', 'text-coral-ink'],
      ['bg-muted/50', 'bg-fill'],
      ['bg-background/80', 'bg-fill'],
      ['text-foreground/70', 'text-label-2'],
      ['border-border/60', 'border-separator'],
      ['shadow-blue-500/50', ''],
      ['shadow-gray-200', ''],
      ['bg-opacity-50', ''],
    ];

    for (const [from, to] of rows) {
      expect([from, mapClass(from)]).toEqual([from, to]);
    }
    expect(mapClass('bg-accent')).toBeNull();
  });

  test('check exits 1 with file:line for an offender and 0 on clean files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'telu-palette-'));
    const dirty = join(directory, 'dirty.tsx');
    const clean = join(directory, 'clean.tsx');
    writeFileSync(dirty, 'export const A = () => (\n  <div className="text-gray-600" />\n);\n');
    writeFileSync(clean, 'export const B = () => <div className="text-label-2" />;\n');

    const failing = spawnSync('node', [script, 'check', dirty], { encoding: 'utf8' });
    const passing = spawnSync('node', [script, 'check', clean], { encoding: 'utf8' });

    expect(failing.status).toBe(1);
    expect(failing.stdout).toContain(`${dirty}:2`);
    expect(failing.stdout).toContain('text-gray-600');
    expect(passing.status).toBe(0);
    expect(passing.stdout).toContain('0 offending classes');
  });

  test('migrate rewrites only the given file and removes shadow colors', () => {
    const directory = mkdtempSync(join(tmpdir(), 'telu-palette-'));
    const target = join(directory, 'target.tsx');
    const untouched = join(directory, 'untouched.tsx');
    writeFileSync(
      target,
      '<div className="bg-white shadow-md shadow-blue-500/50 hover:bg-gray-100" />\n<div className="fixed inset-0 bg-black bg-opacity-50 flex" />\n',
    );
    writeFileSync(untouched, '<div className="bg-white" />\n');

    const result = spawnSync('node', [script, 'migrate', target], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`${target}: 4`);
    expect(Bun.file(target).text()).resolves.toBe(
      '<div className="bg-content shadow-md hover:bg-fill" />\n<div className="fixed inset-0 bg-scrim flex" />\n',
    );
    expect(Bun.file(untouched).text()).resolves.toBe('<div className="bg-white" />\n');
  });
});

const classOf = (element: React.ReactElement) => {
  const root = create(element).root;
  return String(root.findByType('button').props.className);
};

const animatedNodes = (element: React.ReactElement) =>
  create(element).root.findAll(
    (node: ReactTestInstance) => typeof node.type === 'string' && /animate-/.test(String(node.props.className ?? '')),
  );

describe('Telu primitives', () => {
  test('Button maps legacy variants onto Telu styles and sizes', () => {
    const outline = classOf(<Button variant="outline">Cancel</Button>);
    const tinted = classOf(<Button variant="tinted">Accept</Button>);
    const small = classOf(<Button size="sm">Stop</Button>);

    expect(outline).toContain('bg-fill-2');
    expect(outline).not.toContain('border-input');
    expect(tinted).toContain('bg-accent-soft');
    expect(tinted).toContain('text-accent-strong');
    expect(small).toContain('h-6');
    expect(classOf(<Button>Done</Button>)).toContain('h-7');
  });

  test('KnowledgeType renders the lucide glyph and label for each type', () => {
    const cases = [
      ['decision', BadgeCheck, 'Decision'],
      ['commitment', CornerDownRight, 'Commitment'],
      ['question', CircleHelp, 'Question'],
      ['fact', BookOpen, 'Fact'],
    ] as const;

    for (const [type, glyph, label] of cases) {
      const root = create(<KnowledgeType type={type} />).root;
      expect(root.findAllByType(glyph)).toHaveLength(1);
      expect(root.findByProps({ 'data-slot': 'knowledge-type' }).props.children).toContain(label);
    }
  });

  test('indicators loop only while active', () => {
    expect(animatedNodes(<RecDot active={false} />)).toHaveLength(0);
    expect(animatedNodes(<Waveform active={false} />)).toHaveLength(0);
    expect(animatedNodes(<Spinner active={false} />)).toHaveLength(0);
    expect(animatedNodes(<Skeleton active={false} />)).toHaveLength(0);
    expect(animatedNodes(<RecDot active />)).toHaveLength(1);
    expect(animatedNodes(<Waveform active />)).toHaveLength(5);
  });

  test('cn keeps Telu font sizes next to label colors', () => {
    expect(cn('text-caption', 'text-label-2')).toBe('text-caption text-label-2');
    expect(cn('rounded-full', 'rounded-card')).toBe('rounded-card');
    expect(cn('shadow-sm', 'shadow-float')).toBe('shadow-float');
  });
});
