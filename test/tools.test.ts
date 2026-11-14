// Hello as Ava sees it: a fake Ava on the other end of the transport does
// the MCP Apps handshake, lists the tools and calls them, with the same
// messages Ava's host sends (src-tauri/src/addons/mcp.rs in avacanada/ava).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Effect, Transport } from '@avacanada/ava-addon'
import { guestbook, KEY } from '../src/greetings.ts'
import { handlers, view } from '../src/tools.ts'
import manifest from '../public/manifest.json' with { type: 'json' }
import { memoryStore } from './store.ts'

type Message = { jsonrpc: '2.0'; id?: string | number; method?: string; params?: Record<string, unknown>; result?: any; error?: { message: string } }

/** Ava's end of the bridge. */
function fakeAva() {
  const waiting = new Map<string | number, (m: Message) => void>()
  const notified: string[] = []
  let next = 1
  const transport: Transport = {
    async start() {},
    async close() {},
    async send(raw) {
      const m = raw as Message
      if (m.method === 'ui/initialize' && m.id !== undefined) {
        // What Ava answers (mcp.rs, "ui/initialize").
        transport.onmessage?.({
          jsonrpc: '2.0',
          id: m.id,
          result: {
            protocolVersion: '2026-01-26',
            hostInfo: { name: 'Ava', version: '0.0.0' },
            hostCapabilities: { openLinks: {}, logging: {} },
            hostContext: { theme: 'dark', styles: { variables: {} }, displayMode: 'inline', availableDisplayModes: ['inline'], platform: 'desktop' },
          },
        })
      } else if (m.method && m.id === undefined) {
        notified.push(m.method)
      } else if (m.id !== undefined && waiting.has(m.id)) {
        waiting.get(m.id)!(m)
        waiting.delete(m.id)
      }
    },
  }
  /** Send the view a request, as Ava's `ask` does, and wait for its answer. */
  const ask = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<Message>(resolve => {
      const id = `h${next++}`
      waiting.set(id, resolve)
      transport.onmessage?.({ jsonrpc: '2.0', id, method, params })
    })
  return { transport, ask, notified }
}

/** Ava's rule for what annotations claim (mcp.rs `effect_of`). */
function effectOf(a: { readOnlyHint?: boolean; openWorldHint?: boolean } | undefined): Effect {
  if (a?.readOnlyHint === true) return 'read'
  if (a?.openWorldHint === false) return 'inside'
  return 'outside'
}

async function connected() {
  const store = memoryStore()
  let changes = 0
  const hello = view(handlers(guestbook(store), () => changes++), { autoResize: false })
  const ava = fakeAva()
  await hello.connect(ava.transport)
  return { store, ava, changes: () => changes }
}

test('the view does the handshake, then lists exactly its manifest tools, honestly annotated', async () => {
  const { ava } = await connected()
  assert.ok(ava.notified.includes('ui/notifications/initialized'), 'Ava lists tools only after initialized')
  const listed = await ava.ask('tools/list')
  const tools = listed.result.tools as { name: string; annotations: Record<string, boolean> }[]
  assert.deepEqual(tools.map(t => t.name), manifest.tools.map(t => t.name))
  for (const t of manifest.tools) {
    const claimed = effectOf(tools.find(l => l.name === t.name)?.annotations)
    // Ava keeps the stricter of the two, so a looser claim would be ignored
    // and a stricter one would make the tool ask every time.
    assert.equal(claimed, t.effect, `${t.name}'s annotations say ${claimed}, its manifest ${t.effect}`)
  }
})

test("Ava's greet call writes to Hello's storage and answers with the greeting", async () => {
  const { store, ava, changes } = await connected()
  const called = await ava.ask('tools/call', { name: 'greet', arguments: { name: 'Ada' } })
  assert.equal(called.result.isError, undefined)
  assert.deepEqual(called.result.structuredContent, { greeting: 'Hello, Ada!', count: 1 })
  assert.deepEqual(JSON.parse(called.result.content[0].text), { greeting: 'Hello, Ada!', count: 1 })
  assert.equal((store.data.get(KEY) as { name: string }[])[0].name, 'Ada')
  assert.equal(changes(), 1, 'the panel is told to redraw')
})

test('a bad call is a tool error Ava can read out, not a broken channel', async () => {
  const { store, ava } = await connected()
  const empty = await ava.ask('tools/call', { name: 'greet', arguments: { name: ' ' } })
  assert.equal(empty.result.isError, true)
  assert.match(empty.result.content[0].text, /empty/)
  const unknown = await ava.ask('tools/call', { name: 'wave', arguments: {} })
  assert.equal(unknown.result.isError, true)
  assert.match(unknown.result.content[0].text, /no tool wave/)
  assert.equal(store.data.has(KEY), false)
})
