# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Residents report local civic issues. Nearby residents add firsthand confirmations and evidence. Volunteers and neighborhood groups organize follow-up. Moderators review reports, duplicates, abuse, and campaign integrity.

## Product Purpose

CivicPulse gives residents a public place to report and follow local civic issues, from first observation through community verification, official-source lookup, escalation, and optional community support.

## Positioning

The product connects issue evidence, community activity, source-labeled accountability information, and follow-up in one public issue record. The MVP plan calls for a one-city launch.

## Operating Context

Residents use the responsive web app on phones and desktop while moving through their neighborhood. The first preview area is Bhubaneswar, Odisha. The app is independent of government agencies.

## Capabilities and Constraints

- The current preview has an issue feed, sample map, browser issue submission, issue detail, timeline, escalation draft, and campaign pledge-intent UI.
- The API uses FastAPI and PostgreSQL/PostGIS. Ollama with Gemma provides optional AI triage; AI output remains a human-reviewed suggestion.
- Campaigns are limited to community-verified issues. The current supporter ledger records pledge intent; the app does not process or hold money.
- Display names are self-reported. The current app does not authenticate identity or establish verified contributor reputation.
- Official department, contractor, helpline, tender, and grievance records must come from cited public sources. Do not infer them or make accusations about people.
- Sample issues and map pins are illustrative, not verified local reports. Photos, real resident identities, and real civic performance metrics are not available in the preview.
- Reports, confirmations, and escalation drafts must not be described as submitted to a government office unless an integration confirms it.

## Brand Commitments

CivicPulse is the product name. The first preview uses Bhubaneswar, Odisha as its sample location. No other visual identity, logo, palette, or typeface has been approved by the user.

## Evidence on Hand

The MVP plan and current sample issue data are available in the project. The map uses OpenStreetMap. There are no supplied user photos, official issue sources, verified contributor identities, or live donation records.

## Product Principles

- Keep source and verification status visible.
- Separate community-funded workarounds from government accountability.
- Keep AI suggestions reviewable and label uncertain information.
- Make the next useful action clear on each issue.

## Accessibility & Inclusion

The product is a responsive web app. Preserve keyboard access, visible focus, readable contrast, and reduced-motion support.
