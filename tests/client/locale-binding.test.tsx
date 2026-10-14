// @vitest-environment jsdom
/**
 * Regression test for the blank MCP Studio panel.
 *
 * Root cause: `ctx.locale` is a `LocaleRuntime` whose `subscribe` and
 * `getSnapshot` are PROTOTYPE methods that touch `this`. Our `apply` passed the
 * live service straight through the slot `inject` face, and the page handed
 * `locale.subscribe` to `useSyncExternalStore`, which calls it as a bare
 * function — so `this` was `undefined` and the first render threw.
 *
 * The pre-existing render test could not catch this because its locale stub was
 * built from arrow functions, which are already bound. This file models the
 * real service with a class and prototype methods, which is the whole point.
 *
 * Two layers are asserted: the props boundary must hand React bound, stable
 * functions, and the component must survive a caller that ignores the contract.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createStudioFace } from '../../src/client/face.js'
import { en } from '../../src/client/locales/en.js'
import { McpStudioPanel } from '../../src/client/panel/McpStudioPage.js'
import { McpStudioController } from '../../src/client/state.js'
import { createFakeApi, makeT } from './fake-api.js'

/** Faithful stand-in for `@deepseek-ai/dsh-client-locale`'s `LocaleRuntime`. */
class FakeLocaleRuntime {
  /** Prototype field, like the real class (`lib/client.js:1194`). */
  private listeners = new Set<() => void>()
  private snapshot = { active: 'en', revision: 0 }

  /** Prototype method at `lib/client.js:1250`, reads `this`. */
  getSnapshot(): { active: string; revision: number } {
    return this.snapshot
  }

  /** Prototype method at `lib/client.js:1260`, reads `this.listeners`. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Test-only: publish a new revision to one subscriber. */
  emit(): void {
    this.snapshot = { active: this.snapshot.active, revision: this.snapshot.revision + 1 }
    for (const listener of [...this.listeners]) listener()
  }

  /** Test-only: how many subscribers are attached. */
  get subscriberCount(): number {
    return this.listeners.size
  }

  /** Test-only: switch the active locale. */
  setActive(id: string): void {
    this.snapshot = { active: id, revision: this.snapshot.revision + 1 }
    for (const listener of [...this.listeners]) listener()
  }
}

const tEn = makeT(en as unknown as Record<string, string>)

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  for (const node of document.querySelectorAll('style[data-mcp-studio-styles]')) node.remove()
})

function mount(element: Parameters<Root['render']>[0]): void {
  act(() => {
    root.render(element)
  })
}

function newController(): McpStudioController {
  return new McpStudioController({ api: createFakeApi() })
}

describe('studio locale face', () => {
  it('hands React a subscribe that survives being called unbound', () => {
    const face = createStudioFace({ controller: newController(), locale: new FakeLocaleRuntime() })
    expect(face.locale).toBeDefined()
    // This is exactly what useSyncExternalStore does: it takes the function and
    // calls it detached. Before the fix this threw
    // "Cannot read properties of undefined (reading 'listeners')".
    const detached = face.locale!.subscribe
    expect(() => detached(() => undefined)).not.toThrow()
  })

  it('hands React a getSnapshot that reads the live active locale', () => {
    const runtime = new FakeLocaleRuntime()
    const face = createStudioFace({ controller: newController(), locale: runtime })
    expect(face.locale!.getSnapshot().active).toBe('en')
    runtime.setActive('fa')
    expect(face.locale!.getSnapshot().active).toBe('fa')
  })

  it('keeps subscribe and getSnapshot referentially stable across reads', () => {
    const face = createStudioFace({ controller: newController(), locale: new FakeLocaleRuntime() })
    // useSyncExternalStore resubscribes whenever `subscribe` changes identity,
    // so a fresh closure per call would thrash the subscription on every render.
    expect(face.locale!.subscribe).toBe(face.locale!.subscribe)
    expect(face.locale!.getSnapshot).toBe(face.locale!.getSnapshot)
  })

  it('forwards subscriptions to the service and unsubscribes on demand', () => {
    const runtime = new FakeLocaleRuntime()
    const face = createStudioFace({ controller: newController(), locale: runtime })
    const off = face.locale!.subscribe(() => undefined)
    expect(runtime.subscriberCount).toBe(1)
    off()
    expect(runtime.subscriberCount).toBe(0)
  })

  it('omits the locale face entirely when there is no locale service', () => {
    const face = createStudioFace({ controller: newController(), locale: undefined })
    expect(face.locale).toBeUndefined()
  })
})

describe('panel rendering with a this-dependent locale service', () => {
  it('renders through the face', () => {
    const runtime = new FakeLocaleRuntime()
    const face = createStudioFace({ controller: newController(), locale: runtime })
    expect(() =>
      mount(<McpStudioPanel t={tEn} controller={face.controller} locale={face.locale} />),
    ).not.toThrow()
    expect(container.querySelector('h1')?.textContent).toBe(en.title)
  })

  it('still renders when a caller hands over the raw, unbound service', () => {
    // Defence in depth: the props contract says LocaleFace, but a future caller
    // could pass the service itself. The panel must not take the app down.
    const runtime = new FakeLocaleRuntime()
    expect(() =>
      mount(
        <McpStudioPanel
          t={tEn}
          controller={newController()}
          locale={runtime as unknown as { getSnapshot(): { active: string }; subscribe(fn: () => void): () => void }}
        />,
      ),
    ).not.toThrow()
    expect(container.querySelector('h1')?.textContent).toBe(en.title)
  })
})
