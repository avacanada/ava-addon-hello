// The guestbook itself: plain logic over the add-on's own storage, with no
// DOM and no Ava, so the tests run it as it is.
//
// Storage is Ava's key/value store for this add-on alone (the `storage`
// permission): `ava().storage`. Values are JSON. Another add-on can't read
// it, and it stays on this computer.
import type { AvaClient } from '@addiscorp/ava-addon'

/** The part of `ava().storage` the guestbook uses (an in-memory one in tests). */
export type Store = Pick<AvaClient['storage'], 'get' | 'set' | 'delete'>

export type Greeting = { name: string; at: number }

/** The one storage key: every greeting, newest first. */
export const KEY = 'greetings'
/** A name is one line of at most this many characters. */
export const MAX_NAME = 60
/** How many greetings are kept; older ones fall off the end. */
export const KEEP = 200

export const greetingText = (name: string) => `Hello, ${name}!`

/** A name as it's stored: one line, trimmed, 1 to MAX_NAME characters. Throws a sentence a person can read. */
export function cleanName(raw: unknown): string {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim()
  if (!name) throw new Error('Who should Hello greet? The name is empty.')
  if ([...name].length > MAX_NAME) throw new Error(`That name is longer than ${MAX_NAME} characters.`)
  return name
}

/** Whatever storage holds, as greetings: anything that isn't one is skipped, never trusted. */
export function fromStorage(value: unknown): Greeting[] {
  if (!Array.isArray(value)) return []
  return value.filter((g): g is Greeting => !!g && typeof g.name === 'string' && typeof g.at === 'number')
}

/**
 * The guestbook over a store. Every change is a read, then a write, so they
 * run one at a time: a greeting from Ava's tool and one typed in the panel
 * at the same moment both land.
 */
export function guestbook(store: Store) {
  let queue: Promise<unknown> = Promise.resolve()
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const next = queue.then(work)
    queue = next.catch(() => undefined)
    return next
  }
  return {
    list: () => serial(async () => fromStorage(await store.get(KEY))),
    greet: (rawName: unknown, at = Date.now()) =>
      serial(async () => {
        const name = cleanName(rawName)
        const all = [{ name, at }, ...fromStorage(await store.get(KEY))].slice(0, KEEP)
        await store.set(KEY, all)
        return { greeting: greetingText(name), count: all.length }
      }),
    clear: () => serial(() => store.delete(KEY)),
  }
}

export type Guestbook = ReturnType<typeof guestbook>
