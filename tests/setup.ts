import '@testing-library/jest-dom/vitest'

// Env validation runs at import time; unit tests need syntactically valid values.
process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000'
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= 'sb_publishable_test'
