// The built bundle (run after `npm run build`): what Ava serves, under the
// add-on's Content-Security-Policy, which allows its own origin and nothing
// else (font-src 'self', script-src 'self', connect-src 'self').
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dist = join(import.meta.dirname, '..', 'dist')
const read = (f: string) => readFileSync(join(dist, f), 'utf8')

test('the bundle has its manifest, icon and page, and loads Ava’s client from Ava', () => {
  assert.ok(existsSync(join(dist, 'manifest.json')), 'run npm run build first')
  assert.deepEqual(JSON.parse(read('manifest.json')), JSON.parse(readFileSync(join(import.meta.dirname, '..', 'public', 'manifest.json'), 'utf8')))
  assert.ok(existsSync(join(dist, 'icon.svg')))
  const page = read('index.html')
  assert.match(page, /<script src="\/ava\.js"><\/script>/, 'the page loads /ava.js, which Ava serves')
  assert.ok(!existsSync(join(dist, 'ava.js')), "the bundle never carries its own copy of Ava's client")
})

test('every asset is a file in the bundle: no CDN, no inlined fonts, no other origin', () => {
  const assets = readdirSync(join(dist, 'assets'))
  assert.ok(assets.some(f => f.startsWith('dm-sans-') && f.endsWith('.woff2')), 'DM Sans is bundled')
  const page = read('index.html')
  const css = assets.filter(a => a.endsWith('.css')).map(a => read(join('assets', a)))
  const js = assets.filter(a => a.endsWith('.js')).map(a => read(join('assets', a)))
  // The page and the stylesheets name only files of their own.
  for (const text of [page, ...css]) {
    assert.doesNotMatch(text, /(?:src|href)="(?:https?:)?\/\//, 'the page loads something from another origin')
    assert.doesNotMatch(text, /url\(\s*["']?(?:https?:)?\/\//, 'a stylesheet loads something from another origin')
    assert.doesNotMatch(text, /url\(\s*["']?data:font/, 'a font is inlined as data: (the CSP refuses those)')
  }
  for (const text of [page, ...css, ...js]) {
    assert.doesNotMatch(text, /fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com|jsdelivr\.net|cdnjs\.cloudflare\.com/, 'something reaches a CDN')
  }
})
