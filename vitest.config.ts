import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * The `@/*` alias is declared here rather than via vite-tsconfig-paths: that
 * plugin is ESM-only and this config is loaded through CJS on Node 20.18.
 * Keep this in step with `paths` in tsconfig.json.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      /*
       * Next resolves `server-only` through its own bundler rather than from
       * node_modules, so Vitest cannot resolve it and every module under
       * `src/server/**` failed at collection. That is why none of those
       * services had a unit test — and why a detached-method call in
       * `deleteVendorAsAdmin` reached production. The application still gets
       * the real guard; only the test runner sees the stub.
       */
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
})
