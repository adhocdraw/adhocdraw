// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

// What the app is allowed to load or connect
// to: only its own files, plus data:/blob: URLs for diagram images and
// exports. This is what stops the app from ever contacting another site.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
]

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

// Puts the policy in the page itself (a <meta> tag), which is how it is enforced on
// GitHub Pages (Pages cannot send custom HTTP headers), asks browsers not to send a
// referrer, and ships the LICENSE, NOTICE and third-party notices with the app.
function staticHosting(): Plugin {
  return {
    name: 'static-hosting',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP_DIRECTIVES.join('; ') },
        injectTo: 'head-prepend',
      },
      { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
    ],
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'LICENSE.txt', source: read('../LICENSE') })
      this.emitFile({ type: 'asset', fileName: 'NOTICE.txt', source: read('../NOTICE') })
      this.emitFile({ type: 'asset', fileName: 'PRIVACY.txt', source: read('../PRIVACY.md') })
      this.emitFile({
        type: 'asset',
        fileName: 'third-party-licenses.txt',
        source: read('./THIRD_PARTY_LICENSES.txt'),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), staticHosting()],
  // Served from a custom domain or from a subfolder (e.g. GitHub Pages), so asset
  // paths are relative.
  base: './',
})
