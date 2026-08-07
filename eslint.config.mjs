import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    /*
     * Gradle build output. It contains a copy of Capacitor's `native-bridge.js`,
     * which is a vendored file we neither wrote nor can fix — linting it turned
     * a clean run into 34 warnings the moment the Android project was first
     * built. `build/**` above does not catch it: that pattern is relative to
     * the repo root, not to any directory.
     */
    'android/**',
  ]),
])

const config = [
  ...eslintConfig,
  {
    rules: {
      // Underscore-prefixed parameters are deliberate: Server Actions used with
      // useActionState must accept (prevState, formData) even when unused.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
]

export default config
