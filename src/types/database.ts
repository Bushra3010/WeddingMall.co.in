/**
 * PLACEHOLDER — regenerate against a real project before writing queries that
 * depend on column types:
 *
 *   npm run db:types
 *
 * Until then this loose shape keeps the Supabase clients generic-typed without
 * pretending to know the schema. It intentionally does not enumerate tables:
 * a hand-maintained copy would drift from the migrations, and the migrations
 * are the schema truth (PRD 19.2, rule 5).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>

export interface Database {
  public: {
    Tables: {
      [key: string]: {
        Row: AnyRow
        Insert: AnyRow
        Update: AnyRow
        Relationships: []
      }
    }
    Views: {
      [key: string]: {
        Row: AnyRow
        Relationships: []
      }
    }
    Functions: {
      [key: string]: {
        Args: AnyRow
        Returns: unknown
      }
    }
    Enums: { [key: string]: string }
    CompositeTypes: Record<string, never>
  }
}
