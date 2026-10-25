import { afterAll, afterEach, beforeAll, describe, expect, jest, mock, test } from 'bun:test';
import { cloneElement, createContext, useContext, type ReactElement, type ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

const globals = globalThis as unknown as { window?: unknown; document?: unknown };
const originalWindow = globals.window;
const originalDocument = globals.document;
const windowEvents = new EventTarget();
const PopoverState = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({ open: false, setOpen: () => {} });

let searchResponse: unknown[] = [];
const invoke = mock(async (command: string, _args?: Record<string, unknown>): Promise<unknown> => {
  if (command === 'api_get_meetings') return [];
  if (command === 'api_search_transcripts') return searchResponse;
  throw new Error(`Unexpected command: ${command}`);
});
const searchCalls = () => invoke.mock.calls.filter(([command]) => command === 'api_search_transcripts').map(([, args]) => args);

const originalCore = { ...await import('@tauri-apps/api/core') };
const originalNavigation = { ...await import('next/navigation') };
const originalRecordingState = { ...await import('../../src/contexts/RecordingStateContext') };
const originalAnalytics = { ...await import('../../src/lib/analytics') };
const originalPopover = { ...await import('../../src/components/ui/popover') };
mock.module('@tauri-apps/api/core', () => ({ ...originalCore, invoke }));
mock.module('next/navigation', () => ({ ...originalNavigation, usePathname: () => '/', useRouter: () => ({ push: () => {} }) }));
mock.module('../../src/contexts/RecordingStateContext', () => ({ ...originalRecordingState, useRecordingState: () => ({ isRecording: false }) }));
mock.module('../../src/lib/analytics', () => ({ ...originalAnalytics, default: { trackBackendConnection: () => {}, trackButtonClick: () => {} } }));
mock.module('../../src/components/ui/popover', () => ({
  Popover: ({ children, open, onOpenChange }: { children: ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => (
    <PopoverState.Provider value={{ open: Boolean(open), setOpen: (next) => onOpenChange?.(next) }}>{children}</PopoverState.Provider>
  ),
  PopoverTrigger: ({ children }: { children: ReactElement<{ onClick?: (event: unknown) => void }> }) => {
    const state = useContext(PopoverState);
    return cloneElement(children, { onClick: () => state.setOpen(!state.open) });
  },
  PopoverContent: ({ children }: { children: ReactNode }) => (useContext(PopoverState).open ? <div data-popover="">{children}</div> : null),
}));

const { SidebarProvider, useSidebar } = await import('../../src/components/Sidebar/SidebarProvider');
const { SearchPopover, SEARCH_DEBOUNCE_MS, SEARCH_PLACEHOLDER } = await import('../../src/components/app-shell/search-popover');
const { CommandItem } = await import('../../src/components/ui/command');

let renderer: ReactTestRenderer | null = null;
let toggleUnrelatedState: () => void = () => {};

function UnrelatedStateProbe() {
  const { isMeetingActive, setIsMeetingActive } = useSidebar();
  toggleUnrelatedState = () => setIsMeetingActive(!isMeetingActive);
  return null;
}

const root = () => {
  if (!renderer) throw new Error('not rendered');
  return renderer.root;
};
const advance = (ms: number) => act(async () => {
  jest.advanceTimersByTime(ms);
  await Promise.resolve();
});

beforeAll(() => {
  globals.window = {
    addEventListener: windowEvents.addEventListener.bind(windowEvents),
    removeEventListener: windowEvents.removeEventListener.bind(windowEvents),
  };
  globals.document = { activeElement: { hasAttribute: () => false }, querySelector: () => null, addEventListener: () => {}, removeEventListener: () => {} };
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  invoke.mockClear();
  searchResponse = [];
  jest.useRealTimers();
});

afterAll(() => {
  globals.window = originalWindow;
  globals.document = originalDocument;
  mock.module('@tauri-apps/api/core', () => originalCore);
  mock.module('next/navigation', () => originalNavigation);
  mock.module('../../src/contexts/RecordingStateContext', () => originalRecordingState);
  mock.module('../../src/lib/analytics', () => originalAnalytics);
  mock.module('../../src/components/ui/popover', () => originalPopover);
});

async function renderAndSearch(query: string) {
  await act(async () => {
    renderer = create(
      <SidebarProvider>
        <UnrelatedStateProbe />
        <SearchPopover origin="Today" />
      </SidebarProvider>,
    );
  });
  const trigger = root().find((node: ReactTestInstance) => node.type === 'button' && node.props['aria-label'] === 'Search');
  await act(async () => trigger.props.onClick());
  const input = root().find((node: ReactTestInstance) => node.type === 'input' && node.props.placeholder === SEARCH_PLACEHOLDER);
  await act(async () => input.props.onChange({ target: { value: query } }));
  await advance(SEARCH_DEBOUNCE_MS + 50);
}

describe('SearchPopover inside SidebarProvider', () => {
  test('a query runs the search command once; unrelated provider re-renders do not run it again', async () => {
    jest.useFakeTimers();
    await renderAndSearch('roadmap');
    expect(searchCalls()).toEqual([{ query: 'roadmap' }]);

    for (let render = 0; render < 10; render += 1) {
      await act(async () => toggleUnrelatedState());
      await advance(SEARCH_DEBOUNCE_MS + 50);
    }
    expect(searchCalls()).toEqual([{ query: 'roadmap' }]);
  });

  test('renders one CommandItem per result with a unique value and no duplicate-key warning', async () => {
    jest.useFakeTimers();
    searchResponse = [
      { id: 'meeting-a', title: 'Roadmap review', matchContext: 'Roadmap review', timestamp: '' },
      { id: 'meeting-b', title: 'Weekly sync', matchContext: 'First the roadmap for Q3.', timestamp: '00:00' },
    ];
    const consoleError = jest.spyOn(console, 'error');
    try {
      await renderAndSearch('roadmap');
      const values = root().findAllByType(CommandItem).map((item) => item.props.value);

      expect(values).toEqual(['meeting-a', 'meeting-b']);
      expect(consoleError.mock.calls.filter((call) => String(call[0]).includes('same key'))).toEqual([]);
    } finally {
      consoleError.mockRestore();
    }
  });
});
