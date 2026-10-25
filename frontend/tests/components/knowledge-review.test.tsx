import { afterAll, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cloneElement, createContext, useContext, useState, type ReactElement, type ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { EvidenceLinkView, KnowledgeItemView, MeetingKnowledgeView } from '../../src/lib/knowledge-service';

type Responder = (args: Record<string, unknown>) => unknown;
type TestGlobals = typeof globalThis & {
  window?: Record<string, unknown>;
  document?: Record<string, unknown>;
  requestAnimationFrame?: (callback: (time: number) => void) => unknown;
  cancelAnimationFrame?: (handle: unknown) => void;
};

const globals = globalThis as TestGlobals;
const originalWindow = globals.window;
const originalDocument = globals.document;
const originalFrame = { request: globals.requestAnimationFrame, cancel: globals.cancelAnimationFrame };
const windowEvents = new EventTarget();
let responses: Record<string, Responder> = {};
const focused: string[] = [];

const ipc = mock(async (command: string, args: Record<string, unknown> = {}): Promise<unknown> => {
  const respond = responses[command];
  if (!respond) throw new Error(`Unexpected command: ${command}`);
  return respond(args);
});

const PopoverState = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({ open: false, setOpen: () => {} });
const originalCore = { ...await import('@tauri-apps/api/core') };
const originalPopover = { ...await import('../../src/components/ui/popover') };
const originalDropdown = { ...await import('../../src/components/ui/dropdown-menu') };
mock.module('@tauri-apps/api/core', () => ({ ...originalCore, invoke: ipc }));
mock.module('../../src/components/ui/popover', () => ({
  Popover: ({ children, open, onOpenChange }: { children: ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => (
    <PopoverState.Provider value={{ open: Boolean(open), setOpen: (next) => onOpenChange?.(next) }}>{children}</PopoverState.Provider>
  ),
  PopoverTrigger: ({ children }: { children: ReactElement<{ onClick?: (event: unknown) => void }> }) => {
    const state = useContext(PopoverState);
    return cloneElement(children, {
      onClick: (event: unknown) => {
        children.props.onClick?.(event);
        state.setOpen(!state.open);
      },
    });
  },
  PopoverAnchor: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverArrow: () => null,
  PopoverContent: ({ children }: { children: ReactNode }) => {
    const state = useContext(PopoverState);
    return state.open ? <div data-popover="">{children}</div> : null;
  },
}));
mock.module('../../src/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div data-menu="">{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) => (
    <button type="button" data-menu-item="" onClick={() => onSelect?.()}>{children}</button>
  ),
}));

const { toast } = await import('sonner');
const { CandidateRow, REVIEW_ERROR } = await import('../../src/components/living-doc/candidate-row');
const { ReviewHead } = await import('../../src/components/living-doc/review-head');
const { ReviewBlock, REVIEW_TOAST } = await import('../../src/components/living-doc/review-block');
const { TooltipProvider } = await import('../../src/components/ui/tooltip');

beforeAll(() => {
  globals.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
  globals.cancelAnimationFrame = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>);
  globals.document = { addEventListener: () => {}, removeEventListener: () => {} };
  globals.window = {
    addEventListener: windowEvents.addEventListener.bind(windowEvents),
    removeEventListener: windowEvents.removeEventListener.bind(windowEvents),
    dispatchEvent: windowEvents.dispatchEvent.bind(windowEvents),
    matchMedia: () => ({ matches: true }),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  };
});

afterAll(async () => {
  unmount();
  await new Promise((resolve) => setTimeout(resolve, 0));
  globals.window = originalWindow;
  globals.document = originalDocument;
  globals.requestAnimationFrame = originalFrame.request;
  globals.cancelAnimationFrame = originalFrame.cancel;
  mock.module('@tauri-apps/api/core', () => originalCore);
  mock.module('../../src/components/ui/popover', () => originalPopover);
  mock.module('../../src/components/ui/dropdown-menu', () => originalDropdown);
});

const link: EvidenceLinkView = {
  linkId: 'link-1',
  evidenceId: 'evidence-1',
  role: 'claim',
  quoteText: 'Maria will send the draft by Friday',
  rawStart: 0,
  rawEnd: 35,
  sequence: 1,
  audioStartTime: 65,
  audioEndTime: 70,
  segmentCaptureIncomplete: false,
};

const item = (overrides: Partial<KnowledgeItemView> = {}): KnowledgeItemView => ({
  itemId: 'item-1',
  meetingId: 'meeting-a',
  originRunId: 'run-1',
  itemType: 'commitment',
  text: 'Maria sends the draft',
  ownerText: null,
  ownerSupport: 'not_stated',
  dueText: null,
  dueSupport: 'not_stated',
  reviewState: 'proposed',
  eligibility: false,
  evidenceStatus: 'valid',
  corrected: false,
  latestRevisionId: 'rev-1',
  unresolved: true,
  createdAtUtc: '2026-09-27T10:46:00Z',
  evidence: [link],
  ...overrides,
});

const accepted = (overrides: Partial<KnowledgeItemView> = {}) => item({ reviewState: 'accepted', eligibility: true, ...overrides });

const view = (items: KnowledgeItemView[], rejected: KnowledgeItemView[] = []): MeetingKnowledgeView => ({
  meetingId: 'meeting-a',
  latestRun: null,
  items,
  rejected,
  pendingCount: items.filter((entry) => entry.reviewState === 'proposed').length,
  acceptedCount: items.filter((entry) => entry.reviewState === 'accepted').length,
  skippedCount: 0,
});

let renderer: ReactTestRenderer | undefined;
const unmount = () => {
  act(() => renderer?.unmount());
  renderer = undefined;
};
const root = () => renderer!.root;
const textOf = (node: ReactTestInstance): string =>
  node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const buttons = (label: string) => root().findAll((node) => node.type === 'button' && (textOf(node) === label || node.props['aria-label'] === label));
const button = (label: string) => buttons(label)[0];
const click = async (label: string) => {
  await act(async () => button(label).props.onClick({ stopPropagation: () => {} }));
  await settle();
};
const reviewCalls = () => ipc.mock.calls.filter(([command]) => command === 'knowledge_review_item').map(([, args]) => args);

async function render(element: ReactElement) {
  unmount();
  await act(async () => {
    renderer = create(<TooltipProvider>{element}</TooltipProvider>, {
      createNodeMock: (node) => {
        const id = node.props['data-item-id'];
        return typeof id === 'string' && node.type === 'div' ? { focus: () => focused.push(id) } : null;
      },
    });
  });
  await settle();
}

function Harness({ initial }: { initial: MeetingKnowledgeView }) {
  const [knowledge, setKnowledge] = useState(initial);
  return <ReviewBlock meetingId="meeting-a" knowledge={knowledge} onChange={(update) => setKnowledge((current) => update(current))} />;
}

const renderRow = (target: KnowledgeItemView, onDecided = mock(() => {})) =>
  render(<CandidateRow meetingId="meeting-a" item={target} run={null} onDecided={onDecided} />);

async function pressUndo(target?: { tagName: string }) {
  const event = Object.assign(new Event('keydown', { cancelable: true }), { key: 'z', metaKey: true, shiftKey: false, altKey: false, ctrlKey: false });
  if (target) Object.defineProperty(event, 'target', { value: { ...target, getAttribute: () => null } });
  await act(async () => { windowEvents.dispatchEvent(event); });
  await settle();
}

function fakeWindowTimers() {
  const win = globals.window as unknown as Record<string, unknown>;
  const real = { set: win.setTimeout, clear: win.clearTimeout };
  const queue = new Map<number, () => void>();
  let handles = 0;
  win.setTimeout = (callback: () => void) => {
    handles += 1;
    queue.set(handles, callback);
    return handles;
  };
  win.clearTimeout = (handle: number) => queue.delete(handle);
  return {
    queue,
    flush: () => act(() => {
      for (const [handle, callback] of [...queue]) {
        queue.delete(handle);
        callback();
      }
    }),
    restore: () => {
      win.setTimeout = real.set;
      win.clearTimeout = real.clear;
    },
  };
}

beforeEach(() => {
  ipc.mockClear();
  responses = {};
  focused.length = 0;
});

describe('CandidateRow', () => {
  test('a pending row shows type, text, unresolved fields, source and the three decisions', async () => {
    await renderRow(item());
    const text = textOf(root());
    expect(text).toContain('Commitment');
    expect(text).toContain('Maria sends the draft');
    expect(text).toContain('Owner not stated');
    expect(text).toContain('Due not stated');
    expect(root().findAll((node) => node.type === 'button' && String(node.props['aria-label']).startsWith('Source:'))).toHaveLength(1);
    expect(buttons('Accept')).toHaveLength(1);
    expect(buttons('Correct')).toHaveLength(1);
    expect(buttons('Reject')).toHaveLength(1);
  });

  test('Accept renders the Rust eligibility and moves focus to the next pending row', async () => {
    responses.knowledge_review_item = (args) => accepted({ itemId: String(args.itemId) });
    const success = spyOn(toast, 'success');
    await render(<Harness initial={view([item(), item({ itemId: 'item-2', text: 'Ship the beta' })])} />);
    await act(async () => buttons('Accept')[0].props.onClick());
    await settle();
    expect(reviewCalls()[0]).toEqual({ meetingId: 'meeting-a', itemId: 'item-1', action: 'accept' });
    expect(textOf(root())).toContain('✓ Accepted · eligible');
    expect(focused).toEqual(['item-2']);
    expect(success.mock.calls[0]?.[0]).toBe(REVIEW_TOAST.accepted);
    success.mockRestore();
  });

  test('Correct validates, saves against the latest revision, shows the corrected status and opens history', async () => {
    const decided = mock(() => {});
    responses.knowledge_correct_item = () => accepted({ corrected: true, text: 'Maria sends the final draft', ownerText: 'Maria', ownerSupport: 'user', latestRevisionId: 'rev-2' });
    await renderRow(item(), decided);
    await click('Correct');
    const textarea = () => root().find((node) => node.type === 'textarea');
    expect(textarea().props.value).toBe('Maria sends the draft');
    expect(root().findAll((node) => node.type === 'input' && node.props.placeholder === 'Not stated')).toHaveLength(2);

    await act(async () => textarea().props.onChange({ target: { value: '   ' } }));
    await click('Save correction');
    expect(textOf(root())).toContain("Text can't be empty.");

    await act(async () => textarea().props.onChange({ target: { value: 'Maria sends the final draft' } }));
    const owner = root().findAll((node) => node.type === 'input')[0];
    await act(async () => owner.props.onChange({ target: { value: 'Maria' } }));
    await click('Save correction');
    const [, args] = ipc.mock.calls.find(([command]) => command === 'knowledge_correct_item')!;
    expect(args).toEqual({
      meetingId: 'meeting-a',
      itemId: 'item-1',
      correction: { text: 'Maria sends the final draft', ownerText: 'Maria', dueText: null, basedOnRevisionId: 'rev-1' },
    });
    expect(decided).toHaveBeenCalledTimes(1);

    await renderRow(accepted({ corrected: true }));
    expect(textOf(root())).toContain('✓ Corrected · Accepted · eligible');
    responses.knowledge_item_history = () => ({
      itemId: 'item-1',
      originRunId: 'run-1',
      runStartedAtUtc: '2026-09-27T10:46:00Z',
      original: { text: 'Maria sends the draft', ownerText: null, dueText: null, createdAtUtc: '2026-09-27T10:46:00Z' },
      revisions: [],
      reviews: [],
      evidence: [link],
    });
    await click('Corrected');
    expect(textOf(root())).toContain('Proposed by Telu');

    await click('Correct…');
    await act(async () => textarea().props.onKeyDown({ key: 'Escape', preventDefault: () => {}, stopPropagation: () => {} }));
    expect(root().findAll((node) => node.type === 'textarea')).toHaveLength(0);
  });

  test('a correction is based on the revision the editor opened from, not one that arrived while editing', async () => {
    responses.knowledge_correct_item = () => accepted({ corrected: true, latestRevisionId: 'rev-3' });
    const decided = mock(() => {});
    await renderRow(item(), decided);
    await click('Correct');
    await act(async () => {
      renderer!.update(
        <TooltipProvider>
          <CandidateRow meetingId="meeting-a" item={item({ text: 'Changed elsewhere', latestRevisionId: 'rev-2' })} run={null} onDecided={decided} />
        </TooltipProvider>
      );
    });
    const textarea = root().find((node) => node.type === 'textarea');
    await act(async () => textarea.props.onChange({ target: { value: 'Maria sends the final draft' } }));
    await click('Save correction');
    const [, args] = ipc.mock.calls.find(([command]) => command === 'knowledge_correct_item')!;
    expect((args as { correction: { basedOnRevisionId: string } }).correction.basedOnRevisionId).toBe('rev-1');
  });

  test('Enter during an IME composition does not save the correction', async () => {
    responses.knowledge_correct_item = () => accepted({ corrected: true });
    await renderRow(item());
    await click('Correct');
    const textarea = () => root().find((node) => node.type === 'textarea');
    await act(async () => textarea().props.onChange({ target: { value: 'マリアが送る' } }));
    const preventDefault = mock(() => {});
    await act(async () =>
      textarea().props.onKeyDown({ key: 'Enter', shiftKey: false, nativeEvent: { isComposing: true }, preventDefault, stopPropagation: () => {} })
    );
    await settle();
    expect(ipc.mock.calls.some(([command]) => command === 'knowledge_correct_item')).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(root().findAll((node) => node.type === 'textarea')).toHaveLength(1);

    await act(async () =>
      textarea().props.onKeyDown({ key: 'Enter', shiftKey: false, nativeEvent: { isComposing: false, keyCode: 229 }, preventDefault, stopPropagation: () => {} })
    );
    await settle();
    expect(ipc.mock.calls.some(([command]) => command === 'knowledge_correct_item')).toBe(false);

    await act(async () =>
      textarea().props.onKeyDown({ key: 'Enter', shiftKey: false, nativeEvent: { isComposing: false, keyCode: 13 }, preventDefault, stopPropagation: () => {} })
    );
    await settle();
    expect(ipc.mock.calls.some(([command]) => command === 'knowledge_correct_item')).toBe(true);
  });

  test('invalid evidence is never eligible and keeps Reject and Correct…; unresolved accepted fields turn amber', async () => {
    await renderRow(accepted({ evidenceStatus: 'changed', eligibility: true }));
    expect(textOf(root())).toContain('Evidence changed — not eligible');
    expect(textOf(root())).not.toContain('Accepted · eligible');
    expect(buttons('Reject')).toHaveLength(1);
    expect(buttons('Correct…')).toHaveLength(1);

    await renderRow(accepted());
    const chip = root().find((node) => node.props['data-slot'] === 'chip' && textOf(node) === 'Owner not stated');
    expect(String(chip.props.className)).toContain('text-amber');
  });

  test('ReviewHead reads pending, reviewed and the abstention line without skipped text', async () => {
    await render(<ReviewHead pendingCount={2} skippedCount={1} onAcceptAll={() => {}} />);
    expect(textOf(root())).toContain('Review what Telu found — only items you accept are used later.');
    expect(textOf(root())).toContain('1 possible item skipped — not enough evidence');
    expect(root().findAll((node) => node.props['aria-label'] === 'Telu only shows items it can quote word for word from this transcript.')).toHaveLength(1);

    await render(<ReviewHead pendingCount={0} skippedCount={3} onAcceptAll={() => {}} />);
    expect(textOf(root())).toContain('Reviewed — every item has a decision.');
    expect(textOf(root())).toContain('3 possible items skipped — not enough evidence');
  });

  test('a failed action keeps the prior row and toasts; long text wraps', async () => {
    const error = spyOn(toast, 'error');
    const log = console.error;
    console.error = () => {};
    responses.knowledge_review_item = () => { throw 'KNOWLEDGE_STORAGE'; };
    await renderRow(item({ text: 'x'.repeat(600) }));
    await click('Accept');
    console.error = log;
    expect(error).toHaveBeenCalledWith(REVIEW_ERROR);
    expect(buttons('Accept')).toHaveLength(1);
    const paragraph = root().find((node) => node.type === 'p' && textOf(node) === 'x'.repeat(600));
    expect(String(paragraph.props.className)).toContain('break-words');
    expect(String(paragraph.props.className)).not.toContain('truncate');
    error.mockRestore();
  });
});

describe('ReviewBlock', () => {
  test('Reject moves the row into a collapsed Rejected group; Restore brings it back', async () => {
    const info = spyOn(toast, 'info');
    responses.knowledge_review_item = (args) => item({ itemId: String(args.itemId), reviewState: args.action === 'reject' ? 'rejected' : 'proposed' });
    await render(<Harness initial={view([item(), item({ itemId: 'item-2' })])} />);
    expect(buttons('Rejected (1)')).toHaveLength(0);

    await act(async () => buttons('Reject')[0].props.onClick());
    await settle();
    expect(info.mock.calls[0]?.[0]).toBe(REVIEW_TOAST.rejected);
    expect((info.mock.calls[0]?.[1] as { action: { label: string } }).action.label).toBe('Undo');
    const header = button('Rejected (1)');
    expect(header.props['aria-expanded']).toBe(false);

    await click('Restore');
    expect(reviewCalls().at(-1)).toEqual({ meetingId: 'meeting-a', itemId: 'item-1', action: 'restore' });
    expect(buttons('Rejected (1)')).toHaveLength(0);
    info.mockRestore();
  });

  test('Accept all appears with two pending rows, accepts both and undoes by reopening', async () => {
    await render(<Harness initial={view([item()])} />);
    expect(buttons('Accept all')).toHaveLength(0);

    const success = spyOn(toast, 'success');
    responses.knowledge_accept_all = (args) => view((args.itemIds as string[]).map((itemId) => accepted({ itemId })));
    responses.knowledge_review_item = (args) => item({ itemId: String(args.itemId) });
    await render(<Harness initial={view([item(), item({ itemId: 'item-2' })])} />);
    await click('Accept all');
    expect(ipc.mock.calls.find(([command]) => command === 'knowledge_accept_all')?.[1]).toEqual({ meetingId: 'meeting-a', itemIds: ['item-1', 'item-2'] });
    expect(success.mock.calls[0]?.[0]).toBe('Accepted 2 items');
    expect(textOf(root()).split('✓ Accepted · eligible')).toHaveLength(3);

    await act(async () => (success.mock.calls[0]?.[1] as { action: { onClick: () => void } }).action.onClick());
    await settle();
    expect(reviewCalls().map((args) => args.action)).toEqual(['reopen', 'reopen']);
    success.mockRestore();

    const error = spyOn(toast, 'error');
    const log = console.error;
    console.error = () => {};
    responses.knowledge_accept_all = () => { throw 'KNOWLEDGE_STORAGE'; };
    await render(<Harness initial={view([item(), item({ itemId: 'item-2' })])} />);
    await click('Accept all');
    console.error = log;
    expect(error).toHaveBeenCalledWith(REVIEW_ERROR);
    expect(buttons('Accept')).toHaveLength(2);
    error.mockRestore();
  });

  test('Accept all counts and undoes only the requested items Rust accepted', async () => {
    const success = spyOn(toast, 'success');
    const earlier = accepted({ itemId: 'item-4' });
    responses.knowledge_accept_all = () => view([accepted(), accepted({ itemId: 'item-2' }), item({ itemId: 'item-3' }), earlier]);
    responses.knowledge_review_item = (args) => item({ itemId: String(args.itemId) });
    await render(<Harness initial={view([item(), item({ itemId: 'item-2' }), item({ itemId: 'item-3' }), earlier])} />);
    await click('Accept all');
    expect(ipc.mock.calls.find(([command]) => command === 'knowledge_accept_all')?.[1]).toEqual({ meetingId: 'meeting-a', itemIds: ['item-1', 'item-2', 'item-3'] });
    expect(success.mock.calls[0]?.[0]).toBe('Accepted 2 items');

    await act(async () => (success.mock.calls[0]?.[1] as unknown as { action: { onClick: () => void } }).action.onClick());
    await settle();
    expect(reviewCalls()).toEqual([
      { meetingId: 'meeting-a', itemId: 'item-1', action: 'reopen' },
      { meetingId: 'meeting-a', itemId: 'item-2', action: 'reopen' },
    ]);
    success.mockRestore();
  });

  test('Accept all with nothing accepted by Rust says so and offers no Undo', async () => {
    const info = spyOn(toast, 'info');
    const success = spyOn(toast, 'success');
    responses.knowledge_accept_all = () => view([item(), item({ itemId: 'item-2' })]);
    await render(<Harness initial={view([item(), item({ itemId: 'item-2' })])} />);
    await click('Accept all');
    const successCalls = success.mock.calls.length;
    const infoCalls = info.mock.calls;
    info.mockRestore();
    success.mockRestore();
    expect(successCalls).toBe(0);
    expect(infoCalls).toEqual([[REVIEW_TOAST.noneAccepted]]);
  });

  test('single Accept and Reject offer Undo and ⌘Z; ⌘Z in a text field and corrections do nothing', async () => {
    const success = spyOn(toast, 'success');
    responses.knowledge_review_item = (args) =>
      args.action === 'accept' ? accepted({ itemId: String(args.itemId) }) : item({ itemId: String(args.itemId), reviewState: args.action === 'reject' ? 'rejected' : 'proposed' });
    await render(<Harness initial={view([item(), item({ itemId: 'item-2' })])} />);

    await act(async () => buttons('Accept')[0].props.onClick());
    await settle();
    expect(success.mock.calls[0]?.[0]).toBe(REVIEW_TOAST.accepted);
    await act(async () => (success.mock.calls[0]?.[1] as { action: { onClick: () => void } }).action.onClick());
    await settle();
    expect(reviewCalls().at(-1)?.action).toBe('reopen');

    await act(async () => buttons('Reject')[0].props.onClick());
    await settle();
    await pressUndo({ tagName: 'TEXTAREA' });
    expect(reviewCalls().at(-1)?.action).toBe('reject');
    await pressUndo();
    expect(reviewCalls().at(-1)?.action).toBe('restore');

    responses.knowledge_correct_item = () => accepted({ corrected: true });
    await click('Correct');
    await act(async () => root().find((node) => node.type === 'textarea').props.onChange({ target: { value: 'New wording' } }));
    await click('Save correction');
    const corrected = success.mock.calls.find(([message]) => message === REVIEW_TOAST.corrected);
    expect(corrected).toBeDefined();
    expect(corrected?.[1]).toBeUndefined();
    const calls = reviewCalls().length;
    await pressUndo();
    expect(reviewCalls()).toHaveLength(calls);
    success.mockRestore();
  });

  test("each toast's Undo reverts its own action; ⌘Z takes the latest; a correction dismisses the rest", async () => {
    const success = spyOn(toast, 'success');
    const info = spyOn(toast, 'info');
    const dismiss = spyOn(toast, 'dismiss');
    type UndoOptions = { id: string | number; action: { onClick: () => void } };
    const undoOf = (calls: unknown[][], index: number) => calls[index]?.[1] as UndoOptions;
    // item-3's evidence changes once accepted, so its row keeps a Reject button.
    const changed: Partial<KnowledgeItemView> = { evidenceStatus: 'changed', eligibility: false };
    responses.knowledge_review_item = (args) =>
      args.action === 'accept'
        ? accepted({ itemId: String(args.itemId), ...(args.itemId === 'item-3' ? changed : {}) })
        : item({ itemId: String(args.itemId), reviewState: args.action === 'reject' ? 'rejected' : 'proposed' });
    responses.knowledge_correct_item = (args) => accepted({ itemId: String(args.itemId), corrected: true });
    await render(<Harness initial={view([item(), item({ itemId: 'item-2' }), item({ itemId: 'item-3' })])} />);

    const decide = async (itemId: string, label: string) => {
      const row = root().find((node) => node.type === 'div' && node.props['data-item-id'] === itemId);
      const target = row.find((node) => node.type === 'button' && (textOf(node) === label || node.props['aria-label'] === label));
      await act(async () => target.props.onClick());
      await settle();
    };
    await decide('item-1', 'Accept');
    await decide('item-2', 'Reject');
    const acceptToast = undoOf(success.mock.calls, 0);
    const rejectToast = undoOf(info.mock.calls, 0);

    const beforeUndo = reviewCalls().length;
    await act(async () => acceptToast.action.onClick());
    await settle();
    expect(reviewCalls().slice(beforeUndo)).toEqual([{ meetingId: 'meeting-a', itemId: 'item-1', action: 'reopen' }]);
    expect(acceptToast.id).not.toBe(rejectToast.id);

    await decide('item-1', 'Reject');
    const latestToast = undoOf(info.mock.calls, 1);
    await pressUndo();
    expect(reviewCalls().at(-1)).toEqual({ meetingId: 'meeting-a', itemId: 'item-1', action: 'restore' });
    expect(dismiss).toHaveBeenCalledWith(latestToast.id);

    await decide('item-3', 'Accept');
    const supersededToast = undoOf(success.mock.calls, 1);
    await decide('item-3', 'Reject');
    expect(dismiss).toHaveBeenCalledWith(supersededToast.id);
    const item3RejectToast = undoOf(info.mock.calls, 2);

    dismiss.mockClear();
    await click('Correct');
    await act(async () => root().find((node) => node.type === 'textarea').props.onChange({ target: { value: 'New wording' } }));
    await click('Save correction');
    expect(dismiss).toHaveBeenCalledWith(rejectToast.id);
    expect(dismiss).toHaveBeenCalledWith(item3RejectToast.id);
    const calls = reviewCalls().length;
    await act(async () => rejectToast.action.onClick());
    await pressUndo();
    expect(reviewCalls()).toHaveLength(calls);
    success.mockRestore();
    info.mockRestore();
    dismiss.mockRestore();
  });

  test('a decision made during the Accept-all stagger survives the late timers; unmount clears them', async () => {
    const timers = fakeWindowTimers();
    try {
      responses.knowledge_accept_all = (args) => view((args.itemIds as string[]).map((itemId) => accepted({ itemId })));
      responses.knowledge_review_item = (args) => item({ itemId: String(args.itemId), reviewState: 'rejected' });
      await render(<Harness initial={view([item(), item({ itemId: 'item-2' })])} />);
      await click('Accept all');
      expect(timers.queue.size).toBe(2);
      await act(async () => buttons('Reject')[0].props.onClick());
      await settle();
      timers.flush();
      expect(buttons('Rejected (1)')).toHaveLength(1);
      expect(textOf(root()).split('✓ Accepted · eligible')).toHaveLength(2);

      const changes = mock(() => {});
      await render(<ReviewBlock meetingId="meeting-a" knowledge={view([item(), item({ itemId: 'item-2' })])} onChange={changes} />);
      await click('Accept all');
      expect(timers.queue.size).toBe(2);
      unmount();
      expect(timers.queue.size).toBe(0);
      expect(changes).not.toHaveBeenCalled();

      let resolveAcceptAll: (value: unknown) => void = () => {};
      responses.knowledge_accept_all = (args) => new Promise((resolve) => {
        resolveAcceptAll = () => resolve(view((args.itemIds as string[]).map((itemId) => accepted({ itemId }))));
      });
      await render(<ReviewBlock meetingId="meeting-a" knowledge={view([item(), item({ itemId: 'item-2' })])} onChange={changes} />);
      await act(async () => button('Accept all').props.onClick());
      unmount();
      await act(async () => resolveAcceptAll(undefined));
      await settle();
      expect(timers.queue.size).toBe(0);
      expect(changes).not.toHaveBeenCalled();
    } finally {
      timers.restore();
    }
  });

  test('the ⌘Z listener is attached once across re-renders', async () => {
    const win = globals.window!;
    const realAdd = win.addEventListener as EventTarget['addEventListener'];
    const added: string[] = [];
    win.addEventListener = (type: string, listener: EventListenerOrEventListenerObject) => {
      added.push(type);
      realAdd(type, listener);
    };
    try {
      await render(<Harness initial={view([item(), item({ itemId: 'item-2' })])} />);
      for (let index = 0; index < 5; index += 1) {
        await act(async () => renderer!.update(<TooltipProvider><Harness initial={view([item()])} /></TooltipProvider>));
      }
    } finally {
      win.addEventListener = realAdd;
    }
    expect(added.filter((type) => type === 'keydown')).toHaveLength(1);
  });

  for (const code of ['KNOWLEDGE_REVISION_CONFLICT', 'KNOWLEDGE_INVALID_TRANSITION', 'KNOWLEDGE_ITEM_NOT_FOUND']) {
    test(`Undo on an item that changed elsewhere (${code}) says nothing was undone and touches no other item`, async () => {
      const success = spyOn(toast, 'success');
      const info = spyOn(toast, 'info');
      const error = spyOn(toast, 'error');
      responses.knowledge_accept_all = (args) => view((args.itemIds as string[]).map((itemId) => accepted({ itemId })));
      responses.knowledge_review_item = () => { throw code; };
      await render(<Harness initial={view([item(), item({ itemId: 'item-2' })])} />);
      await click('Accept all');

      await act(async () => (success.mock.calls[0]?.[1] as unknown as { action: { onClick: () => void } }).action.onClick());
      await settle();
      expect(reviewCalls()).toEqual([{ meetingId: 'meeting-a', itemId: 'item-1', action: 'reopen' }]);
      expect(info).toHaveBeenCalledWith('This item changed since. Nothing was undone.');
      expect(error).not.toHaveBeenCalled();
      expect(textOf(root()).split('✓ Accepted · eligible')).toHaveLength(3);
      success.mockRestore();
      info.mockRestore();
      error.mockRestore();
    });
  }

  test('a batch Undo that hits a changed item after reverting another says only part was undone', async () => {
    const success = spyOn(toast, 'success');
    const info = spyOn(toast, 'info');
    responses.knowledge_accept_all = (args) => view((args.itemIds as string[]).map((itemId) => accepted({ itemId })));
    responses.knowledge_review_item = (args) => {
      if (args.itemId === 'item-2') throw 'KNOWLEDGE_INVALID_TRANSITION';
      return item({ itemId: String(args.itemId) });
    };
    await render(<Harness initial={view([item(), item({ itemId: 'item-2' })])} />);
    await click('Accept all');

    await act(async () => (success.mock.calls[0]?.[1] as unknown as { action: { onClick: () => void } }).action.onClick());
    await settle();
    expect(reviewCalls().map((args) => args?.itemId)).toEqual(['item-1', 'item-2']);
    expect(info).toHaveBeenCalledWith(REVIEW_TOAST.undoPartial);
    expect(info).not.toHaveBeenCalledWith(REVIEW_TOAST.undoStale);
    expect(textOf(root()).split('✓ Accepted · eligible')).toHaveLength(2);
    success.mockRestore();
    info.mockRestore();
  });

  test('an Undo entry expires when its toast closes', async () => {
    const success = spyOn(toast, 'success');
    const info = spyOn(toast, 'info');
    type Closable = { onAutoClose: () => void; onDismiss: () => void };
    const closeOf = (calls: unknown[][]) => calls[0]?.[1] as Closable;
    responses.knowledge_review_item = (args) =>
      args.action === 'accept' ? accepted({ itemId: String(args.itemId) }) : item({ itemId: String(args.itemId), reviewState: 'rejected' });
    await render(<Harness initial={view([item(), item({ itemId: 'item-2' })])} />);
    await act(async () => buttons('Accept')[0].props.onClick());
    await settle();
    await act(async () => buttons('Reject')[0].props.onClick());
    await settle();
    closeOf(success.mock.calls).onAutoClose();
    closeOf(info.mock.calls).onDismiss();

    const calls = reviewCalls().length;
    await pressUndo();
    expect(reviewCalls()).toHaveLength(calls);
    success.mockRestore();
    info.mockRestore();
  });

  describe('a second click while the first call is in flight sends nothing', () => {
    const holdReviews = () => {
      const release: Array<() => void> = [];
      responses.knowledge_review_item = (args) =>
        new Promise((resolve) => release.push(() => resolve(item({ itemId: String(args.itemId), reviewState: args.action === 'reject' ? 'rejected' : 'proposed' }))));
      return async () => {
        await act(async () => release.splice(0).forEach((resolve) => resolve()));
        await settle();
      };
    };
    const doubleClick = async (onClick: () => void) => {
      await act(async () => {
        onClick();
        onClick();
      });
      await settle();
    };

    for (const label of ['Accept', 'Reject']) {
      test(label, async () => {
        const release = holdReviews();
        await render(<Harness initial={view([item()])} />);
        await doubleClick(button(label).props.onClick);
        expect(reviewCalls()).toEqual([{ meetingId: 'meeting-a', itemId: 'item-1', action: label.toLowerCase() }]);
        await release();
      });
    }

    test('Restore', async () => {
      const release = holdReviews();
      await render(<Harness initial={view([], [item({ reviewState: 'rejected' })])} />);
      await doubleClick(button('Restore').props.onClick);
      expect(reviewCalls()).toEqual([{ meetingId: 'meeting-a', itemId: 'item-1', action: 'restore' }]);
      await release();
    });

    test('Undo', async () => {
      const success = spyOn(toast, 'success');
      responses.knowledge_review_item = () => accepted();
      await render(<Harness initial={view([item()])} />);
      await click('Accept');
      const release = holdReviews();
      await doubleClick((success.mock.calls[0]?.[1] as unknown as { action: { onClick: () => void } }).action.onClick);
      expect(reviewCalls().slice(1)).toEqual([{ meetingId: 'meeting-a', itemId: 'item-1', action: 'reopen' }]);
      await release();
      success.mockRestore();
    });
  });

  test('living-doc sources never render raw HTML or the memory label', () => {
    const folder = join(import.meta.dir, '../../src/components/living-doc');
    for (const file of readdirSync(folder)) {
      const source = readFileSync(join(folder, file), 'utf8');
      expect(source.includes('dangerouslySetInnerHTML')).toBe(false);
      expect(/[Ii]n Memory/.test(source)).toBe(false);
    }
  });
});
