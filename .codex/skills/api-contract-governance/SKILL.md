---
name: api-contract-governance
description: Govern enum definitions, API contracts, and API documentation for this repo. Use when changing `packages/types/src/enums`, `packages/types/src/contracts`, `docs/api/*.md`, `docs/prisma/data-model-reference.md`, or `docs/enums/enum-manual.md`, especially when adding or adjusting closed-set fields, status machines, or shared request/response structures.
---

# API Contract Governance

Keep the repo on a single contract system: `enums` as the only source of closed-set values, `contracts` for request/response/resource structures, and docs that are readable without cross-jumping between files.

## Workflow

1. Confirm the change scope.
   If the request touches status values, role codes, payment methods, sort fields, or any other closed-set field, start from `packages/types/src/enums`.

2. Update the enum source first.
   Add or revise `XxxEnum` and `Xxx` in `packages/types/src/enums/*`.
   Use stable English values only.
   Add Chinese JSDoc on the enum block and on every member.
   Do not introduce Chinese wire values.

3. Update contracts second.
   Keep request, response, query, and resource structures in `packages/types/src/contracts/*`.
   Import enum types from `../enums`.
   Do not define enum unions again inside contracts unless the doc requires a local literal example.

4. Update docs third.
   Edit `docs/api/*.md` before `docs/prisma/data-model-reference.md`.
   Keep API body readable on its own.
   Show critical enum values inline the first time they appear.
   Keep Chinese field comments in repo docs.
   Remove empty type blocks.
   Do not leave "see enum manual" as the only explanation for a business-critical field.

5. Sync backend modeling docs last.
   Update `docs/prisma/data-model-reference.md` and `docs/enums/enum-manual.md` after enums and API docs are final.
   `data-model-reference.md` is for backend modeling, not a second source of truth.

## Hard Rules

- `packages/types/src/types` must not be recreated.
- `packages/types/src/contracts` must not become a second enum source.
- New enum values must be stable English values.
- Chinese meaning stays in comments and doc tables, not in wire values.
- If one enum changes, scan all three places:
  `packages/types/src/enums/*`
  `packages/types/src/contracts/*`
  `docs/api/*.md`
- If docs show a type name such as `PaymentOrderStatus`, the nearby body should still show the real values where frontend needs them.

## Consistency Checks

After edits, run targeted searches for:

- old aliases such as `PayType`, `H5PayOrderStatus`, `PaymentMethodType`, `PackageStatus`
- deleted path references such as `src/types`
- stale uppercase or Chinese status literals in docs
- missing Chinese comments in enum members

Prefer `rg` examples:

```powershell
rg -n "PayType|H5PayOrderStatus|PaymentMethodType|PackageStatus|src/types" packages docs
rg -n "UNPAID|PAYING|PENDING_VERIFICATION|PAID|EXPIRED" docs
rg -n "pending_initial_review|pending_secondary_review|pending_confirmation|approved|rejected" docs
```

## Expected Outcome

- Frontend can read API docs without flipping to an external enum dictionary.
- Backend can implement directly from `enums + contracts + docs/api + data-model-reference`.
- The repo keeps exactly one enum source of truth.
