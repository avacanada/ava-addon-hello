// Hello's panel: what the person sees when they open Hello beside the chat.
// Plain DOM, no framework. The guestbook is in greetings.ts, the tool in
// tools.ts; this file draws them and connects to Ava.
//
// Fonts are files in the bundle (@fontsource), never a CDN: the add-on's
// Content-Security-Policy allows fonts, scripts and styles from its own
// origin only.
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/600.css'
import './style.css'
import { applyDocumentTheme, applyHostStyleVariables, type McpUiHostContext } from '@modelcontextprotocol/ext-apps/app-with-deps'
import { ava } from '@addiscorp/ava-addon'
import { guestbook, greetingText, MAX_NAME, type Greeting } from './greetings.ts'
import { handlers, view } from './tools.ts'

const client = ava()
const book = guestbook(client.storage)

// ---- Drawing ----
/** The panel shows the newest few; the rest stay in storage, counted. */
const SHOWN = 20

const root = document.getElementById('app') as HTMLElement
const form = document.createElement('form')
const input = Object.assign(document.createElement('input'), {
  type: 'text',
  placeholder: 'Your name',
  maxLength: MAX_NAME,
  required: true,
  autocomplete: 'off',
})
input.setAttribute('aria-label', 'Name')
const button = Object.assign(document.createElement('button'), { type: 'submit', textContent: 'Say hello' })
const status = document.createElement('p')
status.className = 'status'
status.setAttribute('role', 'status')
const list = document.createElement('ol')
const footer = document.createElement('footer')
const clear = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Clear', className: 'quiet' })
const count = document.createElement('span')
footer.append(count, clear)
form.append(input, button)

const heading = Object.assign(document.createElement('h1'), { textContent: 'Hello' })
const hint = Object.assign(document.createElement('p'), {
  className: 'hint',
  textContent: 'Type a name, or ask Ava: “say hello to Ada in Hello”.',
})
root.append(heading, hint, form, status, list, footer)

const when = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function draw(all: Greeting[]) {
  list.replaceChildren(
    ...all.slice(0, SHOWN).map(g => {
      const li = document.createElement('li')
      const text = Object.assign(document.createElement('span'), { textContent: greetingText(g.name) })
      const time = Object.assign(document.createElement('time'), { textContent: when.format(g.at), dateTime: new Date(g.at).toISOString() })
      li.append(text, time)
      return li
    }),
  )
  count.textContent = all.length === 0 ? 'No greetings yet.' : all.length > SHOWN ? `The newest ${SHOWN} of ${all.length}.` : `${all.length} in all.`
  clear.hidden = all.length === 0
}

/** Draw from storage, which is the truth (Ava's tool may have just written to it). */
async function refresh() {
  try {
    draw(await book.list())
  } catch {
    // People see a plain sentence; the details go to the log.
    status.textContent = "Hello couldn't read its guestbook."
  }
}

form.addEventListener('submit', async e => {
  e.preventDefault()
  try {
    const { greeting } = await book.greet(input.value)
    status.textContent = greeting
    input.value = ''
    await refresh()
  } catch (err) {
    status.textContent = err instanceof Error ? err.message : "Hello couldn't save that."
  }
})

clear.addEventListener('click', async () => {
  await book.clear().catch(() => undefined)
  status.textContent = ''
  await refresh()
})

// ---- Ava ----
// Ava's theme and colours arrive in the handshake and whenever they change,
// as MCP Apps' standard style variables (style.css falls back to its own).
// Note it's `styles.variables` that holds them, not `styles`.
function wear(ctx: McpUiHostContext | undefined) {
  if (ctx?.theme) applyDocumentTheme(ctx.theme)
  if (ctx?.styles?.variables) applyHostStyleVariables(ctx.styles.variables)
}

const hello = view(handlers(book, () => void refresh()))
hello.app.onhostcontextchanged = ctx => wear(ctx)
hello
  .connect(client.transport())
  .then(() => wear(hello.app.getHostContext()))
  .catch(e => console.error('Hello: connecting to Ava failed', e))

void refresh()
