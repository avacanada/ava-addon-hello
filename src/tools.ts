// Hello's one tool for Ava, and the MCP side of the add-on.
//
// An add-on's page is an MCP App view (the MCP Apps extension of MCP). When
// it connects, Ava asks it for its tools (`tools/list`) and keeps only the
// ones its manifest declares; when Ava wants one, she sends `tools/call` and
// waits for the answer. Both travel Ava's one bridge, `ava().transport()`.
//
// The tools come from the manifest (one list, never two): each one's MCP
// annotations are its effect class's. Ava reads them as hints only. The
// manifest's class holds, and a tool that claims more, or is seen doing more
// (reaching the network from an `inside` tool, say), is made stricter.
import { App } from '@modelcontextprotocol/ext-apps/app-with-deps'
import type { Effect, Transport } from '@avacanada/ava-addon'
import manifest from '../public/manifest.json' with { type: 'json' }
import type { Guestbook } from './greetings.ts'

/**
 * What each effect class tells Ava, as MCP annotations:
 * - read: only looks; runs without asking.
 * - inside: changes the add-on's own data (its storage, its granted files);
 *   runs without asking.
 * - outside: reaches beyond the add-on (the network, a link); Ava asks the
 *   person to approve every call.
 */
export const ANNOTATIONS = {
  read: { readOnlyHint: true, openWorldHint: false },
  inside: { readOnlyHint: false, openWorldHint: false },
  outside: { readOnlyHint: false, openWorldHint: true },
} as const satisfies Record<Effect, { readOnlyHint: boolean; openWorldHint: boolean }>

function effect(name: string, value: string): Effect {
  if (value === 'read' || value === 'inside' || value === 'outside') return value
  throw new Error(`The manifest gives the tool ${name} the effect "${value}": use read, inside or outside.`)
}

/** The tools as `tools/list` answers them. */
export const TOOLS = manifest.tools.map(t => ({
  name: t.name,
  description: t.description,
  inputSchema: t.input_schema,
  annotations: ANNOTATIONS[effect(t.name, t.effect)],
}))

type Args = Record<string, unknown>
type Answer = Record<string, unknown>

/**
 * What each tool does. `greet` is honest about being `inside`: it writes to
 * Hello's own storage and nothing else. `changed` lets the panel redraw.
 */
export function handlers(book: Guestbook, changed: () => void): Record<string, (args: Args) => Promise<Answer>> {
  return {
    greet: async args => {
      const answer = await book.greet(args.name)
      changed()
      return answer
    },
  }
}

/** One `tools/call`, as MCP's tool result: the answer as text and as data, or an error Ava can read out. */
export async function callTool(tools: ReturnType<typeof handlers>, name: string, args: Args = {}) {
  const run = tools[name]
  try {
    if (!run) throw new Error(`Hello has no tool ${name}.`)
    const answer = await run(args)
    return { content: [{ type: 'text' as const, text: JSON.stringify(answer) }], structuredContent: answer }
  } catch (e) {
    return { isError: true, content: [{ type: 'text' as const, text: e instanceof Error ? e.message : String(e) }] }
  }
}

/**
 * Hello as an MCP App view on `transport`: answers Ava's `tools/list` and
 * `tools/call`. `connect` does the MCP Apps handshake (`ui/initialize`,
 * which brings Ava's theme and colours).
 */
export function view(tools: ReturnType<typeof handlers>, options: { autoResize?: boolean } = {}) {
  const app = new App({ name: manifest.name, version: manifest.version }, { tools: { listChanged: false } }, options)
  app.onlisttools = async () => ({ tools: TOOLS })
  app.oncalltool = async params => callTool(tools, params.name, params.arguments)
  return { app, connect: (transport: Transport) => app.connect(transport) }
}
