import { afterAll, describe, expect, mock, test } from 'bun:test';
import type { ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { ManifestEntry } from '../../src/lib/preparation-service';

const originalPopover = { ...await import('../../src/components/ui/popover') };
mock.module('../../src/components/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverAnchor: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverArrow: () => null,
  PopoverContent: ({ children }: { children: ReactNode }) => <div data-popover="">{children}</div>,
}));

afterAll(() => {
  mock.module('../../src/components/ui/popover', () => originalPopover);
});

const { SourceManifest } = await import('../../src/components/preparation/source-manifest');

const doc = (versionId: string) => ({ kind: 'document' as const, versionId });
const item = (itemId: string) => ({ kind: 'knowledge' as const, meetingId: 'm-1', itemId });

const MANIFEST: ManifestEntry[] = [
  { source: doc('v-roadmap'), status: 'included', reason: 'WITHIN_BUDGET', tokens: 300 },
  { source: doc('v-notes'), status: 'truncated', kept: 3, total: 8, reason: 'SOURCE_BUDGET', tokens: 500 },
  { source: doc('v-minutes'), status: 'truncated', kept: 1, total: 4, reason: 'TOTAL_BUDGET', tokens: 200 },
  { source: doc('v-spec'), status: 'omitted', reason: 'SOURCE_BUDGET', tokens: 0 },
  { source: doc('v-archive'), status: 'omitted', reason: 'TOTAL_BUDGET', tokens: 0 },
  { source: doc('v-old'), status: 'deleted', reason: 'DOCUMENT_DELETED', tokens: 0 },
  { source: doc('v-file'), status: 'missing', reason: 'MANAGED_FILE_MISSING', tokens: 0 },
  { source: doc('v-gone'), status: 'unavailable', reason: 'VERSION_NOT_FOUND', tokens: 0 },
  { source: item('k-1'), status: 'unavailable', reason: 'KNOWLEDGE_NOT_ELIGIBLE', tokens: 0 },
];

const LABELS = {
  documents: {
    'v-roadmap': 'Roadmap',
    'v-notes': 'Notes',
    'v-minutes': 'Minutes',
    'v-spec': 'Spec',
    'v-archive': 'Archive',
    'v-old': 'Old plan',
    'v-file': 'Budget',
    'v-gone': 'Draft',
  },
  meetings: { 'm-1': { title: 'Weekly sync', date: 'Sep 27' } },
};

function render(droppedCount: number): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <SourceManifest manifest={MANIFEST} droppedCount={droppedCount} labels={LABELS} />
    );
  });
  return renderer;
}

function rows(renderer: ReactTestRenderer): string[] {
  return renderer.root.findAllByType('li').map((row) => textOf(row));
}

function textOf(node: { children: Array<unknown> }): string {
  return node.children
    .map((child) => (typeof child === 'string' ? child : textOf(child as { children: Array<unknown> })))
    .join('');
}

describe('SourceManifest', () => {
  test('opens from a "What was used" button', () => {
    const renderer = render(0);
    const trigger = renderer.root.findByProps({ 'data-manifest-trigger': true });
    expect(textOf(trigger)).toBe('What was used');
    expect(trigger.props.type).toBe('button');
  });

  test('lists every selected source with its status sentence in plain words', () => {
    expect(rows(render(0))).toEqual([
      'RoadmapIncluded in full.',
      'NotesTruncated: 3 of 8 passages. This source is longer than its share of the brief.',
      'MinutesTruncated: 1 of 4 passages. The brief ran out of room.',
      'SpecOmitted: its first passage is longer than its share of the brief.',
      'ArchiveOmitted: the brief ran out of room before this source.',
      'Old planDeleted: this source was deleted after you picked it.',
      'BudgetMissing: the saved copy of this file is gone.',
      'DraftUnavailable: this version no longer exists.',
      'Weekly sync · Sep 27Unavailable: this item is no longer in what you accepted.',
    ]);
  });

  test('shows the dropped-statement count', () => {
    const renderer = render(2);
    expect(textOf(renderer.root.findByProps({ 'data-dropped': true }))).toBe(
      "2 statements were left out because their source didn't match."
    );
  });

  test('uses the singular for one dropped statement and says so when none were dropped', () => {
    expect(textOf(render(1).root.findByProps({ 'data-dropped': true }))).toBe(
      "1 statement was left out because its source didn't match."
    );
    expect(textOf(render(0).root.findByProps({ 'data-dropped': true }))).toBe(
      'Every statement matched its source.'
    );
  });

  test('falls back to plain words for an unknown status reason', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <SourceManifest
          manifest={[{ source: doc('v-x'), status: 'omitted', reason: 'SOMETHING_NEW', tokens: 0 }]}
          droppedCount={0}
          labels={{ documents: {}, meetings: {} }}
        />
      );
    });
    expect(rows(renderer)).toEqual(['DocumentOmitted: this source didn’t fit in the brief.']);
  });
});
