/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with:
 *   PGPASSWORD=... npm run db:types
 *
 * Source of truth is supabase/migrations/. If this file disagrees with the
 * database, regenerate rather than patching.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      admin_memberships: {
        Row: {
          id: string
          user_id: string
          role_id: string
          status: Database['public']['Enums']['membership_status']
          invited_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role_id: string
          status?: Database['public']['Enums']['membership_status']
          invited_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role_id?: string
          status?: Database['public']['Enums']['membership_status']
          invited_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'admin_memberships_invited_by_fkey'
            columns: ['invited_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'admin_memberships_role_id_fkey'
            columns: ['role_id']
            isOneToOne: false
            referencedRelation: 'admin_roles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'admin_memberships_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      admin_permissions: {
        Row: {
          id: string
          code: string
          description: string | null
        }
        Insert: {
          id?: string
          code: string
          description?: string | null
        }
        Update: {
          id?: string
          code?: string
          description?: string | null
        }
        Relationships: []
      }
      admin_role_permissions: {
        Row: {
          role_id: string
          permission_id: string
        }
        Insert: {
          role_id: string
          permission_id: string
        }
        Update: {
          role_id?: string
          permission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'admin_role_permissions_permission_id_fkey'
            columns: ['permission_id']
            isOneToOne: false
            referencedRelation: 'admin_permissions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'admin_role_permissions_role_id_fkey'
            columns: ['role_id']
            isOneToOne: false
            referencedRelation: 'admin_roles'
            referencedColumns: ['id']
          },
        ]
      }
      admin_roles: {
        Row: {
          id: string
          code: string
          name: string
        }
        Insert: {
          id?: string
          code: string
          name: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          id: string
          anonymous_id: string | null
          user_id: string | null
          session_id: string | null
          name: string
          entity_type: string | null
          entity_id: string | null
          properties_json: Json
          occurred_at: string
        }
        Insert: {
          id?: string
          anonymous_id?: string | null
          user_id?: string | null
          session_id?: string | null
          name: string
          entity_type?: string | null
          entity_id?: string | null
          properties_json?: Json
          occurred_at?: string
        }
        Update: {
          id?: string
          anonymous_id?: string | null
          user_id?: string | null
          session_id?: string | null
          name?: string
          entity_type?: string | null
          entity_id?: string | null
          properties_json?: Json
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'analytics_events_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      areas: {
        Row: {
          id: string
          city_id: string
          name: string
          slug: string
          latitude: number | null
          longitude: number | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          city_id: string
          name: string
          slug: string
          latitude?: number | null
          longitude?: number | null
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          city_id?: string
          name?: string
          slug?: string
          latitude?: number | null
          longitude?: number | null
          active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'areas_city_id_fkey'
            columns: ['city_id']
            isOneToOne: false
            referencedRelation: 'cities'
            referencedColumns: ['id']
          },
        ]
      }
      audit_logs: {
        Row: {
          id: string
          actor_user_id: string | null
          actor_type: Database['public']['Enums']['actor_type']
          action: string
          entity_type: string
          entity_id: string | null
          before_json: Json | null
          after_json: Json | null
          reason: string | null
          ip_hash: string | null
          request_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_user_id?: string | null
          actor_type?: Database['public']['Enums']['actor_type']
          action: string
          entity_type: string
          entity_id?: string | null
          before_json?: Json | null
          after_json?: Json | null
          reason?: string | null
          ip_hash?: string | null
          request_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_user_id?: string | null
          actor_type?: Database['public']['Enums']['actor_type']
          action?: string
          entity_type?: string
          entity_id?: string | null
          before_json?: Json | null
          after_json?: Json | null
          reason?: string | null
          ip_hash?: string | null
          request_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_logs_actor_user_id_fkey'
            columns: ['actor_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      categories: {
        Row: {
          id: string
          parent_id: string | null
          name: string
          slug: string
          icon: string | null
          description: string | null
          seo_title: string | null
          seo_description: string | null
          intro_html: string | null
          active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          parent_id?: string | null
          name: string
          slug: string
          icon?: string | null
          description?: string | null
          seo_title?: string | null
          seo_description?: string | null
          intro_html?: string | null
          active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          parent_id?: string | null
          name?: string
          slug?: string
          icon?: string | null
          description?: string | null
          seo_title?: string | null
          seo_description?: string | null
          intro_html?: string | null
          active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'categories_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      category_attributes: {
        Row: {
          id: string
          category_id: string
          code: string
          label: string
          help_text: string | null
          input_type: string
          data_type: string
          unit: string | null
          filterable: boolean
          required: boolean
          options_json: Json
          validation_json: Json
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          category_id: string
          code: string
          label: string
          help_text?: string | null
          input_type: string
          data_type: string
          unit?: string | null
          filterable?: boolean
          required?: boolean
          options_json?: Json
          validation_json?: Json
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          category_id?: string
          code?: string
          label?: string
          help_text?: string | null
          input_type?: string
          data_type?: string
          unit?: string | null
          filterable?: boolean
          required?: boolean
          options_json?: Json
          validation_json?: Json
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'category_attributes_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      cities: {
        Row: {
          id: string
          state_id: string
          name: string
          slug: string
          latitude: number | null
          longitude: number | null
          timezone: string
          aliases: unknown[]
          seo_title: string | null
          seo_description: string | null
          intro_html: string | null
          active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          state_id: string
          name: string
          slug: string
          latitude?: number | null
          longitude?: number | null
          timezone?: string
          aliases?: unknown[]
          seo_title?: string | null
          seo_description?: string | null
          intro_html?: string | null
          active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          state_id?: string
          name?: string
          slug?: string
          latitude?: number | null
          longitude?: number | null
          timezone?: string
          aliases?: unknown[]
          seo_title?: string | null
          seo_description?: string | null
          intro_html?: string | null
          active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cities_state_id_fkey'
            columns: ['state_id']
            isOneToOne: false
            referencedRelation: 'states'
            referencedColumns: ['id']
          },
        ]
      }
      conversations: {
        Row: {
          id: string
          enquiry_id: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          enquiry_id: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          enquiry_id?: string
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'conversations_enquiry_id_fkey'
            columns: ['enquiry_id']
            isOneToOne: true
            referencedRelation: 'enquiries'
            referencedColumns: ['id']
          },
        ]
      }
      countries: {
        Row: {
          id: string
          code: string
          name: string
          currency: string
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          currency?: string
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          currency?: string
          active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      data_requests: {
        Row: {
          id: string
          user_id: string
          type: string
          status: string
          requested_at: string
          completed_at: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          status?: string
          requested_at?: string
          completed_at?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          status?: string
          requested_at?: string
          completed_at?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'data_requests_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      enquiries: {
        Row: {
          id: string
          rfq_id: string | null
          customer_id: string
          vendor_id: string
          category_id: string | null
          event_date: string | null
          flexible_date: string | null
          city_id: string | null
          budget_min_minor: number | null
          budget_max_minor: number | null
          currency: string
          guest_count: number | null
          requirements_json: Json
          message: string | null
          preferred_contact_mode: string | null
          status: Database['public']['Enums']['enquiry_status']
          contact_consent: boolean
          assigned_vendor_member_id: string | null
          idempotency_key: string | null
          delivered_at: string | null
          first_response_at: string | null
          lost_reason: string | null
          quote_amount_minor: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          rfq_id?: string | null
          customer_id: string
          vendor_id: string
          category_id?: string | null
          event_date?: string | null
          flexible_date?: string | null
          city_id?: string | null
          budget_min_minor?: number | null
          budget_max_minor?: number | null
          currency?: string
          guest_count?: number | null
          requirements_json?: Json
          message?: string | null
          preferred_contact_mode?: string | null
          status?: Database['public']['Enums']['enquiry_status']
          contact_consent?: boolean
          assigned_vendor_member_id?: string | null
          idempotency_key?: string | null
          delivered_at?: string | null
          first_response_at?: string | null
          lost_reason?: string | null
          quote_amount_minor?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          rfq_id?: string | null
          customer_id?: string
          vendor_id?: string
          category_id?: string | null
          event_date?: string | null
          flexible_date?: string | null
          city_id?: string | null
          budget_min_minor?: number | null
          budget_max_minor?: number | null
          currency?: string
          guest_count?: number | null
          requirements_json?: Json
          message?: string | null
          preferred_contact_mode?: string | null
          status?: Database['public']['Enums']['enquiry_status']
          contact_consent?: boolean
          assigned_vendor_member_id?: string | null
          idempotency_key?: string | null
          delivered_at?: string | null
          first_response_at?: string | null
          lost_reason?: string | null
          quote_amount_minor?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'enquiries_assigned_vendor_member_id_fkey'
            columns: ['assigned_vendor_member_id']
            isOneToOne: false
            referencedRelation: 'vendor_memberships'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'enquiries_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'enquiries_city_id_fkey'
            columns: ['city_id']
            isOneToOne: false
            referencedRelation: 'cities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'enquiries_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'enquiries_rfq_id_fkey'
            columns: ['rfq_id']
            isOneToOne: false
            referencedRelation: 'rfq_requests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'enquiries_vendor_id_fkey'
            columns: ['vendor_id']
            isOneToOne: false
            referencedRelation: 'vendors'
            referencedColumns: ['id']
          },
        ]
      }
      enquiry_events: {
        Row: {
          id: string
          enquiry_id: string
          actor_user_id: string | null
          actor_type: Database['public']['Enums']['actor_type']
          event_type: string
          from_status: Database['public']['Enums']['enquiry_status'] | null
          to_status: Database['public']['Enums']['enquiry_status'] | null
          reason: string | null
          metadata_json: Json
          created_at: string
        }
        Insert: {
          id?: string
          enquiry_id: string
          actor_user_id?: string | null
          actor_type: Database['public']['Enums']['actor_type']
          event_type: string
          from_status?: Database['public']['Enums']['enquiry_status'] | null
          to_status?: Database['public']['Enums']['enquiry_status'] | null
          reason?: string | null
          metadata_json?: Json
          created_at?: string
        }
        Update: {
          id?: string
          enquiry_id?: string
          actor_user_id?: string | null
          actor_type?: Database['public']['Enums']['actor_type']
          event_type?: string
          from_status?: Database['public']['Enums']['enquiry_status'] | null
          to_status?: Database['public']['Enums']['enquiry_status'] | null
          reason?: string | null
          metadata_json?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'enquiry_events_actor_user_id_fkey'
            columns: ['actor_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'enquiry_events_enquiry_id_fkey'
            columns: ['enquiry_id']
            isOneToOne: false
            referencedRelation: 'enquiries'
            referencedColumns: ['id']
          },
        ]
      }
      enquiry_notes: {
        Row: {
          id: string
          enquiry_id: string
          vendor_id: string
          author_user_id: string
          note: string
          follow_up_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          enquiry_id: string
          vendor_id: string
          author_user_id: string
          note: string
          follow_up_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          enquiry_id?: string
          vendor_id?: string
          author_user_id?: string
          note?: string
          follow_up_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'enquiry_notes_author_user_id_fkey'
            columns: ['author_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'enquiry_notes_enquiry_id_fkey'
            columns: ['enquiry_id']
            isOneToOne: false
            referencedRelation: 'enquiries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'enquiry_notes_vendor_id_fkey'
            columns: ['vendor_id']
            isOneToOne: false
            referencedRelation: 'vendors'
            referencedColumns: ['id']
          },
        ]
      }
      faqs: {
        Row: {
          id: string
          scope: string
          scope_id: string | null
          question: string
          answer: string
          active: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          scope?: string
          scope_id?: string | null
          question: string
          answer: string
          active?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          scope?: string
          scope_id?: string | null
          question?: string
          answer?: string
          active?: boolean
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      homepage_sections: {
        Row: {
          id: string
          code: string
          title: string | null
          config_json: Json
          active: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          title?: string | null
          config_json?: Json
          active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          title?: string | null
          config_json?: Json
          active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      message_attachments: {
        Row: {
          id: string
          message_id: string
          storage_path: string
          mime_type: string
          size_bytes: number
          scan_status: string
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          storage_path: string
          mime_type: string
          size_bytes: number
          scan_status?: string
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          storage_path?: string
          mime_type?: string
          size_bytes?: number
          scan_status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'message_attachments_message_id_fkey'
            columns: ['message_id']
            isOneToOne: false
            referencedRelation: 'messages'
            referencedColumns: ['id']
          },
        ]
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_user_id: string
          body: string
          status: string
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_user_id: string
          body: string
          status?: string
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_user_id?: string
          body?: string
          status?: string
          read_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey'
            columns: ['conversation_id']
            isOneToOne: false
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_sender_user_id_fkey'
            columns: ['sender_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      notification_preferences: {
        Row: {
          user_id: string
          channel: Database['public']['Enums']['notification_channel']
          notification_group: string
          enabled: boolean
        }
        Insert: {
          user_id: string
          channel: Database['public']['Enums']['notification_channel']
          notification_group: string
          enabled?: boolean
        }
        Update: {
          user_id?: string
          channel?: Database['public']['Enums']['notification_channel']
          notification_group?: string
          enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'notification_preferences_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      notification_templates: {
        Row: {
          id: string
          code: string
          channel: Database['public']['Enums']['notification_channel']
          locale: string
          subject: string | null
          body: string
          version: number
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          channel: Database['public']['Enums']['notification_channel']
          locale?: string
          subject?: string | null
          body: string
          version?: number
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          channel?: Database['public']['Enums']['notification_channel']
          locale?: string
          subject?: string | null
          body?: string
          version?: number
          active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string | null
          code: string
          channel: Database['public']['Enums']['notification_channel']
          payload_json: Json
          status: string
          scheduled_at: string
          sent_at: string | null
          read_at: string | null
          provider_message_id: string | null
          attempts: number
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          code: string
          channel: Database['public']['Enums']['notification_channel']
          payload_json?: Json
          status?: string
          scheduled_at?: string
          sent_at?: string | null
          read_at?: string | null
          provider_message_id?: string | null
          attempts?: number
          error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          code?: string
          channel?: Database['public']['Enums']['notification_channel']
          payload_json?: Json
          status?: string
          scheduled_at?: string
          sent_at?: string | null
          read_at?: string | null
          provider_message_id?: string | null
          attempts?: number
          error?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      pages: {
        Row: {
          id: string
          slug: string
          title: string
          body: string | null
          status: Database['public']['Enums']['content_status']
          seo_title: string | null
          seo_description: string | null
          canonical_url: string | null
          og_image_path: string | null
          published_at: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          title: string
          body?: string | null
          status?: Database['public']['Enums']['content_status']
          seo_title?: string | null
          seo_description?: string | null
          canonical_url?: string | null
          og_image_path?: string | null
          published_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          title?: string
          body?: string | null
          status?: Database['public']['Enums']['content_status']
          seo_title?: string | null
          seo_description?: string | null
          canonical_url?: string | null
          og_image_path?: string | null
          published_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pages_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pages_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      payments: {
        Row: {
          id: string
          vendor_id: string
          subscription_id: string | null
          provider: string
          provider_payment_id: string | null
          amount_minor: number
          currency: string
          status: string
          paid_at: string | null
          metadata_json: Json
          created_at: string
        }
        Insert: {
          id?: string
          vendor_id: string
          subscription_id?: string | null
          provider?: string
          provider_payment_id?: string | null
          amount_minor: number
          currency?: string
          status?: string
          paid_at?: string | null
          metadata_json?: Json
          created_at?: string
        }
        Update: {
          id?: string
          vendor_id?: string
          subscription_id?: string | null
          provider?: string
          provider_payment_id?: string | null
          amount_minor?: number
          currency?: string
          status?: string
          paid_at?: string | null
          metadata_json?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'payments_subscription_id_fkey'
            columns: ['subscription_id']
            isOneToOne: false
            referencedRelation: 'subscriptions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payments_vendor_id_fkey'
            columns: ['vendor_id']
            isOneToOne: false
            referencedRelation: 'vendors'
            referencedColumns: ['id']
          },
        ]
      }
      plans: {
        Row: {
          id: string
          code: string
          name: string
          billing_interval: string
          amount_minor: number
          currency: string
          entitlements_json: Json
          trial_days: number
          active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          billing_interval: string
          amount_minor: number
          currency?: string
          entitlements_json?: Json
          trial_days?: number
          active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          billing_interval?: string
          amount_minor?: number
          currency?: string
          entitlements_json?: Json
          trial_days?: number
          active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          id: string
          slug: string
          title: string
          excerpt: string | null
          body: string | null
          cover_path: string | null
          author_id: string | null
          category: string | null
          status: Database['public']['Enums']['content_status']
          seo_title: string | null
          seo_description: string | null
          canonical_url: string | null
          og_image_path: string | null
          published_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          title: string
          excerpt?: string | null
          body?: string | null
          cover_path?: string | null
          author_id?: string | null
          category?: string | null
          status?: Database['public']['Enums']['content_status']
          seo_title?: string | null
          seo_description?: string | null
          canonical_url?: string | null
          og_image_path?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          title?: string
          excerpt?: string | null
          body?: string | null
          cover_path?: string | null
          author_id?: string | null
          category?: string | null
          status?: Database['public']['Enums']['content_status']
          seo_title?: string | null
          seo_description?: string | null
          canonical_url?: string | null
          og_image_path?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'posts_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_path: string | null
          phone: string | null
          phone_verified_at: string | null
          locale: string
          timezone: string
          status: Database['public']['Enums']['profile_status']
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_path?: string | null
          phone?: string | null
          phone_verified_at?: string | null
          locale?: string
          timezone?: string
          status?: Database['public']['Enums']['profile_status']
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_path?: string | null
          phone?: string | null
          phone_verified_at?: string | null
          locale?: string
          timezone?: string
          status?: Database['public']['Enums']['profile_status']
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      review_media: {
        Row: {
          id: string
          review_id: string
          storage_path: string
          moderation_status: Database['public']['Enums']['moderation_status']
          created_at: string
        }
        Insert: {
          id?: string
          review_id: string
          storage_path: string
          moderation_status?: Database['public']['Enums']['moderation_status']
          created_at?: string
        }
        Update: {
          id?: string
          review_id?: string
          storage_path?: string
          moderation_status?: Database['public']['Enums']['moderation_status']
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'review_media_review_id_fkey'
            columns: ['review_id']
            isOneToOne: false
            referencedRelation: 'reviews'
            referencedColumns: ['id']
          },
        ]
      }
      review_responses: {
        Row: {
          id: string
          review_id: string
          vendor_id: string
          author_user_id: string | null
          body: string
          status: Database['public']['Enums']['moderation_status']
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          review_id: string
          vendor_id: string
          author_user_id?: string | null
          body: string
          status?: Database['public']['Enums']['moderation_status']
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          review_id?: string
          vendor_id?: string
          author_user_id?: string | null
          body?: string
          status?: Database['public']['Enums']['moderation_status']
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'review_responses_author_user_id_fkey'
            columns: ['author_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'review_responses_review_id_fkey'
            columns: ['review_id']
            isOneToOne: true
            referencedRelation: 'reviews'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'review_responses_vendor_id_fkey'
            columns: ['vendor_id']
            isOneToOne: false
            referencedRelation: 'vendors'
            referencedColumns: ['id']
          },
        ]
      }
      review_revisions: {
        Row: {
          id: string
          review_id: string
          body: string | null
          title: string | null
          rating: number | null
          created_at: string
        }
        Insert: {
          id?: string
          review_id: string
          body?: string | null
          title?: string | null
          rating?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          review_id?: string
          body?: string | null
          title?: string | null
          rating?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'review_revisions_review_id_fkey'
            columns: ['review_id']
            isOneToOne: false
            referencedRelation: 'reviews'
            referencedColumns: ['id']
          },
        ]
      }
      reviews: {
        Row: {
          id: string
          enquiry_id: string
          customer_id: string
          vendor_id: string
          overall_rating: number
          subratings_json: Json
          title: string | null
          body: string | null
          event_date: string | null
          status: Database['public']['Enums']['moderation_status']
          moderation_reason: string | null
          reviewer_id: string | null
          edited_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          enquiry_id: string
          customer_id: string
          vendor_id: string
          overall_rating: number
          subratings_json?: Json
          title?: string | null
          body?: string | null
          event_date?: string | null
          status?: Database['public']['Enums']['moderation_status']
          moderation_reason?: string | null
          reviewer_id?: string | null
          edited_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          enquiry_id?: string
          customer_id?: string
          vendor_id?: string
          overall_rating?: number
          subratings_json?: Json
          title?: string | null
          body?: string | null
          event_date?: string | null
          status?: Database['public']['Enums']['moderation_status']
          moderation_reason?: string | null
          reviewer_id?: string | null
          edited_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reviews_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reviews_enquiry_id_fkey'
            columns: ['enquiry_id']
            isOneToOne: false
            referencedRelation: 'enquiries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reviews_reviewer_id_fkey'
            columns: ['reviewer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reviews_vendor_id_fkey'
            columns: ['vendor_id']
            isOneToOne: false
            referencedRelation: 'vendors'
            referencedColumns: ['id']
          },
        ]
      }
      rfq_requests: {
        Row: {
          id: string
          customer_id: string
          category_id: string | null
          city_id: string | null
          requirements_json: Json
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          category_id?: string | null
          city_id?: string | null
          requirements_json?: Json
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          category_id?: string | null
          city_id?: string | null
          requirements_json?: Json
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'rfq_requests_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rfq_requests_city_id_fkey'
            columns: ['city_id']
            isOneToOne: false
            referencedRelation: 'cities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rfq_requests_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      shortlists: {
        Row: {
          id: string
          user_id: string
          vendor_id: string
          note: string | null
          compare_flag: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          vendor_id: string
          note?: string | null
          compare_flag?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          vendor_id?: string
          note?: string | null
          compare_flag?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'shortlists_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shortlists_vendor_id_fkey'
            columns: ['vendor_id']
            isOneToOne: false
            referencedRelation: 'vendors'
            referencedColumns: ['id']
          },
        ]
      }
      slug_redirects: {
        Row: {
          id: string
          entity_type: string
          entity_id: string | null
          old_slug: string
          new_slug: string
          status_code: number
          created_at: string
        }
        Insert: {
          id?: string
          entity_type: string
          entity_id?: string | null
          old_slug: string
          new_slug: string
          status_code?: number
          created_at?: string
        }
        Update: {
          id?: string
          entity_type?: string
          entity_id?: string | null
          old_slug?: string
          new_slug?: string
          status_code?: number
          created_at?: string
        }
        Relationships: []
      }
      states: {
        Row: {
          id: string
          country_id: string
          name: string
          slug: string
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          country_id: string
          name: string
          slug: string
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          country_id?: string
          name?: string
          slug?: string
          active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'states_country_id_fkey'
            columns: ['country_id']
            isOneToOne: false
            referencedRelation: 'countries'
            referencedColumns: ['id']
          },
        ]
      }
      subscriptions: {
        Row: {
          id: string
          vendor_id: string
          plan_id: string
          provider: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database['public']['Enums']['subscription_status']
          period_start: string | null
          period_end: string | null
          cancel_at_period_end: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vendor_id: string
          plan_id: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database['public']['Enums']['subscription_status']
          period_start?: string | null
          period_end?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vendor_id?: string
          plan_id?: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database['public']['Enums']['subscription_status']
          period_start?: string | null
          period_end?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_plan_id_fkey'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'plans'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'subscriptions_vendor_id_fkey'
            columns: ['vendor_id']
            isOneToOne: false
            referencedRelation: 'vendors'
            referencedColumns: ['id']
          },
        ]
      }
      support_tickets: {
        Row: {
          id: string
          user_id: string | null
          vendor_id: string | null
          enquiry_id: string | null
          type: string
          priority: string
          status: string
          subject: string | null
          body: string | null
          assigned_admin_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          vendor_id?: string | null
          enquiry_id?: string | null
          type: string
          priority?: string
          status?: string
          subject?: string | null
          body?: string | null
          assigned_admin_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          vendor_id?: string | null
          enquiry_id?: string | null
          type?: string
          priority?: string
          status?: string
          subject?: string | null
          body?: string | null
          assigned_admin_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'support_tickets_assigned_admin_id_fkey'
            columns: ['assigned_admin_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'support_tickets_enquiry_id_fkey'
            columns: ['enquiry_id']
            isOneToOne: false
            referencedRelation: 'enquiries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'support_tickets_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'support_tickets_vendor_id_fkey'
            columns: ['vendor_id']
            isOneToOne: false
            referencedRelation: 'vendors'
            referencedColumns: ['id']
          },
        ]
      }
      testimonials: {
        Row: {
          id: string
          author_name: string
          author_city: string | null
          body: string
          avatar_path: string | null
          active: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          author_name: string
          author_city?: string | null
          body: string
          avatar_path?: string | null
          active?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          author_name?: string
          author_city?: string | null
          body?: string
          avatar_path?: string | null
          active?: boolean
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      user_consents: {
        Row: {
          id: string
          user_id: string
          consent_type: string
          policy_version: string
          granted: boolean
          source: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          consent_type: string
          policy_version: string
          granted: boolean
          source?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          consent_type?: string
          policy_version?: string
          granted?: boolean
          source?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_consents_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      vendor_addresses: {
        Row: {
          id: string
          vendor_id: string
          type: string
          line1: string | null
          line2: string | null
          city_id: string | null
          postal_code: string | null
          latitude: number | null
          longitude: number | null
          public_visibility: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vendor_id: string
          type?: string
          line1?: string | null
          line2?: string | null
          city_id?: string | null
          postal_code?: string | null
          latitude?: number | null
          longitude?: number | null
          public_visibility?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vendor_id?: string
          type?: string
          line1?: string | null
          line2?: string | null
          city_id?: string | null
          postal_code?: string | null
          latitude?: number | null
          longitude?: number | null
          public_visibility?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'vendor_addresses_city_id_fkey'
            columns: ['city_id']
            isOneToOne: false
            referencedRelation: 'cities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendor_addresses_vendor_id_fkey'
            columns: ['vendor_id']
            isOneToOne: false
            referencedRelation: 'vendors'
            referencedColumns: ['id']
          },
        ]
      }
      vendor_attribute_values: {
        Row: {
          vendor_id: string
          category_attribute_id: string
          value_json: Json
        }
        Insert: {
          vendor_id: string
          category_attribute_id: string
          value_json: Json
        }
        Update: {
          vendor_id?: string
          category_attribute_id?: string
          value_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'vendor_attribute_values_category_attribute_id_fkey'
            columns: ['category_attribute_id']
            isOneToOne: false
            referencedRelation: 'category_attributes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendor_attribute_values_vendor_id_fkey'
            columns: ['vendor_id']
            isOneToOne: false
            referencedRelation: 'vendors'
            referencedColumns: ['id']
          },
        ]
      }
      vendor_availability: {
        Row: {
          id: string
          vendor_id: string
          start_date: string
          end_date: string
          status: Database['public']['Enums']['availability_status']
          note_private: string | null
          created_at: string
        }
        Insert: {
          id?: string
          vendor_id: string
          start_date: string
          end_date: string
          status?: Database['public']['Enums']['availability_status']
          note_private?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          vendor_id?: string
          start_date?: string
          end_date?: string
          status?: Database['public']['Enums']['availability_status']
          note_private?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'vendor_availability_vendor_id_fkey'
            columns: ['vendor_id']
            isOneToOne: false
            referencedRelation: 'vendors'
            referencedColumns: ['id']
          },
        ]
      }
      vendor_categories: {
        Row: {
          vendor_id: string
          category_id: string
          is_primary: boolean
        }
        Insert: {
          vendor_id: string
          category_id: string
          is_primary?: boolean
        }
        Update: {
          vendor_id?: string
          category_id?: string
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'vendor_categories_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendor_categories_vendor_id_fkey'
            columns: ['vendor_id']
            isOneToOne: true
            referencedRelation: 'vendors'
            referencedColumns: ['id']
          },
        ]
      }
      vendor_documents: {
        Row: {
          id: string
          verification_id: string
          storage_path: string
          document_type: string
          hash: string | null
          expiry_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          verification_id: string
          storage_path: string
          document_type: string
          hash?: string | null
          expiry_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          verification_id?: string
          storage_path?: string
          document_type?: string
          hash?: string | null
          expiry_date?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'vendor_documents_verification_id_fkey'
            columns: ['verification_id']
            isOneToOne: false
            referencedRelation: 'vendor_verifications'
            referencedColumns: ['id']
          },
        ]
      }
      vendor_listing_versions: {
        Row: {
          id: string
          listing_id: string
          version_no: number
          snapshot_json: Json
          status: Database['public']['Enums']['moderation_status']
          reviewer_id: string | null
          reason: string | null
          created_at: string
          decided_at: string | null
        }
        Insert: {
          id?: string
          listing_id: string
          version_no: number
          snapshot_json: Json
          status?: Database['public']['Enums']['moderation_status']
          reviewer_id?: string | null
          reason?: string | null
          created_at?: string
          decided_at?: string | null
        }
        Update: {
          id?: string
          listing_id?: string
          version_no?: number
          snapshot_json?: Json
          status?: Database['public']['Enums']['moderation_status']
          reviewer_id?: string | null
          reason?: string | null
          created_at?: string
          decided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'vendor_listing_versions_listing_id_fkey'
            columns: ['listing_id']
            isOneToOne: false
            referencedRelation: 'vendor_listings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendor_listing_versions_reviewer_id_fkey'
            columns: ['reviewer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      vendor_listings: {
        Row: {
          id: string
          vendor_id: string
          status: Database['public']['Enums']['moderation_status']
          about: string | null
          experience_years: number | null
          languages: unknown[]
          policies_json: Json
          faqs_json: Json
          completion_score: number
          submitted_at: string | null
          published_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vendor_id: string
          status?: Database['public']['Enums']['moderation_status']
          about?: string | null
          experience_years?: number | null
          languages?: unknown[]
          policies_json?: Json
          faqs_json?: Json
          completion_score?: number
          submitted_at?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vendor_id?: string
          status?: Database['public']['Enums']['moderation_status']
          about?: string | null
          experience_years?: number | null
          languages?: unknown[]
          policies_json?: Json
          faqs_json?: Json
          completion_score?: number
          submitted_at?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'vendor_listings_vendor_id_fkey'
            columns: ['vendor_id']
            isOneToOne: true
            referencedRelation: 'vendors'
            referencedColumns: ['id']
          },
        ]
      }
      vendor_media: {
        Row: {
          id: string
          vendor_id: string
          listing_id: string | null
          type: string
          storage_path: string
          alt_text: string | null
          sort_order: number
          is_cover: boolean
          moderation_status: Database['public']['Enums']['moderation_status']
          width: number | null
          height: number | null
          size_bytes: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vendor_id: string
          listing_id?: string | null
          type?: string
          storage_path: string
          alt_text?: string | null
          sort_order?: number
          is_cover?: boolean
          moderation_status?: Database['public']['Enums']['moderation_status']
          width?: number | null
          height?: number | null
          size_bytes?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vendor_id?: string
          listing_id?: string | null
          type?: string
          storage_path?: string
          alt_text?: string | null
          sort_order?: number
          is_cover?: boolean
          moderation_status?: Database['public']['Enums']['moderation_status']
          width?: number | null
          height?: number | null
          size_bytes?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'vendor_media_listing_id_fkey'
            columns: ['listing_id']
            isOneToOne: false
            referencedRelation: 'vendor_listings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendor_media_vendor_id_fkey'
            columns: ['vendor_id']
            isOneToOne: true
            referencedRelation: 'vendors'
            referencedColumns: ['id']
          },
        ]
      }
      vendor_memberships: {
        Row: {
          id: string
          vendor_id: string
          user_id: string
          role: Database['public']['Enums']['vendor_role']
          status: Database['public']['Enums']['membership_status']
          invited_by: string | null
          invited_email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vendor_id: string
          user_id: string
          role?: Database['public']['Enums']['vendor_role']
          status?: Database['public']['Enums']['membership_status']
          invited_by?: string | null
          invited_email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vendor_id?: string
          user_id?: string
          role?: Database['public']['Enums']['vendor_role']
          status?: Database['public']['Enums']['membership_status']
          invited_by?: string | null
          invited_email?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'vendor_memberships_invited_by_fkey'
            columns: ['invited_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendor_memberships_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendor_memberships_vendor_id_fkey'
            columns: ['vendor_id']
            isOneToOne: false
            referencedRelation: 'vendors'
            referencedColumns: ['id']
          },
        ]
      }
      vendor_metrics_daily: {
        Row: {
          vendor_id: string
          date: string
          profile_views: number
          shortlist_adds: number
          enquiries: number
          messages: number
          booked_count: number
        }
        Insert: {
          vendor_id: string
          date: string
          profile_views?: number
          shortlist_adds?: number
          enquiries?: number
          messages?: number
          booked_count?: number
        }
        Update: {
          vendor_id?: string
          date?: string
          profile_views?: number
          shortlist_adds?: number
          enquiries?: number
          messages?: number
          booked_count?: number
        }
        Relationships: [
          {
            foreignKeyName: 'vendor_metrics_daily_vendor_id_fkey'
            columns: ['vendor_id']
            isOneToOne: false
            referencedRelation: 'vendors'
            referencedColumns: ['id']
          },
        ]
      }
      vendor_packages: {
        Row: {
          id: string
          vendor_id: string
          category_id: string | null
          name: string
          description: string | null
          price_type: Database['public']['Enums']['price_type']
          min_amount_minor: number | null
          max_amount_minor: number | null
          currency: string
          unit: string | null
          inclusions_json: Json
          exclusions_json: Json
          active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vendor_id: string
          category_id?: string | null
          name: string
          description?: string | null
          price_type?: Database['public']['Enums']['price_type']
          min_amount_minor?: number | null
          max_amount_minor?: number | null
          currency?: string
          unit?: string | null
          inclusions_json?: Json
          exclusions_json?: Json
          active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vendor_id?: string
          category_id?: string | null
          name?: string
          description?: string | null
          price_type?: Database['public']['Enums']['price_type']
          min_amount_minor?: number | null
          max_amount_minor?: number | null
          currency?: string
          unit?: string | null
          inclusions_json?: Json
          exclusions_json?: Json
          active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'vendor_packages_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendor_packages_vendor_id_fkey'
            columns: ['vendor_id']
            isOneToOne: false
            referencedRelation: 'vendors'
            referencedColumns: ['id']
          },
        ]
      }
      vendor_service_areas: {
        Row: {
          id: string
          vendor_id: string
          city_id: string
          area_id: string | null
          travel_available: boolean
        }
        Insert: {
          id?: string
          vendor_id: string
          city_id: string
          area_id?: string | null
          travel_available?: boolean
        }
        Update: {
          id?: string
          vendor_id?: string
          city_id?: string
          area_id?: string | null
          travel_available?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'vendor_service_areas_area_id_fkey'
            columns: ['area_id']
            isOneToOne: false
            referencedRelation: 'areas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendor_service_areas_city_id_fkey'
            columns: ['city_id']
            isOneToOne: false
            referencedRelation: 'cities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendor_service_areas_vendor_id_fkey'
            columns: ['vendor_id']
            isOneToOne: false
            referencedRelation: 'vendors'
            referencedColumns: ['id']
          },
        ]
      }
      vendor_verifications: {
        Row: {
          id: string
          vendor_id: string
          type: string
          status: Database['public']['Enums']['verification_status']
          submitted_at: string | null
          decided_at: string | null
          reviewer_id: string | null
          reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vendor_id: string
          type: string
          status?: Database['public']['Enums']['verification_status']
          submitted_at?: string | null
          decided_at?: string | null
          reviewer_id?: string | null
          reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vendor_id?: string
          type?: string
          status?: Database['public']['Enums']['verification_status']
          submitted_at?: string | null
          decided_at?: string | null
          reviewer_id?: string | null
          reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'vendor_verifications_reviewer_id_fkey'
            columns: ['reviewer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendor_verifications_vendor_id_fkey'
            columns: ['vendor_id']
            isOneToOne: false
            referencedRelation: 'vendors'
            referencedColumns: ['id']
          },
        ]
      }
      vendors: {
        Row: {
          id: string
          legal_name: string | null
          display_name: string
          slug: string
          owner_user_id: string
          status: Database['public']['Enums']['vendor_status']
          verification_status: Database['public']['Enums']['verification_status']
          primary_city_id: string | null
          email: string | null
          phone: string | null
          website: string | null
          founded_year: number | null
          plan_id: string | null
          suspended_reason: string | null
          rating_average: number
          rating_count: number
          response_score: number
          listing_quality: number
          plan_boost: number
          is_featured: boolean
          created_at: string
          updated_at: string
          published_at: string | null
          search_text: string | null
          search_tsv: unknown | null
        }
        Insert: {
          id?: string
          legal_name?: string | null
          display_name: string
          slug: string
          owner_user_id: string
          status?: Database['public']['Enums']['vendor_status']
          verification_status?: Database['public']['Enums']['verification_status']
          primary_city_id?: string | null
          email?: string | null
          phone?: string | null
          website?: string | null
          founded_year?: number | null
          plan_id?: string | null
          suspended_reason?: string | null
          rating_average?: number
          rating_count?: number
          response_score?: number
          listing_quality?: number
          plan_boost?: number
          is_featured?: boolean
          created_at?: string
          updated_at?: string
          published_at?: string | null
          search_text?: string | null
          search_tsv?: unknown | null
        }
        Update: {
          id?: string
          legal_name?: string | null
          display_name?: string
          slug?: string
          owner_user_id?: string
          status?: Database['public']['Enums']['vendor_status']
          verification_status?: Database['public']['Enums']['verification_status']
          primary_city_id?: string | null
          email?: string | null
          phone?: string | null
          website?: string | null
          founded_year?: number | null
          plan_id?: string | null
          suspended_reason?: string | null
          rating_average?: number
          rating_count?: number
          response_score?: number
          listing_quality?: number
          plan_boost?: number
          is_featured?: boolean
          created_at?: string
          updated_at?: string
          published_at?: string | null
          search_text?: string | null
          search_tsv?: unknown | null
        }
        Relationships: [
          {
            foreignKeyName: 'vendors_owner_user_id_fkey'
            columns: ['owner_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendors_plan_fk'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'plans'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendors_primary_city_id_fkey'
            columns: ['primary_city_id']
            isOneToOne: false
            referencedRelation: 'cities'
            referencedColumns: ['id']
          },
        ]
      }
      webhook_events: {
        Row: {
          id: string
          provider: string
          external_event_id: string
          type: string | null
          payload_hash: string | null
          status: string
          attempts: number
          error: string | null
          processed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          provider: string
          external_event_id: string
          type?: string | null
          payload_hash?: string | null
          status?: string
          attempts?: number
          error?: string | null
          processed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          provider?: string
          external_event_id?: string
          type?: string | null
          payload_hash?: string | null
          status?: string
          attempts?: number
          error?: string | null
          processed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      wedding_profiles: {
        Row: {
          id: string
          user_id: string
          display_label: string | null
          wedding_date: string | null
          flexible_month: string | null
          primary_city_id: string | null
          budget_min_minor: number | null
          budget_max_minor: number | null
          currency: string
          guest_count: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          display_label?: string | null
          wedding_date?: string | null
          flexible_month?: string | null
          primary_city_id?: string | null
          budget_min_minor?: number | null
          budget_max_minor?: number | null
          currency?: string
          guest_count?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          display_label?: string | null
          wedding_date?: string | null
          flexible_month?: string | null
          primary_city_id?: string | null
          budget_min_minor?: number | null
          budget_max_minor?: number | null
          currency?: string
          guest_count?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'wedding_profiles_primary_city_id_fkey'
            columns: ['primary_city_id']
            isOneToOne: false
            referencedRelation: 'cities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'wedding_profiles_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      wedding_required_categories: {
        Row: {
          wedding_profile_id: string
          category_id: string
          status: string
        }
        Insert: {
          wedding_profile_id: string
          category_id: string
          status?: string
        }
        Update: {
          wedding_profile_id?: string
          category_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'wedding_required_categories_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'wedding_required_categories_wedding_profile_id_fkey'
            columns: ['wedding_profile_id']
            isOneToOne: false
            referencedRelation: 'wedding_profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      public_vendor_availability: {
        Row: {
          vendor_id: string | null
          start_date: string | null
          end_date: string | null
          status: Database['public']['Enums']['availability_status'] | null
        }
        Relationships: []
      }
      public_vendors: {
        Row: {
          id: string | null
          display_name: string | null
          slug: string | null
          primary_city_id: string | null
          website: string | null
          founded_year: number | null
          verification_status: Database['public']['Enums']['verification_status'] | null
          rating_average: number | null
          rating_count: number | null
          is_featured: boolean | null
          published_at: string | null
          about: string | null
          experience_years: number | null
          languages: unknown[] | null
          policies_json: Json | null
          faqs_json: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access_enquiry: {
        Args: { [key: string]: unknown }
        Returns: unknown
      }
      handle_new_user: {
        Args: Record<string, never>
        Returns: unknown
      }
      has_admin_permission: {
        Args: { [key: string]: unknown }
        Returns: unknown
      }
      is_admin: {
        Args: Record<string, never>
        Returns: unknown
      }
      is_vendor_member: {
        Args: { [key: string]: unknown }
        Returns: unknown
      }
      refresh_vendor_rating: {
        Args: Record<string, never>
        Returns: unknown
      }
      refresh_vendor_search_text: {
        Args: { [key: string]: unknown }
        Returns: unknown
      }
      search_vendors: {
        Args: { [key: string]: unknown }
        Returns: unknown
      }
      set_updated_at: {
        Args: Record<string, never>
        Returns: unknown
      }
      slugify: {
        Args: { [key: string]: unknown }
        Returns: unknown
      }
      trg_refresh_vendor_search: {
        Args: Record<string, never>
        Returns: unknown
      }
      unaccent_fallback: {
        Args: { [key: string]: unknown }
        Returns: unknown
      }
      vendor_can: {
        Args: { [key: string]: unknown }
        Returns: unknown
      }
      vendor_role_of: {
        Args: { [key: string]: unknown }
        Returns: unknown
      }
    }
    Enums: {
      actor_type: 'customer' | 'vendor' | 'admin' | 'system'
      availability_status: 'available' | 'busy' | 'unavailable' | 'unknown'
      content_status: 'draft' | 'scheduled' | 'published' | 'archived'
      enquiry_status:
        | 'draft'
        | 'submitted'
        | 'delivered'
        | 'viewed'
        | 'contacted'
        | 'qualified'
        | 'quote_sent'
        | 'negotiating'
        | 'booked'
        | 'not_booked'
        | 'closed'
        | 'spam'
      membership_status: 'invited' | 'active' | 'revoked'
      moderation_status: 'draft' | 'pending' | 'approved' | 'rejected' | 'flagged' | 'archived'
      notification_channel: 'in_app' | 'email' | 'sms' | 'whatsapp'
      price_type: 'starting_at' | 'fixed' | 'range' | 'custom'
      profile_status: 'active' | 'suspended' | 'deactivated' | 'deleted'
      subscription_status: 'trialing' | 'active' | 'past_due' | 'paused' | 'cancelled' | 'expired'
      vendor_role:
        'vendor_owner' | 'vendor_manager' | 'vendor_sales' | 'vendor_editor' | 'vendor_viewer'
      vendor_status: 'draft' | 'pending_review' | 'active' | 'suspended' | 'rejected' | 'archived'
      verification_status: 'unverified' | 'pending' | 'verified' | 'rejected' | 'expired'
    }
    CompositeTypes: Record<string, never>
  }
}

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row']
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]
