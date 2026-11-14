// An in-memory stand-in for `ava().storage` that behaves like Ava's: values
// go through JSON, and every call waits a turn, as over Ava's bridge.
import type { Store } from '../src/greetings.ts'

export function memoryStore(): Store & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>()
  const later = () => new Promise(resolve => setTimeout(resolve, 1))
  return {
    data,
    async get(key) { await later(); return data.has(key) ? JSON.parse(JSON.stringify(data.get(key))) : null },
    async set(key, value) { await later(); data.set(key, JSON.parse(JSON.stringify(value))) },
    async delete(key) { await later(); data.delete(key) },
  }
}
