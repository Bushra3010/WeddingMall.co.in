# Wedding Marketplace Platform — Product Requirements Document

**Document type:** Build-ready PRD and technical specification  
**Version:** 1.0  
**Date:** 30 July 2026  
**Target stack:** Next.js App Router, TypeScript, Vercel, Supabase  
**Primary readers:** Founder, product owner, UI/UX designer, Claude Code / development team  
**Working name:** `WeddingMall` (replace through one configuration value)

---

## 1. Product Summary

Build a responsive, SEO-first web marketplace where customers discover, compare, shortlist, enquire about, and review wedding vendors. Vendors create and manage business listings, packages, media, availability, enquiries, and subscriptions. Administrators approve vendors and content, manage taxonomies and locations, distribute and monitor leads, moderate reviews, manage plans/payments, publish editorial content, and view platform analytics.

The product is inspired by the operating model of large wedding-vendor discovery platforms, but must have its own brand, interface, copy, data, and implementation. Do not copy copyrighted design, text, images, vendor data, reviews, or proprietary workflows.

### 1.1 Product promise

For customers: “Find trusted wedding professionals, compare options, and plan confidently.”

For vendors: “Showcase your work, receive qualified enquiries, and grow your wedding business.”

For administrators: “Operate listings, leads, content, quality, and monetisation from one controlled workspace.”

### 1.2 Core actors

1. **Guest:** browses public pages and searches vendors without signing in.
2. **Customer:** manages wedding profile, shortlist, enquiries, conversations, reviews, and account.
3. **Vendor member:** manages one vendor business according to assigned membership role.
4. **Admin:** operates marketplace modules according to granular permissions.
5. **System:** performs notifications, lead events, moderation checks, reminders, analytics aggregation, and scheduled jobs.

### 1.3 MVP success definition

MVP is successful when:

- a guest can search by category and city and open an indexable vendor profile;
- a customer can sign in, shortlist vendors, and submit an enquiry;
- an approved vendor can publish a listing and manage received enquiries;
- an admin can approve vendors/listings, manage categories/cities, moderate reviews, and inspect leads;
- permissions are enforced in Supabase Row Level Security, not only in the UI;
- core pages meet SEO, accessibility, mobile usability, performance, and audit-log requirements;
- the system deploys reproducibly to Vercel with Supabase migrations and seed data.

---

## 2. Scope and Release Boundaries

### 2.1 MVP — build now

- Public marketing homepage
- Category and city discovery
- Vendor search, filters, sorting, pagination
- Public vendor profiles with portfolio, services, packages, FAQs, policies, reviews, and enquiry CTA
- Customer email/password and Google authentication
- Optional phone OTP behind a feature flag
- Customer wedding profile
- Shortlist/favourites
- Enquiry/request-for-quote flow
- Customer–vendor enquiry conversation thread
- Customer dashboard
- Vendor onboarding, verification submission, and approval
- Vendor dashboard, team members, listing editor, packages, media, service areas, availability, enquiries, notes, and basic analytics
- Admin dashboard and role-based operations
- Review creation after a qualifying interaction, moderation, and vendor response
- Configurable vendor subscription plans and manual/online payment records
- Email notifications; optional WhatsApp adapter interface without hard-coding a provider
- CMS for essential pages, FAQs, homepage sections, and blog
- SEO landing pages for category × city
- Consent, privacy, account deletion request, audit logs
- CSV export for authorised admin reports

### 2.2 Phase 2 — design for, do not build in MVP

- Full marketplace booking and escrow
- Split vendor payouts
- Customer payment milestones
- Coupons and complex tax invoices
- Native mobile apps
- Video calls
- AI wedding assistant
- Advanced vendor recommendation engine
- Automated KYC verification
- Multi-language content beyond architecture readiness
- Calendar sync with Google/Outlook
- Public vendor comparison matrix
- Budget planner, guest list, checklist, invitation manager
- Multi-city franchise administration

### 2.3 Explicit non-goals

- Do not scrape or import content from the reference website.
- Do not expose customer phone/email to a vendor before consent or lead assignment.
- Do not let vendors pay to alter review ratings.
- Do not store card details.
- Do not use the Supabase service-role key in browser code.
- Do not implement one shared “role” field as the only authorisation mechanism.
- Do not create separate apps/repositories for customer, vendor, and admin in MVP.

---

## 3. Product Decisions

| Area | Decision |
|---|---|
| Application model | One Next.js application with route groups for public, customer, vendor, and admin experiences |
| Tenant model | Vendor businesses are organisations; users join through `vendor_memberships` |
| Authentication | Supabase Auth with SSR cookie sessions |
| Authorisation | Database RLS plus server-side permission checks; UI checks are convenience only |
| Public content | Server-rendered and indexable |
| Search | PostgreSQL full-text/trigram search for MVP; adapter boundary for future external search |
| Enquiry model | One enquiry targets one vendor; multi-vendor RFQ creates a parent request and separate child enquiries |
| Communication | Thread attached to enquiry; no general unsolicited direct messaging |
| Booking | Enquiry status can reach `booked`; money movement is out of MVP |
| Reviews | Only authenticated customers with an eligible enquiry; admin moderation required/configurable |
| Media | Supabase Storage with public transformed assets and private verification documents |
| Payments | Provider adapter; Stripe/Razorpay selection is configuration and legal-availability dependent |
| Deployment | Vercel for Next.js; Supabase for database/auth/storage/realtime |
| Analytics | First-party event table plus optional PostHog/GA adapter |
| Money | Store integer minor units and ISO currency code |
| Time | Store UTC; display in user/vendor timezone; default `Asia/Kolkata` |

---

## 4. Users, Jobs, and Permissions

### 4.1 Customer jobs

- Explore vendors by wedding need, city, price, rating, and service attributes.
- Save candidates without losing progress.
- Share enough requirements once and contact suitable vendors.
- Track replies and decision status.
- Trust that listing claims and reviews are moderated.
- Submit a review and control personal data.

### 4.2 Vendor jobs

- Register a business and submit proof for verification.
- Build a high-quality listing and publish only after approval.
- Define services, packages, prices, service areas, and availability.
- Receive, qualify, assign, respond to, and close enquiries.
- Invite team members with limited access.
- Understand listing views, enquiries, response time, and conversion.
- Buy or renew a plan without losing historical data.

### 4.3 Admin jobs

- Maintain categories, filters, locations, plans, content, and homepage merchandising.
- Review and approve vendor identity and listing changes.
- Detect duplicates, spam, abusive content, and misleading claims.
- Inspect every lead lifecycle event and resolve disputes.
- Moderate reviews and vendor responses.
- Track marketplace supply, demand, quality, and revenue.
- Perform controlled support actions with an immutable audit trail.

### 4.4 Role and permission model

System roles:

- `customer`
- `vendor_member`
- `admin`

Vendor membership roles:

- `vendor_owner`: all vendor operations, billing, team, and deletion request
- `vendor_manager`: listing, packages, enquiries, team except owner transfer/billing
- `vendor_sales`: enquiries, conversation, notes, status
- `vendor_editor`: listing, media, packages; no lead PII until assigned
- `vendor_viewer`: read-only analytics and non-sensitive listing data

Admin roles:

- `super_admin`
- `operations_admin`
- `vendor_verifier`
- `content_admin`
- `support_agent`
- `finance_admin`
- `analyst`

Use a permission catalogue rather than conditionals scattered across components. Example permissions:

`vendor.read`, `vendor.verify`, `vendor.suspend`, `listing.moderate`, `lead.read`, `lead.assign`, `lead.export`, `review.moderate`, `cms.publish`, `billing.manage`, `user.support`, `analytics.read`, `admin.manage`.

---

## 5. Information Architecture and Routes

### 5.1 Public routes

```text
/
/vendors
/vendors/[categorySlug]
/vendors/[categorySlug]/[citySlug]
/vendor/[vendorSlug]
/cities
/categories
/compare                         (Phase 2 flag)
/planning-tools                 (Phase 2)
/blog
/blog/[slug]
/about
/contact
/help
/privacy
/terms
/vendor/join
/auth/sign-in
/auth/sign-up
/auth/callback
```

### 5.2 Customer routes

```text
/account
/account/wedding
/account/shortlist
/account/enquiries
/account/enquiries/[enquiryId]
/account/reviews
/account/notifications
/account/settings
/account/privacy
```

### 5.3 Vendor routes

```text
/vendor-dashboard
/vendor-dashboard/onboarding
/vendor-dashboard/profile
/vendor-dashboard/listing
/vendor-dashboard/services
/vendor-dashboard/packages
/vendor-dashboard/portfolio
/vendor-dashboard/availability
/vendor-dashboard/enquiries
/vendor-dashboard/enquiries/[enquiryId]
/vendor-dashboard/team
/vendor-dashboard/analytics
/vendor-dashboard/plan
/vendor-dashboard/settings
```

### 5.4 Admin routes

```text
/admin
/admin/vendors
/admin/vendors/[vendorId]
/admin/verifications
/admin/listings
/admin/leads
/admin/leads/[enquiryId]
/admin/customers
/admin/reviews
/admin/categories
/admin/attributes
/admin/locations
/admin/plans
/admin/payments
/admin/content
/admin/blog
/admin/reports
/admin/audit-log
/admin/settings
/admin/admin-users
```

---

## 6. Functional Requirements

## 6.1 Public homepage

Required sections:

1. Header with logo, vendor navigation, city selector, search, sign-in, and “List your business”.
2. Hero with category/keyword and city search.
3. Popular categories controlled by admin.
4. Featured vendors controlled by rules and admin pinning.
5. Popular city links.
6. “How it works” for customers.
7. Trust section: verification explanation, genuine-review policy, support.
8. Testimonials managed by admin.
9. Vendor acquisition section.
10. Recent editorial content.
11. SEO footer with category and city links.

Acceptance:

- hero search creates a canonical search URL;
- no layout shift from images;
- content sections can be hidden/reordered by admin configuration;
- all meaningful controls are keyboard accessible;
- no unverifiable numerical claim is hard-coded.

## 6.2 Search and discovery

Search inputs:

- category
- free-text keyword
- city/area
- event date (optional)
- budget range
- rating
- verified only
- price type/category-specific filters
- service areas
- availability indicator

Sort:

- recommended
- rating
- most reviewed
- price low to high
- price high to low
- newest

Recommended ranking for MVP:

```text
rank_score =
  0.30 * text_relevance +
  0.20 * listing_quality +
  0.15 * rating_confidence +
  0.15 * response_score +
  0.10 * freshness +
  0.10 * plan_boost
```

Rules:

- paid boost may change visibility but never rating;
- sponsored results must be labelled;
- admin suspension overrides all ranking;
- unavailable/expired listings are excluded;
- filters live in URL query parameters;
- use cursor pagination internally where practical; canonical pages may expose numbered pagination;
- empty states suggest nearby cities/categories without inventing results.

Category-specific filters must be data-driven through attribute definitions. Example:

- Venues: capacity, rooms, venue type, catering policy, parking.
- Photographers: starting price, deliverables, travel, style.
- Makeup: price per function, travel, trial availability.
- Caterers: price per plate, cuisine, minimum guests.

## 6.3 Vendor public profile

Sections:

- business name, category, location, verification badge, rating summary;
- cover and gallery;
- “about” and years in business;
- services and category attributes;
- packages and starting-price label;
- service areas;
- availability signal;
- policies, FAQs, and languages;
- review list and rating distribution;
- vendor response to reviews;
- similar vendors;
- sticky shortlist and enquiry actions.

Rules:

- vendor contact PII is hidden until allowed by platform policy;
- every published change has moderation state;
- the public page only reads approved/published snapshot data;
- rating is computed from approved reviews only;
- never show an exact availability guarantee unless confirmed by vendor;
- structured data must reflect visible information.

## 6.4 Authentication and onboarding

Customer:

- email/password;
- Google OAuth;
- email verification;
- password reset;
- optional phone verification;
- acceptance of terms and privacy version.

Vendor:

- account creation;
- business details;
- primary category and additional categories;
- city, address, service areas;
- owner/contact details;
- tax/legal identifiers where relevant;
- verification document upload;
- portfolio and package setup;
- completion score;
- submit for review.

Admin:

- no public admin sign-up;
- invitation only;
- MFA required for privileged roles;
- session revocation and access audit.

## 6.5 Customer dashboard

Wedding profile:

- partner names/display label (optional);
- wedding date or flexible month;
- primary city and additional event cities;
- estimated budget range;
- guest count;
- required categories;
- preferences and notes;
- profile completeness.

Shortlist:

- add/remove;
- optional private note;
- group by category;
- compare later flag;
- retain across sessions.

Enquiries:

- list/search/filter by category and status;
- detail timeline;
- messages and attachments;
- customer can close, reopen when allowed, mark booked, report issue;
- customer controls whether contact details can be shared.

Settings:

- profile and notification preferences;
- download personal data request;
- deactivate/delete request;
- consent history.

## 6.6 Enquiry and lead lifecycle

Enquiry form:

- vendor target;
- category;
- event date/flexible date;
- city/venue area;
- budget range;
- guest count where relevant;
- service-specific answers;
- message;
- preferred contact mode;
- explicit contact-sharing consent;
- CAPTCHA/rate limit for risky traffic.

Statuses:

```text
draft -> submitted -> delivered -> viewed -> contacted
      -> qualified -> quote_sent -> negotiating -> booked
      -> not_booked | closed | spam
```

Rules:

- state transitions are validated server-side;
- every transition writes `enquiry_events`;
- customer and vendor see friendly labels; internal reason codes remain private;
- vendor may add internal notes not visible to customer;
- admin may reassign/close with required reason;
- PII reveal creates an audit event;
- duplicate enquiries within a configurable window trigger a warning;
- no lead is deleted from operational history; use retention/anonymisation rules.

Response SLA:

- first-response timer starts at `delivered`;
- vendor dashboard highlights overdue leads;
- notifications at configurable intervals;
- scheduled job records delivery attempts and failures.

## 6.7 Messaging

- one thread per enquiry;
- plain text plus safe attachments;
- read state;
- notification fan-out;
- vendor/customer cannot add arbitrary third parties;
- block executable attachments;
- sanitise content;
- rate limit and abuse reporting;
- optionally use Supabase Realtime for new-message UI, with polling fallback;
- Realtime channel access must be private and membership-authorised.

## 6.8 Reviews

Eligibility:

- authenticated customer;
- eligible enquiry relationship;
- one review per enquiry/vendor combination;
- configurable minimum lifecycle state.

Review fields:

- overall rating 1–5;
- optional sub-ratings;
- title and body;
- event date/month;
- photos;
- verification signal;
- moderation state.

Workflow:

`draft -> pending -> approved | rejected | flagged -> archived`

Vendor may post one public response. Customer may edit within a configured window, creating a revision history. Admin moderation requires a reason. Rating aggregates update only after approval.

## 6.9 Vendor dashboard

Overview:

- profile completion;
- verification and publication status;
- current plan;
- new/overdue enquiries;
- 30-day views, shortlist adds, enquiries, response rate;
- next recommended action.

Listing editor:

- autosave draft;
- section-level validation;
- preview;
- submit changes for review;
- preserve currently published version until update approval;
- completion score uses configurable weighted fields.

Portfolio:

- multi-upload;
- client-side compression only as convenience; enforce server/storage limits;
- alt text;
- ordering;
- cover selection;
- moderation state;
- deletion does not break published snapshot unexpectedly.

Packages:

- name, description, inclusions/exclusions;
- starting/fixed/range/custom price;
- currency;
- unit;
- category;
- active flag;
- order.

Availability:

- mark unavailable/busy/available/unknown;
- date/range;
- internal note;
- public profile shows only an appropriate signal.

Enquiry CRM:

- pipeline view and table view;
- filters, search, status, assignee;
- conversation;
- internal notes;
- follow-up date;
- quote amount metadata;
- lost reason;
- export according to plan/permission;
- customer PII visible only when policy allows.

Team:

- invite by email;
- membership roles;
- pending/accepted/revoked;
- owner cannot remove themselves without ownership transfer;
- all sensitive membership changes audited.

## 6.10 Vendor plans and billing

Plan model supports:

- monthly/yearly billing;
- listing count;
- category count;
- media limits;
- lead quota or fair-use rule;
- analytics level;
- featured placement allowance;
- team size;
- export permission;
- status and effective dates.

Subscription states:

`trialing`, `active`, `past_due`, `paused`, `cancelled`, `expired`.

MVP may use manual payment confirmation plus one provider adapter. Webhooks are authoritative for online payment state. Every webhook must be signature-verified and idempotent. Plan expiry never deletes vendor data; it limits features and public visibility based on policy.

## 6.11 Admin panel

Dashboard:

- new customers/vendors;
- pending verification/listing/review queues;
- enquiries by status;
- response SLA;
- published supply by city/category;
- subscription summary;
- safety/moderation alerts.

Vendor operations:

- search/filter;
- inspect account, memberships, listing, documents, activity;
- approve/reject/request changes;
- suspend/reactivate with reason;
- merge duplicate candidates through controlled workflow;
- impersonation is not in MVP; “view as” must not create a user session.

Lead operations:

- full timeline;
- delivery status;
- consent and PII audit;
- assign support owner;
- mark spam/duplicate;
- export with permission and reason;
- never silently edit customer messages.

Taxonomy:

- categories and subcategories;
- category attributes and allowed options;
- cities, states, areas, coordinates, aliases;
- SEO titles/descriptions/templates;
- safely redirect changed slugs.

CMS:

- draft/scheduled/published/archived;
- pages, blog posts, FAQs, testimonials, homepage collections;
- metadata, canonical URL, open graph image;
- author and revision history.

Reports:

- date filters;
- CSV export;
- aggregate analytics by city/category/vendor plan;
- PII-minimised exports by default.

## 6.12 Notifications

Channels:

- in-app;
- email;
- optional SMS/WhatsApp adapters.

Events include:

- account verification/reset;
- vendor invitation;
- verification/listing decision;
- new enquiry;
- new message;
- enquiry reminder;
- review decision/response;
- plan activation/expiry;
- security notification.

Requirements:

- preference centre;
- transactional messages cannot be disabled when legally/operationally required;
- template versioning;
- delivery log with provider message ID, attempt count, status, and error;
- retries use exponential backoff with maximum attempts;
- marketing consent is separate from transactional communication.

---

## 7. UX and Design Requirements

### 7.1 Design direction

- Premium Indian wedding aesthetic without visual clutter.
- Warm neutral base, one deep brand colour, one restrained accent.
- Original interface; do not imitate the reference site pixel-for-pixel.
- Mobile-first public/customer journeys; desktop-optimised vendor/admin tables.
- Reusable design tokens through CSS variables.
- Use shadcn/ui primitives where suitable, customised to brand.

### 7.2 Required states

Every data component must specify:

- loading/skeleton;
- empty;
- partial;
- validation;
- permission denied;
- offline/retry;
- success confirmation;
- destructive confirmation.

### 7.3 Accessibility

- WCAG 2.2 AA target;
- semantic headings and landmarks;
- keyboard operation;
- visible focus;
- labels and errors associated with fields;
- colour contrast;
- reduced-motion support;
- alt text workflow;
- accessible dialogs, menus, tables, and pagination.

### 7.4 Responsive breakpoints

Use content-led CSS breakpoints; initial tokens:

- small: 640 px
- medium: 768 px
- large: 1024 px
- extra-large: 1280 px

Do not hide critical actions on mobile. Tables switch to cards or horizontal scroll with pinned primary field.

---

## 8. Technical Architecture

## 8.1 Stack

| Layer | Choice |
|---|---|
| Framework | Next.js App Router with TypeScript, current stable version at build start |
| UI | React, Tailwind CSS, shadcn/ui, Lucide icons |
| Forms | React Hook Form + Zod |
| Backend | Next.js Server Functions/Actions and Route Handlers |
| Database | Supabase Postgres |
| Auth | Supabase Auth with SSR cookie sessions and PKCE |
| Storage | Supabase Storage |
| Realtime | Supabase Realtime only for enquiry messages/notifications where useful |
| Hosting | Vercel |
| Email | Provider adapter (Resend recommended default) |
| Payments | Provider adapter (Razorpay or Stripe subject to business/legal eligibility) |
| Monitoring | Sentry adapter plus Vercel logs |
| Analytics | First-party events, optional PostHog/GA |
| Tests | Vitest, React Testing Library, Playwright |

### 8.2 Application structure

```text
src/
  app/
    (public)/
    (auth)/
    (customer)/
    vendor-dashboard/
    admin/
    api/
  components/
    ui/
    shared/
    public/
    customer/
    vendor/
    admin/
  features/
    auth/
    vendors/
    listings/
    search/
    enquiries/
    messaging/
    reviews/
    billing/
    cms/
    notifications/
  lib/
    supabase/
    auth/
    permissions/
    validation/
    money/
    dates/
    seo/
    observability/
  server/
    dal/
    services/
    policies/
    jobs/
  types/
supabase/
  migrations/
  seed.sql
  tests/
public/
tests/
  e2e/
docs/
```

### 8.3 Rendering rules

- Public discovery pages: Server Components, cached where safe, revalidated after moderation/publishing.
- Authenticated dashboards: dynamic server rendering.
- Client Components only for interactive widgets.
- Mutations use Server Actions for UI-bound flows and Route Handlers for webhooks/external integrations.
- Never trust request form fields for role, owner, vendor ID, price totals, or status transitions.
- Create a Data Access Layer; do not query Supabase independently inside random UI components.

### 8.4 Environment variables

```text
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
CRON_SECRET
EMAIL_PROVIDER_API_KEY
EMAIL_FROM
PAYMENT_PROVIDER
PAYMENT_WEBHOOK_SECRET
SENTRY_DSN
NEXT_PUBLIC_ANALYTICS_KEY
FEATURE_PHONE_AUTH
FEATURE_ONLINE_PAYMENTS
FEATURE_REALTIME_CHAT
```

Secrets exist only in server runtime. Validate environment variables at startup. Maintain `.env.example` without real secrets.

---

## 9. Data Model

General rules:

- UUID primary keys.
- `created_at`, `updated_at`; add `deleted_at` only when soft deletion is justified.
- Store money as `amount_minor bigint` plus `currency char(3)`.
- Use database constraints for enums/invariants where stable.
- Add `created_by`/`updated_by` to controlled content where relevant.
- Public slugs are unique, lowercase, stable, and backed by redirect history.
- Enable RLS on every exposed table.

### 9.1 Identity and permissions

| Table | Key fields |
|---|---|
| `profiles` | `id -> auth.users`, name, avatar, phone, phone_verified_at, locale, timezone, status |
| `user_consents` | user_id, consent_type, policy_version, granted, source, timestamp |
| `admin_roles` | id, code, name |
| `admin_permissions` | id, code |
| `admin_role_permissions` | role_id, permission_id |
| `admin_memberships` | user_id, role_id, status, invited_by |

### 9.2 Location and taxonomy

| Table | Key fields |
|---|---|
| `countries` | id, code, name, active |
| `states` | id, country_id, name, slug |
| `cities` | id, state_id, name, slug, latitude, longitude, timezone, active |
| `areas` | id, city_id, name, slug, latitude, longitude |
| `categories` | id, parent_id, name, slug, icon, description, active, sort_order |
| `category_attributes` | id, category_id, code, label, input_type, data_type, unit, filterable, required, options_json, validation_json |

### 9.3 Vendor domain

| Table | Key fields |
|---|---|
| `vendors` | id, legal_name, display_name, slug, owner_user_id, status, verification_status, primary_city_id, email, phone, website, founded_year, plan_id |
| `vendor_memberships` | vendor_id, user_id, role, status, invited_by |
| `vendor_categories` | vendor_id, category_id, is_primary |
| `vendor_service_areas` | vendor_id, city_id, area_id, travel_available |
| `vendor_addresses` | vendor_id, type, line fields, city_id, postal_code, coordinates, public_visibility |
| `vendor_verifications` | vendor_id, type, status, submitted_at, decided_at, reviewer_id, reason |
| `vendor_documents` | verification_id, storage_path, document_type, hash, expiry_date |
| `vendor_listings` | id, vendor_id, status, about, experience_years, languages, policies_json, faqs_json, submitted_at, published_at |
| `vendor_listing_versions` | listing_id, version_no, snapshot_json, status, reviewer_id, reason |
| `vendor_attribute_values` | vendor_id, category_attribute_id, value_json |
| `vendor_media` | vendor_id, listing_id, type, storage_path, alt_text, sort_order, moderation_status, width, height |
| `vendor_packages` | vendor_id, category_id, name, description, price_type, min_amount_minor, max_amount_minor, currency, unit, inclusions_json, exclusions_json, active, sort_order |
| `vendor_availability` | vendor_id, start_date, end_date, status, note_private |
| `vendor_metrics_daily` | vendor_id, date, profile_views, shortlist_adds, enquiries, messages, booked_count |
| `slug_redirects` | entity_type, entity_id, old_slug, new_slug, status_code |

### 9.4 Customer and marketplace domain

| Table | Key fields |
|---|---|
| `wedding_profiles` | user_id, display_label, wedding_date, flexible_month, primary_city_id, budget_min_minor, budget_max_minor, currency, guest_count, notes |
| `wedding_required_categories` | wedding_profile_id, category_id, status |
| `shortlists` | user_id, vendor_id, note, created_at |
| `rfq_requests` | id, customer_id, category_id, city_id, requirements_json, status |
| `enquiries` | id, rfq_id, customer_id, vendor_id, category_id, event_date, flexible_date, city_id, budget fields, guest_count, requirements_json, message, status, contact_consent, assigned_vendor_member_id, first_response_at |
| `enquiry_events` | enquiry_id, actor_user_id, actor_type, event_type, from_status, to_status, metadata_json |
| `enquiry_notes` | enquiry_id, vendor_id, author_user_id, note, follow_up_at |
| `conversations` | enquiry_id, status |
| `messages` | conversation_id, sender_user_id, body, status, read_at |
| `message_attachments` | message_id, storage_path, mime_type, size_bytes, scan_status |
| `reviews` | enquiry_id, customer_id, vendor_id, overall_rating, subratings_json, title, body, event_date, status, moderation_reason |
| `review_media` | review_id, storage_path, moderation_status |
| `review_responses` | review_id, vendor_id, author_user_id, body, status |

### 9.5 Billing, content, operations

| Table | Key fields |
|---|---|
| `plans` | code, name, billing_interval, amount_minor, currency, entitlements_json, active |
| `subscriptions` | vendor_id, plan_id, provider, provider_customer_id, provider_subscription_id, status, period_start, period_end, cancel_at_period_end |
| `payments` | vendor_id, subscription_id, provider_payment_id, amount_minor, currency, status, paid_at, metadata_json |
| `webhook_events` | provider, external_event_id, type, payload_hash, status, attempts, processed_at |
| `notification_templates` | code, channel, locale, subject, body, version, active |
| `notifications` | user_id, code, channel, payload_json, status, scheduled_at, sent_at, provider_message_id, attempts, error |
| `notification_preferences` | user_id, channel, notification_group, enabled |
| `pages` | slug, title, body, status, SEO fields, published_at |
| `posts` | slug, title, excerpt, body, cover_path, author_id, category, status, SEO fields, published_at |
| `faqs` | scope, scope_id, question, answer, active, sort_order |
| `homepage_sections` | code, title, config_json, active, sort_order |
| `support_tickets` | user_id, vendor_id, enquiry_id, type, priority, status, assigned_admin_id |
| `audit_logs` | actor_user_id, actor_type, action, entity_type, entity_id, before_json, after_json, ip_hash, request_id, created_at |
| `analytics_events` | anonymous_id, user_id, session_id, name, entity_type, entity_id, properties_json, occurred_at |
| `data_requests` | user_id, type, status, requested_at, completed_at |

### 9.6 Critical indexes

- vendor listing: `(status, published_at)`, `(vendor_id)`;
- vendor discovery: `(primary_city_id, status)`, category join indexes;
- trigram indexes on vendor display name and searchable listing text;
- enquiry: `(vendor_id, created_at desc)`, `(customer_id, created_at desc)`, `(status, created_at)`;
- message: `(conversation_id, created_at)`;
- reviews: `(vendor_id, status, created_at desc)`;
- notification: `(status, scheduled_at)`;
- audit: `(entity_type, entity_id, created_at desc)`;
- unique: shortlist `(user_id, vendor_id)`, membership `(vendor_id, user_id)`, review `(enquiry_id, customer_id)`, webhook `(provider, external_event_id)`.

---

## 10. Security and RLS Requirements

### 10.1 Principles

- deny by default;
- public reads use views/functions exposing only approved fields;
- browser never receives secret/service credentials;
- service-role access is isolated to trusted server jobs and webhooks;
- server actions re-check authentication, permission, ownership, input, and transition;
- sensitive documents use private buckets and short-lived signed URLs;
- logs must not contain access tokens, full document numbers, or unnecessary PII.

### 10.2 RLS matrix

| Resource | Guest | Customer | Vendor member | Admin |
|---|---|---|---|---|
| Published vendor view | Read | Read | Read | Read |
| Vendor draft | None | None | Own vendor by membership | Permission |
| Customer profile | None | Own | None | Support permission, restricted |
| Shortlist | None | Own CRUD | None | No default access |
| Enquiry | None | Own read/create/update allowed fields | Assigned/own vendor read/update allowed fields | Lead permission |
| Messages | None | Own enquiry thread | Own vendor enquiry thread | Support permission |
| Vendor notes | None | None | Own vendor | Lead permission |
| Review | Read approved | Own create/edit window | Read approved/respond | Moderate |
| Verification docs | None | None | Owner/manager limited | Verification permission |
| Audit logs | None | None | None | Audit permission |

### 10.3 Required safeguards

- Zod validation on every mutation boundary.
- Rate limits on auth, search abuse, enquiry, messages, reviews, uploads, and contact forms.
- CAPTCHA triggered by risk, not necessarily every request.
- CSRF/origin protection for mutations.
- MIME/type/size validation and malware-scan status for private attachments.
- Security headers: CSP, HSTS, frame restrictions, referrer policy, permissions policy.
- Idempotency keys for enquiry submission and payments.
- Audit all admin decisions, PII reveals, exports, role changes, suspensions, and billing overrides.
- Admin MFA and short privileged session policy.

---

## 11. Search, SEO, and Content

### 11.1 SEO pages

Index:

- category page;
- category × city page;
- vendor public profile;
- blog post;
- curated landing page with substantial unique content.

Noindex:

- dashboards and auth;
- internal search combinations with thin/duplicate content;
- preview/draft;
- empty pagination;
- private enquiry URLs.

### 11.2 SEO requirements

- dynamic metadata;
- canonical URLs;
- XML sitemap split by content type;
- robots.txt;
- breadcrumb schema;
- LocalBusiness/ProfessionalService schema where accurate;
- AggregateRating only when approved reviews are visible and compliant;
- clean 301 redirects for slug changes;
- descriptive image alt text;
- Open Graph/Twitter images;
- category/city pages require editable unique intro and FAQ content;
- do not generate thousands of thin pages automatically.

### 11.3 Search implementation

Create a database function such as `search_vendors(filters jsonb, cursor text)` returning only approved public data plus calculated rank. Keep its return contract stable so a future Typesense/Meilisearch/Algolia adapter can replace its internals.

---

## 12. Integrations and Background Jobs

### 12.1 Integration adapters

```ts
interface EmailProvider {
  send(input: EmailMessage): Promise<DeliveryResult>
}

interface MessagingProvider {
  sendTemplate(input: TemplateMessage): Promise<DeliveryResult>
}

interface PaymentProvider {
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>
  verifyWebhook(rawBody: string, signature: string): VerifiedEvent
}
```

No vendor-specific API calls outside adapter modules.

### 12.2 Scheduled jobs

- send due notifications;
- enquiry SLA reminders;
- expire trials/subscriptions;
- recompute daily vendor metrics;
- clean abandoned private uploads;
- publish scheduled CMS content;
- process data export/deletion queue;
- health check for failed webhook/notification events.

Vercel Cron calls protected Route Handlers using `CRON_SECRET`. Jobs must be idempotent, bounded, observable, and safe to retry.

---

## 13. Analytics and KPIs

### 13.1 North-star metric

**Qualified vendor connections per month:** enquiries that reach `qualified`, `quote_sent`, `negotiating`, or `booked`, excluding spam/duplicates.

### 13.2 Marketplace KPIs

- search-to-profile-view rate;
- profile-view-to-enquiry rate;
- enquiry delivery and vendor view rate;
- median first-response time;
- qualified lead rate;
- booking-marked rate;
- active vendors by category/city;
- listing completion and approval rate;
- customer repeat session rate;
- review submission and approval rate;
- subscription MRR/ARR where applicable;
- churn and renewal;
- moderation rejection and abuse rate.

### 13.3 Event names

`search_submitted`, `filter_applied`, `vendor_viewed`, `vendor_shortlisted`, `enquiry_started`, `enquiry_submitted`, `enquiry_status_changed`, `message_sent`, `review_submitted`, `vendor_onboarding_started`, `vendor_submitted_for_review`, `vendor_published`, `plan_checkout_started`, `subscription_activated`.

Events contain IDs and coarse attributes; avoid unnecessary PII.

---

## 14. Non-Functional Requirements

### 14.1 Performance

- Lighthouse target on key public mobile pages: Performance ≥ 85; Accessibility, Best Practices, SEO ≥ 90.
- Core Web Vitals target: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at 75th percentile where measurable.
- Responsive images with explicit dimensions and modern formats.
- Public HTML useful without client JavaScript.
- Search p95 target ≤ 800 ms under agreed MVP data volume.
- Dashboard table queries use pagination and indexed filters.

### 14.2 Reliability

- error boundaries for route groups;
- retry-safe jobs and webhooks;
- database migrations are versioned and reversible where practical;
- backups and recovery procedure documented;
- graceful provider outage handling;
- no notification failure may roll back the underlying successful business transaction.

### 14.3 Privacy and compliance

- explicit consent records and policy versions;
- purpose limitation and role-based PII access;
- data export and deletion workflow;
- configurable retention schedule;
- cookie consent for non-essential analytics;
- legal text reviewed by qualified counsel before launch;
- payment/tax/KYC requirements validated for target jurisdictions.

### 14.4 Observability

- request/correlation ID;
- structured server logs;
- error monitoring;
- webhook and notification dashboards;
- slow-query logging;
- alerts for auth spikes, job failures, elevated 5xx, and payment webhook failures.

---

## 15. API and Server Contract Catalogue

Prefer typed server services. Route Handlers are required for webhooks, cron, public integration endpoints, and signed upload helpers.

| Operation | Auth | Main validation |
|---|---|---|
| `searchVendors` | Public | filter allowlist, pagination bounds |
| `getPublicVendor` | Public | published snapshot only |
| `toggleShortlist` | Customer | own user, active vendor |
| `submitEnquiry` | Customer/verified guest flow | consent, rate limit, active vendor, idempotency |
| `sendMessage` | Thread participant | enquiry membership, size, content |
| `transitionEnquiry` | Participant/admin | transition map + field allowlist |
| `submitReview` | Customer | eligible enquiry, uniqueness |
| `saveVendorDraft` | Vendor editor+ | membership, section schema |
| `submitVendorForReview` | Vendor manager+ | completion threshold |
| `moderateListing` | Admin permission | decision reason, audit |
| `inviteVendorMember` | Vendor manager+ | role ceiling, plan entitlement |
| `createCheckout` | Vendor owner | plan, currency, current subscription |
| `paymentWebhook` | Provider | signature + idempotency |
| `exportLeads` | Admin/export entitlement | permission, reason, audit |

Standard action result:

```ts
type ActionResult<T> =
  | { ok: true; data: T; requestId: string }
  | { ok: false; code: string; message: string; fieldErrors?: Record<string, string[]>; requestId: string }
```

Never return raw database/provider errors to users.

---

## 16. Acceptance Criteria by Epic

### Epic A — Foundation

- Next.js app runs locally and on Vercel preview.
- Supabase local/remote migration workflow documented.
- SSR authentication works after refresh and across protected routes.
- role redirects do not replace RLS.
- lint, typecheck, unit tests, and build pass in CI.

### Epic B — Discovery

- admin can create category/city;
- approved listing becomes searchable;
- search filters persist in URL;
- non-approved listing never appears publicly;
- vendor profile has canonical metadata and structured data.

### Epic C — Customer

- customer can create wedding profile;
- shortlist is unique and private;
- enquiry submission is idempotent;
- customer sees event timeline and messages;
- customer cannot read another customer’s data.

### Epic D — Vendor

- onboarding progress persists;
- private verification documents cannot be publicly accessed;
- admin decision controls publication;
- membership role limits UI and database operations;
- lead status changes create immutable events.

### Epic E — Admin

- each moderation action requires reason where specified;
- admin permissions are granular;
- exports and PII reveal are audited;
- super-admin role cannot be created through public input;
- dashboards tolerate empty datasets.

### Epic F — Billing

- checkout cannot select inactive plan;
- webhook signatures are verified;
- duplicate events do not duplicate payments/subscriptions;
- plan entitlement checks occur server-side;
- expired subscription preserves data.

### Epic G — Quality

- Playwright covers three critical journeys;
- accessibility scan has no serious/critical violations on key pages;
- security headers and error monitoring configured;
- seed data is fictional;
- production release checklist is complete.

---

## 17. Test Strategy

### 17.1 Unit tests

- validators;
- money/date helpers;
- ranking components;
- permission functions;
- status-transition map;
- entitlement checks;
- notification template rendering.

### 17.2 Database tests

- RLS isolation for customer/vendor/admin;
- public view excludes private fields;
- unique constraints;
- review eligibility;
- transition RPC;
- search function filters;
- aggregate update correctness.

### 17.3 Integration tests

- auth callback;
- enquiry creation + event + notification;
- listing submission + moderation + cache revalidation;
- payment webhook idempotency;
- media upload policy.

### 17.4 End-to-end critical journeys

1. Customer signs up → searches → opens vendor → shortlists → submits enquiry → sends message.
2. Vendor signs up → submits verification/listing → admin approves → listing becomes public → vendor handles lead.
3. Admin signs in with permission → moderates review → exports aggregate report → audit entries exist.

---

## 18. Delivery Plan

### Milestone 0 — Decisions and setup

- confirm brand, domain, initial cities/categories, currency, payment approach, review policy, contact reveal policy;
- initialise repository, CI, Supabase project, Vercel projects;
- create design tokens and architecture decision records.

### Milestone 1 — Foundation and auth

- app shell, Supabase clients, SSR session, profile trigger, roles/permissions, route protection, RLS test harness.

### Milestone 2 — Taxonomy and vendor onboarding

- locations/categories/attributes, vendor organisation, memberships, private documents, onboarding, admin verification.

### Milestone 3 — Listing and public discovery

- listing versions, media, packages, public views, search, category/city SEO pages, vendor profile.

### Milestone 4 — Customer marketplace

- wedding profile, shortlist, enquiry, timeline, messages, notifications.

### Milestone 5 — Vendor CRM and reviews

- pipeline, assignment, notes, SLA, analytics, review eligibility/moderation/response.

### Milestone 6 — Billing, CMS, reports

- plans, provider adapter, webhook handling, CMS, reporting, exports, audit controls.

### Milestone 7 — hardening and launch

- E2E, RLS/security review, accessibility, performance, observability, backup/recovery, seed cleanup, production deployment.

Rule: do not begin the next milestone until the current milestone’s acceptance tests pass.

---

## 19. Claude Code Operating Contract — Minimum Token Usage

Place this PRD at `/docs/PRD.md`. Give Claude Code only the current milestone and relevant files. Do not repeatedly paste this full PRD.

Create these small durable files:

```text
CLAUDE.md                 stable coding rules, commands, architecture
docs/PRD.md               this source of truth
docs/STATUS.md            completed/current/blocked/next, maximum 80 lines
docs/DECISIONS.md         short ADR log
docs/DB.md                schema/RLS summary generated from migrations
```

### 19.1 Stable `CLAUDE.md` instructions

```md
# Project Rules
- Read docs/STATUS.md first, then only the PRD section needed for the assigned milestone.
- Use Next.js App Router, TypeScript strict mode, Supabase, and server-first patterns.
- Keep business logic in src/server services/DAL; UI must not own authorisation.
- All exposed tables require RLS and RLS tests.
- Never expose Supabase secret/service credentials to the client.
- Use Zod at mutation boundaries and return ActionResult<T>.
- Prefer Server Components; add Client Components only for interaction.
- Use existing components and patterns before adding dependencies.
- Do not edit unrelated files or reformat the whole repository.
- Before finishing run the smallest relevant tests, then lint/typecheck/build when milestone scope requires it.
- Update docs/STATUS.md concisely: files changed, tests, remaining issue, exact next task.
- If requirements conflict or a security decision is ambiguous, stop and ask one focused question.
```

### 19.2 Token-saving workflow

1. Start a fresh Claude Code session per milestone or bounded task.
2. Ask it to inspect specific files, not the entire repository.
3. Require a brief plan of maximum 8 bullets.
4. Implement one vertical slice at a time.
5. Use migrations as database truth and generated types.
6. Store decisions in files, not in long chat history.
7. Use exact error output; do not paste full unrelated logs.
8. Ask for diffs and test results, not a narration of every step.
9. Compact/clear context after `STATUS.md` is updated.
10. Never ask “build the whole website”; use the milestone prompts below.

### 19.3 Prompt 0 — repository blueprint

```text
Read CLAUDE.md and docs/PRD.md sections 1–5, 8, 18, and 19 only.
Task: create the implementation blueprint, repo structure, dependency list, environment schema, and milestone checklist. Do not implement product features.
Constraints: maximum 8-step plan; current stable compatible packages; no unnecessary dependency.
Output: update docs/STATUS.md and docs/DECISIONS.md, then report decisions, changed files, and next command.
```

### 19.4 Prompt 1 — foundation

```text
Read CLAUDE.md, docs/STATUS.md, PRD 8, 9.1, 10, and Epic A.
Implement Milestone 1 only: Next.js shell, Supabase browser/server clients, SSR auth, profile creation, permission primitives, protected route groups, first migrations, RLS tests, env validation, and CI checks.
Do not build vendor/customer features.
Run relevant tests, typecheck, lint, and build. Update STATUS.md.
```

### 19.5 Prompt 2 — vendor onboarding

```text
Read CLAUDE.md, STATUS.md, PRD 4, 6.4, 6.9, 9.2–9.3, 10, and Epic D.
Implement Milestone 2 as one vertical slice: taxonomy admin seed/manage, vendor organisation and memberships, onboarding draft, private verification uploads, submission, and admin approve/request-change/reject.
Include migrations, RLS, typed services, UI states, tests, and audit events.
Stop after acceptance tests pass; update STATUS.md.
```

### 19.6 Prompt 3 — discovery

```text
Read CLAUDE.md, STATUS.md, PRD 5, 6.1–6.3, 8.3, 9.3, 11, and Epic B.
Implement Milestone 3: versioned listing editor, packages/media/service areas, moderation, published public view, search function, category/city pages, vendor profile, metadata, sitemap, and redirects.
Use fictional seed data. Do not copy reference-site content/design.
Test public/private separation and update STATUS.md.
```

### 19.7 Prompt 4 — customer and enquiry

```text
Read CLAUDE.md, STATUS.md, PRD 6.5–6.7, 9.4, 10, 12, and Epic C.
Implement Milestone 4: wedding profile, shortlist, enquiry idempotency, consent, lifecycle events, participant-authorised thread, messages, in-app/email notifications, and dashboards.
Add RLS and E2E journey 1. Update STATUS.md.
```

### 19.8 Prompt 5 — CRM and reviews

```text
Read CLAUDE.md, STATUS.md, PRD 6.6, 6.8–6.9, 13, and Epic D/G.
Implement Milestone 5: vendor enquiry pipeline, assignment, notes, follow-up, SLA jobs, metrics, eligible reviews, moderation, vendor response, and aggregate ratings.
Add transition tests, RLS tests, and E2E journey 2. Update STATUS.md.
```

### 19.9 Prompt 6 — billing, CMS, reports

```text
Read CLAUDE.md, STATUS.md, PRD 6.10–6.12, 9.5, 12, 15, and Epics E/F.
Implement Milestone 6: configurable plans/entitlements, payment adapter and idempotent webhook, subscription enforcement, CMS, notifications log, admin reports, permission-gated CSV export, and audit logging.
Use a mock payment adapter until provider credentials exist. Update STATUS.md.
```

### 19.10 Prompt 7 — launch hardening

```text
Read CLAUDE.md, STATUS.md, PRD 7, 10, 14, 17, and Epic G.
Perform Milestone 7 only: close critical test gaps, RLS/security review, accessibility, performance, error monitoring, cron protection, backup/recovery notes, production env checklist, and Vercel deployment verification.
Do not add new product scope. Update STATUS.md with launch blockers and evidence.
```

### 19.11 Bug-fix prompt template

```text
Read CLAUDE.md and STATUS.md. Inspect only: <files/routes>.
Bug: <expected vs actual>.
Evidence: <exact error/reproduction>.
Find root cause, make the smallest safe fix, add/update a regression test, run the narrow test plus typecheck for touched code, and update STATUS.md. Do not refactor unrelated code.
```

---

## 20. Launch Checklist

Product:

- initial categories/cities and fictional demo data approved;
- all primary empty/error/loading states reviewed;
- email templates and support contacts final;
- vendor/customer policies final;
- admin queue owners assigned.

Security:

- RLS test suite passes;
- admin MFA enabled;
- secrets rotated and environment-scoped;
- storage buckets/policies verified;
- rate limits/CAPTCHA configured;
- webhook signatures and idempotency verified;
- dependency/security scan reviewed.

Operations:

- backup and restore tested;
- alert destinations configured;
- cron jobs observed;
- failed notification/webhook retry procedure documented;
- moderation and support SOP ready;
- data retention/deletion process tested.

SEO/performance:

- canonical, sitemap, robots, redirects verified;
- structured data validates;
- no draft/private page indexed;
- key pages meet agreed performance budget;
- analytics events validated without PII leakage.

Deployment:

- preview and production environments separated;
- database migrations applied from CI/release process;
- domain, SSL, email DNS, redirect URLs configured;
- smoke test for customer, vendor, admin, webhook, and cron;
- rollback owner and procedure confirmed.

---

## 21. Decisions Required Before Coding

The product owner must answer these before their dependent milestone:

1. Final brand name, logo, colours, domain, and support contact.
2. Initial country, cities, and vendor categories.
3. Customer authentication methods and whether phone verification is mandatory.
4. When vendor contact PII is revealed.
5. Vendor verification documents required per category.
6. Review eligibility and moderation policy.
7. Free/paid vendor plans, prices, tax, trial, lead limits, and featured-placement policy.
8. Razorpay vs Stripe vs manual billing, based on the registered business and supported marketplace flow.
9. Whether WhatsApp is transactional only and which approved provider/template process will be used.
10. Data retention durations and legal entity named in privacy/terms.
11. Booking/payment scope for Phase 2.
12. Admin team roles and escalation owners.

Until decided, implement these as configuration or feature flags rather than assumptions.

---

## 22. Source and Implementation Notes

This PRD uses the public reference platform only to understand the category’s visible marketplace pattern: city/category vendor search, vendor categories, enquiries, reviews, customer trust, and vendor registration. The proposed product is an original implementation.

Technical choices follow official framework guidance:

- Next.js App Router with server-side mutation and data-security patterns.
- Supabase SSR authentication, Postgres, Row Level Security, Storage, and optional Realtime.
- Vercel deployment, environment variables, and protected cron execution.

At implementation start, pin mutually compatible current stable package versions and record them in `docs/DECISIONS.md`; do not hard-code package versions from this PRD.

