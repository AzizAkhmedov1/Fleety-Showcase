# Fleety TMS (Frontend Architecture Showcase)

The presentation layer and reactive scheduling matrix driving a multi-tenant Transportation Management System.

Fleety is a commercial-grade Transportation Management System built to handle carrier logistics, multi-tenant asset management, and driver dispatching workflows.

Architecture Note: To safeguard proprietary commercial logic, core multi-tenant backend engines, infrastructure scripts, database configurations, and operational secrets are kept isolated in a private repository. This repository features a comment-stripped presentation layer designed to showcase clean code organization.

## The Tech Stack

* Framework: Next.js (App Router, client routing, and optimized bundle splits)
* Language: TypeScript (Strict compile-time typing for data payloads)
* Styling: Tailwind CSS (Modular utility primitives and dynamic theme sheets)
* State Management: Custom React hooks, localized state machines, and synchronized global stores

## Core Engineering Challenges and Solutions

### 1. Overlapping Multi-Event Calendar Scheduling
* The Problem: Standard calendar components rely on flat, date-keyed objects like day and event variables. In logistics, a single driver or truck asset often has multiple concurrent, overlapping duties on the same day. Using traditional methods causes data collisions, where a new dispatch event completely overwrites a previous one in the UI.
* The Solution: I refactored the legacy dictionary mapping layer into a decoupled entity tracking framework managed by immutable layout IDs.
* The Impact: The scheduling grid can now render multiple overlapping dispatch events concurrently on identical calendar timelines without data mutation or rendering race conditions.

### 2. Smart Priority Rules for Component Theme Overrides
* The Problem: Automated text parsing utilities and status matching engines often conflict with manual stylistic overrides explicitly chosen by a dispatch operator, causing UI flickering or inconsistent status colors.
* The Solution: Implemented a strict three-tier short circuit evaluation pipeline inside the core rendering lifecycle to enforce styling precedence. Tier 1 checks manual absolute selections first. Tier 2 handles contextual semantic fallbacks (regex matching on textual content if Tier 1 is nullish). Tier 3 applies global default tokens.
* The Impact: Eliminates visual layout unpredictability, ensuring critical operational statuses render with 100% predictability for the operator.

### 3. Display-Layer Token Sanitization via Runtime Regex
* The Problem: Backend systems append unique orchestration hashes and database timestamps to status text strings like covered followed by a long ID string. These raw strings look messy on user badges, but dropping the hashes globally breaks the React virtual DOM diffing cycles and unique key identification loops.
* The Solution: Built a custom rendering interceptor that runs an optimized regular expression directly inside the string interpolation layer.
* The Impact: Strips the backend tracking codes cleanly on-screen for the end-user while leaving the raw, pristine tracking strings completely untouched in the virtual DOM tree.

## Architecture Overview

```text
fleety-showcase/
├── app/                  # App Router directories, layout shells, and workspace views
├── components/           # UI engineering tree handling complex layout states
│   ├── accounting/       # Financial ledger boards and billing matrices
│   ├── auth/             # Multi-step onboarding wizards and identity layouts
│   └── fleet/            # High-velocity scheduling timelines and planning boards
├── hooks/                # Custom lifecycle hooks and reactive viewport controllers
├── lib/                  # Performance utility helpers, validation logic, and styling maps
├── store/                # Global state stores managing reactive data layer coordination
└── types/                # Strict structural TypeScript parameters and schemas
