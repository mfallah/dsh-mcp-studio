// @vitest-environment jsdom
/**
 * The panel rendered for real under jsdom with a fake host: header, catalog,
 * install sheet, drawer, secrets, and the accessibility promises.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { en } from '../../src/client/locales/en.js'
import { fa } from '../../src/client/locales/fa.js'
import { McpStudioPanel } from '../../src/client/panel/McpStudioPage.js'
import { ProbePanel } from '../../src/client/panel/parts/ProbePanel.js'
import { McpStudioController } from '../../src/client/state.js'
import { createFakeApi, flush, makeDetail, makeEntry, makeServer, makeT } from './fake-api.js'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const tEn = makeT(en as unknown as Record<string, string>)
const tFa = makeT(fa as unknown as Record<string, string>)
const ltrLocale = { getSnapshot: () => ({ active: 'en' }), subscribe: () => () => undefined }
const rtlLocale = { getSnapshot: () => ({ active: 'fa' }), subscribe: () => () => undefined }

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

async function settle(): Promise<void> {
  await act(async () => {
    await flush()
    await flush()
  })
}

function buttonByText(text: string, scope: ParentNode = container): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find((button) => button.textContent === text)
  if (!found) {
    throw new Error(
      `no button labelled "${text}"; have: ${[...scope.querySelectorAll('button')].map((b) => b.textContent).join(' | ')}`,
    )
  }
  return found as HTMLButtonElement
}

function dialog(): HTMLElement | null {
  return container.querySelector<HTMLElement>('[role="dialog"]')
}

/** Resolve a controlled input through its real `<label for>` association. */
function inputByLabel(scope: ParentNode, text: string): HTMLInputElement {
  const label = [...scope.querySelectorAll('label')].find((candidate) =>
    candidate.textContent?.trim().startsWith(text),
  )
  const id = label?.getAttribute('for')
  const element = id ? document.getElementById(id) : null
  if (!(element instanceof HTMLInputElement)) throw new Error(`no input labelled "${text}"`)
  return element
}

function click(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

/** Type into a controlled input the way a user would (React's value tracker). */
function typeInto(element: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

/** Fill the required field of the open install sheet. */
async function fillSheet(): Promise<void> {
  const sheet = dialog()
  const input = sheet?.querySelector<HTMLInputElement>('input.mcp-input')
  if (!input) throw new Error('the install sheet rendered no input')
  typeInto(input, '/tmp/data')
  await settle()
}

describe('shell', () => {
  it('renders the Persian title in RTL by default and keeps an h1 heading', async () => {
    const controller = new McpStudioController({ api: createFakeApi().api })
    mount(<McpStudioPanel t={tFa} controller={controller} locale={rtlLocale} />)
    await settle()

    const shell = container.querySelector('.mcp-studio')
    expect(shell).not.toBeNull()
    expect(shell?.getAttribute('dir')).toBe('rtl')
    expect(shell?.getAttribute('lang')).toBe('fa')
    expect(container.querySelector('h1')?.textContent).toBe('استودیوی MCP')
  })

  it('explains an empty installed list instead of showing a bare spinner', async () => {
    const controller = new McpStudioController({ api: createFakeApi().api })
    mount(<McpStudioPanel t={tEn} controller={controller} locale={ltrLocale} />)
    await settle()

    click(buttonByText('Installed'))
    await settle()

    expect(container.textContent).toContain('No MCP servers yet')
    expect(container.textContent).toContain('add a custom server by hand')
  })
})

describe('catalog', () => {
  it('renders a row per entry with publisher, transport, and required-input count', async () => {
    const fake = createFakeApi({
      catalog: { entries: [makeEntry()], total: 1, registryOnline: true },
      categories: ['files'],
    })
    const controller = new McpStudioController({ api: fake.api })
    mount(<McpStudioPanel t={tEn} controller={controller} locale={ltrLocale} />)
    await settle()

    const text = container.textContent ?? ''
    expect(text).toContain('Filesystem')
    expect(text).toContain('by modelcontextprotocol')
    expect(text).toContain('stdio')
    expect(text).toContain('1 required inputs')
    expect(text).toContain('1 of 1 entries')
  })

  it('opens the install sheet with one field per input, password for secrets', async () => {
    const entry = makeEntry({
      inputs: [
        { key: 'root', label: 'Root directory', required: true, secret: false, format: 'directory' },
        { key: 'token', label: 'Access token', required: false, secret: true, format: 'password' },
      ],
    })
    const fake = createFakeApi({ catalog: { entries: [entry], total: 1, registryOnline: true } })
    const controller = new McpStudioController({ api: fake.api })
    mount(<McpStudioPanel t={tEn} controller={controller} locale={ltrLocale} />)
    await settle()

    click(buttonByText('Install'))
    await settle()

    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    expect(container.querySelectorAll('.mcp-field')).toHaveLength(2)
    expect(container.querySelector('input[type="password"]')).not.toBeNull()
    expect(container.textContent).toContain('never written into servers.json')
  })

  it('closes the install sheet on Escape', async () => {
    const fake = createFakeApi({ catalog: { entries: [makeEntry()], total: 1, registryOnline: true } })
    const controller = new McpStudioController({ api: fake.api })
    mount(<McpStudioPanel t={tEn} controller={controller} locale={ltrLocale} />)
    await settle()

    click(buttonByText('Install'))
    await settle()
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('installs through the host draft and opens the new server drawer', async () => {
    const fake = createFakeApi({ catalog: { entries: [makeEntry()], total: 1, registryOnline: true } })
    const controller = new McpStudioController({ api: fake.api })
    mount(<McpStudioPanel t={tEn} controller={controller} locale={ltrLocale} />)
    await settle()

    click(buttonByText('Install'))
    await settle()
    await fillSheet()
    click(buttonByText('Install', dialog() ?? container))
    await settle()

    expect(fake.callsOf('installFromCatalog')).toHaveLength(1)
    expect(fake.callsOf('addServer')).toHaveLength(1)
    const draft = fake.lastCall('addServer')?.args[0] as { serverName: string; title: string }
    expect(draft.serverName).toBe('filesystem')
    expect(draft.title).toBe('Filesystem')
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    expect(container.textContent).toContain('Tools')
  })

  it('shows the install failure inline and keeps the sheet open', async () => {
    const fake = createFakeApi({ catalog: { entries: [makeEntry()], total: 1, registryOnline: true } })
    fake.hooks.addServer = () => {
      throw new Error('registry refused the download')
    }
    const controller = new McpStudioController({ api: fake.api })
    mount(<McpStudioPanel t={tEn} controller={controller} locale={ltrLocale} />)
    await settle()

    click(buttonByText('Install'))
    await settle()
    await fillSheet()
    click(buttonByText('Install', dialog() ?? container))
    await settle()

    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    expect(container.textContent).toContain('registry refused the download')
  })
})

describe('installed servers', () => {
  it('pairs the status colour with a text label', async () => {
    const fake = createFakeApi({
      servers: [makeServer(), makeServer({ id: 'git', serverName: 'git', title: 'GitHub', status: 'error', lastError: 'handshake failed' })],
    })
    const controller = new McpStudioController({ api: fake.api })
    mount(<McpStudioPanel t={tEn} controller={controller} locale={ltrLocale} />)
    await settle()
    click(buttonByText('Installed'))
    await settle()

    const text = container.textContent ?? ''
    expect(text).toContain('Connected')
    expect(text).toContain('Error')
    expect(text).toContain('mcp__files__*')
    expect(text).toContain('2 tools')
    expect(text).toContain('handshake failed')
  })

  it('redacts secret-looking values in the settings tab', async () => {
    const server = makeServer({ usesSecrets: true, secretKeys: ['API_KEY'] })
    const fake = createFakeApi({ servers: [server] })
    fake.state.detail.files = makeDetail(server, {
      ...server,
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'server'],
      env: { API_KEY: 'hunter2', REGION: 'eu' },
    })
    const controller = new McpStudioController({ api: fake.api })
    mount(<McpStudioPanel t={tEn} controller={controller} locale={ltrLocale} />)
    await settle()
    click(buttonByText('Installed'))
    await settle()

    click(buttonByText('Edit'))
    await settle()

    const text = container.textContent ?? ''
    expect(text).toContain('••••••••')
    expect(text).not.toContain('hunter2')
    expect(text).toContain('API_KEY')
    expect(text).toContain('Save changes')
  })

  it('lists stored secret names in the secrets section', async () => {
    const fake = createFakeApi({ servers: [], secrets: ['GITHUB_TOKEN'] })
    const controller = new McpStudioController({ api: fake.api })
    mount(<McpStudioPanel t={tEn} controller={controller} locale={ltrLocale} />)
    await settle()
    click(buttonByText('Installed'))
    await settle()

    expect(container.textContent).toContain('GITHUB_TOKEN')
    expect(container.textContent).toContain('only names travel to this panel')
  })
})

describe('probe codes', () => {
  it('explains a namespace collision in words instead of the raw host error', () => {
    mount(
      <ProbePanel
        t={tEn}
        view={{
          phase: 'ready',
          value: {
            ok: false,
            code: 'namespace-in-use',
            error: 'tool "read_file" is already registered',
            durationMs: 7,
          },
        }}
      />,
    )

    const text = container.textContent ?? ''
    expect(text).toContain('This tool namespace is already owned by an MCP server outside this panel')
    expect(text).toContain('choose a different server name')
    // The host's own message is still shown, so the user can match it to the log.
    expect(text).toContain('already registered')
  })
})

describe('manual add', () => {
  it('stores a secret-marked env row before adding the server and never echoes the raw value', async () => {
    const fake = createFakeApi()
    const controller = new McpStudioController({ api: fake.api })
    mount(<McpStudioPanel t={tEn} controller={controller} locale={ltrLocale} />)
    await settle()
    click(buttonByText('Installed'))
    await settle()
    click(buttonByText('Add manually'))
    await settle()

    const sheet = dialog()
    if (!sheet) throw new Error('the manual form did not open')
    typeInto(inputByLabel(sheet, 'Display title'), 'Secretive')
    typeInto(inputByLabel(sheet, 'Command'), 'npx')
    typeInto(sheet.querySelector<HTMLInputElement>('input[aria-label="Environment variables NAME 1"]')!, 'TOKEN_KEY')
    typeInto(
      sheet.querySelector<HTMLInputElement>('input[aria-label="Environment variables value 1"]')!,
      'super-secret-value',
    )
    const secretBox = sheet.querySelector<HTMLInputElement>('input[type="checkbox"][aria-label^="Secret:"]')
    if (!secretBox) throw new Error('no secret toggle on the env row')
    click(secretBox)
    await settle()
    expect(secretBox.checked).toBe(true)

    click(buttonByText('Add and connect', dialog() ?? container))
    await settle()

    // The value was stored under the sanitized manual name, before addServer.
    expect(fake.lastCall('setSecret')?.args).toEqual(['secretive.TOKEN_KEY', 'super-secret-value'])
    const order = fake.calls.map((call) => call.method)
    expect(order.indexOf('setSecret')).toBeLessThan(order.indexOf('addServer'))

    const draft = fake.lastCall('addServer')?.args[0] as { env: Record<string, string> }
    expect(draft.env.TOKEN_KEY).toBe('${secret:secretive.TOKEN_KEY}')
    expect(JSON.stringify(draft)).not.toContain('super-secret-value')
    expect(container.textContent).not.toContain('super-secret-value')
  })
})
