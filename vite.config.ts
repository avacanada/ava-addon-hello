import { defineConfig } from 'vite'

// The add-on's bundle: dist/ is what Ava serves from the add-on's own origin,
// under a strict Content-Security-Policy (font-src 'self', script-src 'self').
// So nothing is inlined as data: (assetsInlineLimit 0), the font comes from
// @fontsource as a file in the bundle, and nothing is fetched from a CDN.
// public/ (manifest.json, icon.svg) is copied into dist/ as it is.
export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    target: 'safari17',
    sourcemap: false,
    // Nearly all of the one script is the MCP Apps SDK (its self-contained
    // build); it's served from disk, so its size costs nothing to download.
    chunkSizeWarningLimit: 700,
  },
})
