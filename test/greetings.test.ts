// The guestbook over an in-memory store that behaves like Ava's.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guestbook, KEEP, KEY, MAX_NAME } from '../src/greetings.ts'
import { memoryStore } from './store.ts'

test('a greeting is stored, newest first, and says hello', async () => {
  const store = memoryStore()
  const book = guestbook(store)
  assert.deepEqual(await book.greet('Ada', 1), { greeting: 'Hello, Ada!', count: 1 })
  assert.deepEqual(await book.greet('  Grace \n Hopper ', 2), { greeting: 'Hello, Grace Hopper!', count: 2 })
  assert.deepEqual(store.data.get(KEY), [{ name: 'Grace Hopper', at: 2 }, { name: 'Ada', at: 1 }])
  assert.deepEqual((await book.list()).map(g => g.name), ['Grace Hopper', 'Ada'])
})

test('an empty or overlong name is refused, and nothing is written', async () => {
  const store = memoryStore()
  const book = guestbook(store)
  await assert.rejects(book.greet('   '), /empty/)
  await assert.rejects(book.greet(undefined), /empty/)
  await assert.rejects(book.greet('x'.repeat(MAX_NAME + 1)), /longer than/)
  assert.equal(store.data.has(KEY), false)
  assert.equal((await book.greet('x'.repeat(MAX_NAME))).count, 1)
})

test('greetings at the same moment all land (the tool and the panel at once)', async () => {
  const store = memoryStore()
  const book = guestbook(store)
  await Promise.all(['Ada', 'Grace', 'Edsger', 'Barbara'].map((n, i) => book.greet(n, i)))
  assert.deepEqual((await book.list()).map(g => g.name).sort(), ['Ada', 'Barbara', 'Edsger', 'Grace'])
})

test('the guestbook keeps the newest KEEP and forgets older ones', async () => {
  const store = memoryStore()
  store.data.set(KEY, Array.from({ length: KEEP }, (_, i) => ({ name: `n${i}`, at: i })))
  const book = guestbook(store)
  assert.equal((await book.greet('Newest', 9999)).count, KEEP)
  const all = await book.list()
  assert.equal(all.length, KEEP)
  assert.equal(all[0].name, 'Newest')
  assert.equal(all.at(-1)?.name, `n${KEEP - 2}`)
})

test("whatever is in storage that isn't a greeting is skipped, and clear empties it", async () => {
  const store = memoryStore()
  store.data.set(KEY, [{ name: 'Ada', at: 1 }, null, 'nope', { name: 3, at: 2 }, { name: 'Grace' }])
  const book = guestbook(store)
  assert.deepEqual(await book.list(), [{ name: 'Ada', at: 1 }])
  await book.clear()
  assert.equal(store.data.has(KEY), false)
  assert.deepEqual(await book.list(), [])
})
