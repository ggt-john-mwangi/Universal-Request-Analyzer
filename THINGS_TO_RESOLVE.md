1. Export & Data Handling
Export Formats

Implement SQLite export (baseline).

Define and document a clear plan for:

JSON export

Structure: database → tables → rows.

Each table maps to a JSON object with an array of row objects.

CSV export

One CSV file per table.

File naming convention based on table name.

Ensure consistency across all export formats.

Auto Export

Fully implement Auto Export functionality.

Introduce a config schema to control:

Export format(s)

Frequency

Scope (tables, profiles, filters)

Define and handle export locations:

Default export location

User-configurable override

Validation and permissions handling

2. UI & Menus
Security Menu

Review and finalize scope of security-related settings.

Ensure alignment with profiles and cloud-driven configurations.

Theme Menu

Decide on UX:

Global “Save” button vs per-theme “Apply” button.

Fix theme persistence:

Theme resets on reload.

Define save flow:

Persist theme in database

Sync to storage

All surfaces (options, popup, panel) read from storage for fast lookup

Apply theming consistently (backgrounds, transparency, components).

3. Runners & Pagination
Runners Menu

Replace client-side-only search with:

DB-backed search

Pagination support for large datasets

Pagination:

Reuse existing implementation from Dashboard → Requests Table.

Extract pagination logic into a shared module or library.

Runner Information:

Show variables list used by the runner.

Add more contextual actions.

Fix transparent background and ensure theme compatibility.

4. Dashboard & Visualizations
Visualization Enablement

Ensure all dashboard visualizations are correctly linked to:

“Enable Plots” setting in General menu.

Clarify and document:

Role of General tab configs

How they drive:

Content scripts (data capture)

Options / Panels (visualizations)

Clarify differences and handling between XHR vs Fetch.

Page vs Domain Context

Enforce no aggregation when no page is selected.

Visuals that should be page-only:

Core Web Vitals

Request Volume Over Time

Performance Trends

Response Time Percentiles

Core Web Vitals:

Support per-page trends over time.

Show:

Value card

Embedded mini time-series chart

Add icons to open a modal for detailed view.

5. General Tracking Logic
Track Configured Sites

“Track ONLY configured sites”:

Enabled by default.

Behavior rules:

If enabled and no sites configured → track nothing.

If disabled and no sites configured → track all sites except excluded domains.

Ensure all General settings are harmonized across:

Content scripts

Capture logic

Visualizations

Options & panels

Quick Site Presets

Prevent duplicate additions when clicking “Add Current Tab” multiple times.

Enforce exclusion of:

Extension URLs

Browser default pages

Apply exclusion rules consistently:

Settings

Capture logic

UI inputs

6. Data Management & Profiles
Settings Profiles

Profiles are cloud-generated and take priority over:

General settings

Security settings

Profiles define:

What data is tracked locally

Auth tokens and sensitive configuration

Cloud model:

Company tenant

Teams with multiple profiles per project

Data synced per team member and tenant

Future-Facing Design

Prepare for SDK-style integrations (e.g., Sentry-like).

Tracking rules:

Only flagged metrics are captured

Threshold-based tracking

Feature flags per customer

Regional/location-based tracking

Goal: capture just enough metrics across the board.

7. Cleanup & Maintenance
Cleanup Preview

Accurately show:

Table counts affected

Which tables can be cleaned

Track and manage backups created during cleanup.

Advanced → Data Management Panel

Fix inconsistencies:

Database size mismatch

Incorrect Bronze / Silver / Gold counts

Clarify:

Which tables are in use

Where each table is used

When it was last accessed or updated