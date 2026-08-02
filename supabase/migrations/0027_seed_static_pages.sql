-- ---------------------------------------------------------------------------
-- 0027 — Static page content
--
-- `/privacy` and `/terms` held `PLACEHOLDER. This document must be drafted and
-- reviewed by qualified counsel` and sat in `draft`, so the footer linked to
-- two 404s. Both options available without a lawyer are bad:
--
--   * publish invented legalese — actively misleading, and the worst kind of
--     wrong because it looks authoritative;
--   * leave them 404ing — the site appears broken and users have no way to
--     find out what happens to their data.
--
-- Third option taken: a truthful plain-English description of what the system
-- actually does, opening with an explicit notice that it is not a
-- lawyer-reviewed policy. Everything below is verifiable in the code — consent
-- gating on contact release, the audit trail, review eligibility, and the
-- "Sponsored" label are all enforced in SQL.
--
-- **This does not clear the launch blocker.** Counsel still has to produce the
-- real documents; STATUS.md keeps it listed. What this removes is the 404 and
-- the silence, not the legal requirement.
-- ---------------------------------------------------------------------------

update public.pages
set
  title = 'Privacy',
  status = 'published',
  published_at = coalesce(published_at, now()),
  seo_description = 'What WeddingMall collects, who can see it, and how to get it removed.',
  body = $md$This is a plain-English description of how the site currently handles your information. It has not yet been reviewed by a lawyer and is not a substitute for the formal privacy policy, which is being prepared.

## What we hold

- Your account: email address, and a name and phone number if you add them.
- Your enquiries: the vendor you contacted, event date, city, budget range, guest count, and whatever you wrote.
- Your shortlist and any private notes you attach to it.
- Reviews you write, including any that are still awaiting moderation.

## Who can see it

Your shortlist and its notes are visible only to you. An enquiry is visible to you and to the vendor you sent it to.

Your name and phone number are not sent to a vendor when you enquire. They are released only when you consent, one enquiry at a time, and each release is recorded in an internal audit log along with when it happened. Vendors never receive a bulk list of customer contact details — data exports for vendors deliberately exclude them.

## Analytics

We count page views against a per-tab session identifier so vendors can see how often their profile was opened. There is no cross-site tracking and no advertising network involved.

## Getting your data or deleting it

Go to Privacy in your account to request a copy of your data or ask for deletion. Operational records such as enquiries are retained where we need them to resolve disputes, and are anonymised rather than erased when that applies.

## Contact

Email hello@example.com with any question about this.$md$
where slug = 'privacy';

update public.pages
set
  title = 'Terms of use',
  status = 'published',
  published_at = coalesce(published_at, now()),
  seo_description = 'The rules that govern listings, reviews, and enquiries on WeddingMall.',
  body = $md$This is a plain-English summary of the rules the platform enforces. It has not yet been reviewed by a lawyer and is not the final contract, which is being prepared.

## Using the marketplace

You need an account to send an enquiry, save a vendor, or leave a review. One account per person.

## For couples

An enquiry goes to the vendor you chose and starts a private thread. You can review a vendor once your enquiry with them has progressed past first contact — reviews from people who never engaged a business are not accepted, and this is enforced by the database rather than by a form.

Every review is moderated before it appears. You can edit yours, but editing sends it back for moderation so that what is published is always something a moderator has seen.

## For vendors

Listings are reviewed before publication, and edits to a published listing are reviewed before they replace it. A vendor cannot set their own verification status, publication status, or rating — those are decided by review and by approved reviews respectively.

Paid placement is labelled "Sponsored" wherever it appears, and requires a plan that includes it. Ending a plan removes the placement but never deletes anything you have added.

You may post one public reply to each review about you. Replies are moderated.

## Things that will get an account removed

Fake reviews, listings for businesses you do not represent, harassment of couples or other vendors, and attempts to move a conversation off-platform to avoid the protections above.

## Contact

Email hello@example.com with any question about this.$md$
where slug = 'terms';

-- ---------------------------------------------------------------------------
-- Pages the routes expect but that were never created.
-- ---------------------------------------------------------------------------

insert into public.pages (slug, title, status, published_at, seo_description, body)
values
  (
    'help',
    'Help centre',
    'published',
    now(),
    'Answers to the questions couples and vendors ask most.',
    $md$## For couples

**Does it cost anything to enquire?** No. Sending an enquiry and shortlisting vendors are free.

**Will the vendor get my phone number?** Not automatically. Your contact details are released only when you choose to share them on a specific enquiry.

**Why can I not review a vendor yet?** Reviews open once an enquiry has progressed past first contact, so that reviews come from real interactions.

**How long until a vendor replies?** Vendors are shown a response deadline and their dashboard highlights overdue enquiries. If nobody replies, send an enquiry to another vendor — comparing several is the point.

## For vendors

**How much does listing cost?** Listing is free. Paid plans add portfolio capacity, team seats, data export, and featured placement.

**Why is my listing not visible?** New listings and edits are reviewed before publication. Check Listing in your dashboard for the current status and any reviewer notes.

**Can I reply to a review?** Yes, once per review, and the reply is moderated before it appears.

**How do I add someone to my team?** Team in your dashboard. Roles decide what each member can see — replying to a customer and reading internal notes are separate permissions.

## Still stuck

Email hello@example.com.$md$
  ),
  (
    'contact',
    'Contact us',
    'published',
    now(),
    'How to reach the WeddingMall team.',
    $md$We are a small team. The fastest route depends on what you need — the options below go to the right place.$md$
  )
on conflict (slug) do nothing;
