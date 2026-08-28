/**
 * Stub for the `server-only` marker.
 *
 * Next resolves `server-only` through its own bundler — it is not a package in
 * `node_modules`, so Vitest cannot resolve it and any test that imports a
 * module under `src/server/**` fails at collection. That is why none of those
 * services had a unit test, and why a detached-method bug in
 * `deleteVendorAsAdmin` reached production.
 *
 * Aliased in `vitest.config.ts`. This changes nothing about the application:
 * the real import still guards those modules in every build.
 */
export {}
