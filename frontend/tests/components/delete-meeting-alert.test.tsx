import { afterAll, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { KnowledgeDeletionImpact } from '../../src/lib/meeting-deletion-service';

type Responder = (args: Record<string, unknown>) => unknown;
type TestWindow = Record<string, unknown> & { dispatchEvent?: (event: Event) => boolean };

const globalWithWindow = globalThis as typeof globalThis & { window?: TestWindow };
const originalWindow = globalWithWindow.window;
let responses: Record<string, Responder> = {};
const dispatched: string[] = [];
const push = mock((_href: string) => {});

const ipc = mock(async (command: string, args: Record<string, unknown> = {}): Promise<unknown> => {
  const respond = responses[command];
  if (!respond) throw new Error(`Unexpected command: ${command}`);
  return respond(args);
});

const originalNavigation = { ...await import('next/navigation') };
const originalAlertPrimitives = { ...await import('radix-ui') };
const originalDropdown = { ...await import('../../src/components/ui/dropdown-menu') };
mock.module('next/navigation', () => ({ ...originalNavigation, useRouter: () => ({ push }) }));

let focusedCancel = false;
const Passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>;
const AlertContent = ({ children, onOpenAutoFocus }: { children?: ReactNode; onOpenAutoFocus?: (event: Event) => void }) => {
  onOpenAutoFocus?.(new Event('focus'));
  return <div role="alertdialog">{children}</div>;
};
mock.module('radix-ui', () => ({
  ...originalAlertPrimitives,
  AlertDialog: {
    Root: ({ open, children }: { open: boolean; children?: ReactNode }) => (open ? <>{children}</> : null),
    Portal: Passthrough,
    Overlay: () => null,
    Content: AlertContent,
    Title: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
    Description: Passthrough,
    Cancel: Passthrough,
  },
}));
mock.module('../../src/components/ui/dropdown-menu', () => ({
  DropdownMenu: Passthrough,
  DropdownMenuTrigger: Passthrough,
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => <div data-menu="">{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({ children, onSelect, disabled, variant }: { children?: ReactNode; onSelect?: () => void; disabled?: boolean; variant?: string }) => (
    <button type="button" data-variant={variant} disabled={disabled} onClick={() => onSelect?.()}>{children}</button>
  ),
}));

const { toast } = await import('sonner');
const { DeleteMeetingAlert, deletionBody, isDeleteDisabled } = await import('../../src/components/living-doc/delete-meeting-alert');
const { DocToolbar } = await import('../../src/components/app-shell/doc-toolbar');
const { TooltipProvider } = await import('../../src/components/ui/tooltip');

beforeAll(() => {
  globalWithWindow.window = {
    __TAURI_INTERNALS__: { invoke: ipc },
    location: { href: 'http://localhost/', origin: 'http://localhost' },
    dispatchEvent: (event: Event) => {
      dispatched.push(event.type);
      return true;
    },
  };
});

afterAll(() => {
  globalWithWindow.window = originalWindow;
  mock.module('next/navigation', () => originalNavigation);
  mock.module('radix-ui', () => originalAlertPrimitives);
  mock.module('../../src/components/ui/dropdown-menu', () => originalDropdown);
});

const impact = (accepted: number, suggestions: number): KnowledgeDeletionImpact => ({ accepted, suggestions, rejected: 0, runs: 1 });
const textOf = (node: ReactTestInstance): string =>
  node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');

let renderer: ReactTestRenderer;
const onOpenChange = mock((_open: boolean) => {});
async function renderAlert() {
  await act(async () => {
    renderer = create(
      <DeleteMeetingAlert meetingId="meeting-a" title="Weekly product sync" open onOpenChange={onOpenChange} />,
      {
        createNodeMock: (element) =>
          element.type === 'button' && element.props.children === 'Cancel'
            ? { focus: () => { focusedCancel = true; } }
            : null,
      },
    );
  });
}
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const button = (label: string) => renderer.root.find((node) => node.type === 'button' && textOf(node) === label);

beforeEach(() => {
  ipc.mockClear();
  push.mockClear();
  onOpenChange.mockClear();
  dispatched.length = 0;
  focusedCancel = false;
  responses = {};
});

describe('DeleteMeetingAlert', () => {
  test('loads counts first and keeps Delete disabled until they arrive', async () => {
    let resolve!: (value: KnowledgeDeletionImpact) => void;
    responses.knowledge_deletion_impact = () => new Promise((done) => { resolve = done; });
    await renderAlert();
    expect(ipc.mock.calls[0]?.[0]).toBe('knowledge_deletion_impact');
    expect(button('Delete').props.disabled).toBe(true);
    expect(renderer.root.findAll((node) => node.props.role === 'status')).toHaveLength(1);

    await act(async () => resolve(impact(3, 5)));
    expect(button('Delete').props.disabled).toBe(false);
  });

  test('a failed impact query shows Try again, which reloads the counts and enables Delete', async () => {
    const quiet = spyOn(console, 'error').mockImplementation(() => {});
    try {
      responses.knowledge_deletion_impact = () => { throw 'impact unavailable'; };
      await renderAlert();
      await settle();
      expect(textOf(renderer.root)).toContain("Couldn't load what will be removed.");
      expect(button('Delete').props.disabled).toBe(true);

      responses.knowledge_deletion_impact = () => impact(2, 1);
      focusedCancel = false;
      await act(async () => button('Try again').props.onClick());
      expect(focusedCancel).toBe(true);
      await settle();
      expect(ipc.mock.calls.filter(([command]) => command === 'knowledge_deletion_impact')).toHaveLength(2);
      expect(textOf(renderer.root)).toContain('2 accepted items and 1 suggestion');
      expect(button('Delete').props.disabled).toBe(false);
    } finally {
      quiet.mockRestore();
    }
  });

  test('renders plural, singular and both-zero copy with the audio note', async () => {
    expect(deletionBody(impact(3, 5))).toBe(
      "3 accepted items and 5 suggestions from this meeting will be removed from this Mac, along with its transcript and summary. This can't be undone.",
    );
    expect(deletionBody(impact(1, 1))).toContain('1 accepted item and 1 suggestion from this meeting');
    expect(deletionBody(impact(0, 0))).toBe("Its transcript and summary will be removed from this Mac. This can't be undone.");

    responses.knowledge_deletion_impact = () => impact(0, 0);
    await renderAlert();
    await settle();
    expect(textOf(renderer.root)).toContain("The audio file isn't deleted yet.");
  });

  test('focuses Cancel on open and never deletes on cancel', async () => {
    responses.knowledge_deletion_impact = () => impact(3, 5);
    await renderAlert();
    await settle();
    expect(focusedCancel).toBe(true);
    expect(ipc.mock.calls.some(([command]) => command === 'api_delete_meeting')).toBe(false);
  });

  test('a successful delete navigates home, toasts and announces the change; a failure keeps the alert open', async () => {
    const success = spyOn(toast, 'success');
    responses.knowledge_deletion_impact = () => impact(3, 5);
    responses.api_delete_meeting = () => ({ status: 'success' });
    await renderAlert();
    await settle();
    await act(async () => button('Delete').props.onClick());
    await settle();
    expect(ipc.mock.calls.find(([command]) => command === 'api_delete_meeting')?.[1]).toEqual({ meetingId: 'meeting-a' });
    expect(push).toHaveBeenCalledWith('/');
    expect(success).toHaveBeenCalledWith('Deleted Weekly product sync from this Mac');
    expect(dispatched).toContain('telu:meetings-changed');
    success.mockRestore();

    responses.api_delete_meeting = () => { throw 'Failed to delete meeting'; };
    onOpenChange.mockClear();
    await renderAlert();
    await settle();
    await act(async () => button('Delete').props.onClick());
    await settle();
    expect(textOf(renderer.root)).toContain("Couldn't delete this meeting. Nothing was removed.");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  test('the doc toolbar shows a danger Delete meeting row, disabled while recording or finalizing', async () => {
    expect(isDeleteDisabled('recording')).toBe(true);
    expect(isDeleteDisabled('finalizing')).toBe(true);
    expect(isDeleteDisabled('complete')).toBe(false);

    await act(async () => {
      renderer = create(
        <TooltipProvider>
          <DocToolbar
            originLabel="Today"
            title="Weekly product sync"
            showCompactTitle={false}
            scrolled={false}
            drawerOpen={false}
            onBack={() => {}}
            onToggleDrawer={() => {}}
            menuItems={[{ id: 'delete-meeting', label: 'Delete meeting…', danger: true, separatorBefore: true, disabled: isDeleteDisabled('recording'), onSelect: () => {} }]}
          />
        </TooltipProvider>,
      );
    });
    const row = button('Delete meeting…');
    expect(row.props['data-variant']).toBe('danger');
    expect(row.props.disabled).toBe(true);
    expect(renderer.root.findAllByType('hr')).toHaveLength(1);
  });
});
