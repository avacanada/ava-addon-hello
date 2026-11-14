// The manifest by Ava's rules (src-tauri/src/addons/manifest.rs in
// avacanada/ava; the catalogue checks the same), and the listing beside it.
// Ava refuses a bad manifest before anything of the add-on runs; this finds
// it here first.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { Manifest } from '@addiscorp/ava-addon'

const here = join(import.meta.dirname, '..')
const raw = JSON.parse(readFileSync(join(here, 'public', 'manifest.json'), 'utf8'))
const manifest = raw as Manifest

const KEYS = ['id', 'name', 'version', 'description', 'entry', 'icon', 'permissions', 'egress', 'tools']

test('the manifest is one Ava accepts', () => {
  assert.deepEqual(Object.keys(raw).filter(k => !KEYS.includes(k)), [], 'Ava refuses unknown fields')
  assert.match(manifest.id, /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/)
  assert.ok(!['ava', 'marketplace'].includes(manifest.id) && !/^(ava|addis)-/.test(manifest.id), 'that id is reserved for Ava')
  assert.ok(manifest.name.trim().length >= 1 && [...manifest.name].length <= 40)
  assert.match(manifest.version, /^\d+\.\d+\.\d+(?:[-+].*)?$/)
  assert.ok(existsSync(join(here, 'public', manifest.icon ?? '')), 'the icon is in the bundle')
  assert.ok(existsSync(join(here, manifest.entry ?? 'index.html')), 'the entry page exists')
  for (const t of manifest.tools ?? []) {
    assert.match(t.name, /^[a-z][a-z0-9_]{0,31}$/)
    assert.ok(t.description.trim(), `${t.name} needs a description`)
    assert.ok(['read', 'inside', 'outside'].includes(t.effect))
    assert.equal(t.input_schema.type, 'object')
  }
})

test('Hello asks for exactly what it uses: its storage and tools, and no network', () => {
  assert.deepEqual([...(manifest.permissions ?? [])].sort(), ['storage', 'tools'])
  // `network` and a list of `egress` hosts go together, or not at all.
  assert.deepEqual(manifest.egress, [])
  assert.deepEqual(manifest.tools?.map(t => [t.name, t.effect]), [['greet', 'inside']])
})

test('the listing is there, with its icon', () => {
  const listing = readFileSync(join(here, 'listing', 'listing.toml'), 'utf8')
  const icon = /^icon\s*=\s*"([^"]+)"/m.exec(listing)?.[1]
  assert.ok(icon, 'listing.toml names an icon')
  assert.ok(statSync(join(here, 'listing', icon)).size <= 64 * 1024, 'an SVG icon is at most 64 KiB')
  assert.doesNotMatch(readFileSync(join(here, 'listing', icon), 'utf8'), /<script|\son\w+=|href="(?!#)/, 'the icon is a picture only')
  assert.match(listing, /^category\s*=\s*"developer"/m)
})
