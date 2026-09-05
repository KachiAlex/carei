# CAREi Implementation Roadmap

## Phase 1: Foundation Fixes (Current Sprint)
| # | Feature | Status | Files / Notes |
|---|---------|--------|---------------|
| 1.1 | Fix auth token persistence for Capacitor (localStorage + Authorization header) | ✅ Done | `api/db.ts`, `src/api/client.ts` |
| 1.2 | Fix Manager login screen — real backend auth instead of hardcoded PIN | ✅ Done | `src/pages/ManagerLoginScreen.tsx` |
| 1.3 | Fix CORS to allow credentialed requests from Capacitor webview | ✅ Done | `api/db.ts` — dynamic origin echo |
| 1.4 | Fix `/api/visits` to authenticate carer and include manager assignments | ✅ Done | `api/visits.ts` |
| 1.5 | Fix `/api/visit/[id]` to resolve manager-created assignment IDs | ✅ Done | `api/visit/[id].ts` |
| 1.6 | Generate Android adaptive icons from favicon.svg | ✅ Done | `scripts/generate-icons.cjs` |

---

## Phase 2: Pre-Visit Flow (Client Overview Screen)
| # | Feature | Effort | Depends On | Notes |
|---|---------|--------|------------|-------|
| 2.1 | **Create Client Overview route** — `/client/:id/overview` | Small | — | New lazy-loaded page component |
| 2.2 | **Display client profile card** — name, age, pronouns, GP, address | Small | — | Reuse existing client fetch API |
| 2.3 | **Allergy banner** — red, prominent, dismissible | Small | 2.2 | Conditional render if `allergies` field present |
| 2.4 | **Choking risk banner** — full dysphagia protocol | Medium | 2.2 | Needs new `dysphagiaProtocol` text field on clients |
| 2.5 | **Support level & care framework tags** — PBS, Person-Centred, Stroke Rehab, Trauma-Informed | Small | — | Display `support_framework` field |
| 2.6 | **Communication guidance section** — per-client tailored guidance | Small | — | Display `communication_guidance` field |
| 2.7 | **Mobility note** | Small | — | Display `mobility` field |
| 2.8 | **Medication summary** — condensed list of current meds | Small | — | Reuse existing `medications` array |
| 2.9 | **Last handover bullets** — fetch from most recent visit for this client | Medium | — | Query `visits` table for last `handover_note` |
| 2.10 | **Contextual care cues** — client-specific guidance surfaced at key moments | Medium | 2.2 | Needs new `care_cues` JSONB field on clients |
| 2.11 | **Condition tags** — Dementia, Post Stroke, Diabetes, Medication Required | Small | — | Reuse existing `conditions` array |
| 2.12 | **"Start Active Visit" button** — navigates to `/visit/:id` | Small | — | Pass client context via route state |
| 2.13 | **Backend: Add new client fields** — `allergies`, `dysphagiaProtocol`, `supportFramework`, `communicationGuidance`, `mobility`, `careCues` | Medium | — | `api/db.ts` schema + `api/clients.ts` CRUD + `api/clients/[id].ts` |

---

## Phase 3: Active Visit — Core Enhancements
| # | Feature | Effort | Depends On | Notes |
|---|---------|--------|------------|-------|
| 3.1 | **Lone Worker Safety timer** — auto-activates on clock-in, 25-min countdown, red escalation, "Check In" reset, manual toggle | Medium | — | `useEffect` interval + visual state machine |
| 3.2 | **Fluid intake counter** — quick +1 glass button, green at 6 glasses | Small | — | Local state + visual color shift |
| 3.3 | **Offline banner** — detect `navigator.onLine`, queue actions for sync | Small | — | Reuse existing `offlineQueue` utility |
| 3.4 | **Care tasks with timestamps** — tap to complete, clamp to clock-in time | Small | — | Numeric comparison against `clockInAt` |
| 3.5 | **Contextual care cue cards** — auto-surface when related task is ticked | Medium | 3.4 | Map task names → care cues |
| 3.6 | **Meal prompt** — appears when breakfast task ticked, if meal status unset | Small | 3.4 | Conditional prompt modal |

---

## Phase 4: Active Visit — Medications Module
| # | Feature | Effort | Depends On | Notes |
|---|---------|--------|------------|-------|
| 4.1 | **Drug Interaction Alert** — advisory banner when 2+ interacting meds scheduled | Medium | — | Needs `drug_interactions` reference table or hardcoded pairs |
| 4.2 | **Medication Due-Time Alert Banners** — real clock vs. due time comparison | Medium | — | 4 banner types: Amber/Teal/Red(dismissible)/Red(locked) |
| 4.3 | **Per-medication cards** — drug name, dose, due time, administration note | Small | — | Reuse existing `medications` array |
| 4.4 | **CONTROLLED badge + witness prompt** | Small | 4.3 | Check `is_controlled` boolean on medication |
| 4.5 | **Two-person sign-off flow** — witness name entry + "👥 Witnessed by" badge | Medium | 4.4 | Modal form → store `witness_name` on visit record |
| 4.6 | **"Given" button with overdose safeguard** — check if already given today | Medium | 4.3 | Query `medications` log for same drug + same day |
| 4.7 | **Time picker for medication administration** — rounds to nearest 5 min | Small | 4.6 | HTML time input or custom picker |
| 4.8 | **"Not Given" structured refusal form** — reason, what carer said, action taken, free-text note | Medium | 4.3 | Expandable form card |
| 4.9 | **Backend: Add medication log table** — track every administration attempt with timestamp | Medium | — | New `medication_logs` table |

---

## Phase 5: Active Visit — Vitals & Care Notes
| # | Feature | Effort | Depends On | Notes |
|---|---------|--------|------------|-------|
| 5.1 | **Personal BP baselines per client** — stored on client record, displayed in card header | Small | — | New `bp_baseline_systolic`, `bp_baseline_diastolic` fields |
| 5.2 | **Vital Signs form** — Systolic, Diastolic, Pulse, O₂ Sat | Small | — | Numeric input fields |
| 5.3 | **BP comparison against personal baseline** — auto-flag on entry | Medium | 5.1, 5.2 | Rules: >15 sys or >10 dia = Elevated; sys<90 or dia<60 = Low |
| 5.4 | **Client-specific threshold advisory** — red text where applicable | Small | 5.3 | Display computed advisory message |
| 5.5 | **Fluid glasses counter (Care Notes)** — 0-12, green at 6 | Small | — | Reuse Phase 3 fluid counter or sync between sections |
| 5.6 | **Meal status selector** — Full / Half / Refused | Small | — | Three-button toggle |
| 5.7 | **Nutrition notes field** | Small | — | Textarea |
| 5.8 | **Mood selector** — Happy / Calm / Anxious / Distressed / Tired / In Pain | Small | — | 6-option button group with icons |
| 5.9 | **Free-text wellbeing note** | Small | — | Textarea |
| 5.10 | **Backend: Add vitals + care_notes fields to visits table** | Small | — | `bp_systolic`, `bp_diastolic`, `pulse`, `o2_sat`, `fluid_glasses`, `meal_status`, `mood`, `wellbeing_note` |

---

## Phase 6: Active Visit — Incident Reporting & Voice
| # | Feature | Effort | Depends On | Notes |
|---|---------|--------|------------|-------|
| 6.1 | **Inline incident reporting** — severity (Low/Medium/High), type selector, free-text note | Medium | — | Expandable card, submits without navigation |
| 6.2 | **Backend: Add incidents table** — store inline reports linked to visit | Small | — | New `incidents` table with `visit_id`, `severity`, `type`, `note`, `created_at` |
| 6.3 | **Voice Memo recorder** — tap-to-record, live timer, playback | Medium | — | Web Audio API + MediaRecorder; Capacitor may need `@capacitor/filesystem` for storage |
| 6.4 | **Backend: Store voice memo metadata** — file path / URL, duration, timestamp | Medium | 6.3 | Blob storage (Vercel Blob or external) or base64 in DB |

---

## Phase 7: Visit Completion Pipeline
| # | Feature | Effort | Depends On | Notes |
|---|---------|--------|------------|-------|
| 7.1 | **"Complete Visit" button gating** — disabled until all meds acknowledged | Small | 4.6, 4.8 | Check all medications have `given_at` or `not_given_reason` |
| 7.2 | **Handover Screen** — post-visit, client name, time range, carer's written handover note, completion summary | Medium | — | New route `/visit/:id/handover` |
| 7.3 | **Backend: Store handover note on visits table** | Small | — | Add `handover_note` text field |
| 7.4 | **ContinuCare+ Summary Screen** — structured timestamped visit record | Large | 7.2, 7.3 | New route `/visit/:id/summary`; full timeline UI |
| 7.5 | **Visit timeline** — clock-in, tasks with timestamps, medications, vitals save, clock-out | Medium | 7.4 | Chronological list component |
| 7.6 | **Medications in summary** — given (drug/dose/time), controlled (witness badge), not given (reason) | Medium | 7.4 | Reuse visit data |
| 7.7 | **Audit Trail Complete badge** | Small | 7.4 | Conditional badge if all required fields present |
| 7.8 | **Backend: Update visits table** — `clock_in_at`, `clock_out_at`, `submitted_at`, `status` | Small | — | Ensure all timestamp fields exist |

---

## Phase 8: Body Map & Care Plan
| # | Feature | Effort | Depends On | Notes |
|---|---------|--------|------------|-------|
| 8.1 | **Body Map Screen** — interactive anterior/posterior SVG diagram | Large | — | SVG with click targets, tap-to-mark, color-coded markers |
| 8.2 | **Body map mark types** — skin integrity change, injury, pressure area | Small | 8.1 | Selector modal on tap |
| 8.3 | **Body map notes per mark** | Small | 8.1 | Text input attached to each mark |
| 8.4 | **Audit badge** — "Body map logged with timestamp" | Small | 8.1 | Display on summary screen |
| 8.5 | **Backend: Add body_map_marks table** — x, y, side (anterior/posterior), type, note, visit_id | Medium | — | New table |
| 8.6 | **Care Plan Screen** — full care plan with tabs: Overview / PBS Framework / Medications / History | Medium | — | New route `/client/:id/care-plan` |
| 8.7 | **Care Plan — Overview tab** — conditions, allergy, support level, communication, mobility | Small | 8.6 | Reuse Client Overview data |
| 8.8 | **Care Plan — PBS / Framework tab** — behaviour strategies, anxiety signs, green/amber/red states, de-escalation | Medium | 8.6 | Needs new `pbs_framework` JSONB field on clients |
| 8.9 | **Care Plan — Medications tab** — full medication list with doses and notes | Small | 8.6 | Reuse existing medications |
| 8.10 | **Care Plan — History tab** — previous visit summaries for this client | Medium | 8.6 | Query `visits` table by `client_id` |

---

## Phase 9: Emergency, History & Rota
| # | Feature | Effort | Depends On | Notes |
|---|---------|--------|------------|-------|
| 9.1 | **Emergency Contacts Screen** — GP, NHS 111, 999, agency office, DNAR notice | Small | — | New route `/emergency`; `tel:` links for quick-dial |
| 9.2 | **Dynamic agency office number** — uses `carerAgency` to look up phone | Small | 9.1 | Needs `agencies` reference table |
| 9.3 | **Visit History Screen** — chronological previous visits per client | Medium | — | New route `/client/:id/history`; query `visits` |
| 9.4 | **Rota Screen** — weekly calendar view for logged-in carer | Medium | — | New route `/rota`; 7-day grid with visit dots |
| 9.5 | **Backend: Add visit_date range queries** for rota | Small | 9.4 | `GET /schedule?from=&to=` already exists |

---

## Phase 10: Operations, Schedule & Family Portal
| # | Feature | Effort | Depends On | Notes |
|---|---------|--------|------------|-------|
| 10.1 | **Operations Screen** — agency-level compliance metrics overview | Medium | — | New route `/operations`; charts + KPI cards |
| 10.2 | **Schedule Screen (full)** — all assigned clients with condition tags and addresses | Small | — | New route `/schedule-full`; list view of assignments |
| 10.3 | **Family Portal Screen** — demo family view: live timeline, ETA, read receipts, message agency, call agency | Medium | — | New route `/family-portal`; mostly static/demo for now |
| 10.4 | **Backend: Family message endpoint** — POST message to care team | Small | 10.3 | Simple table `family_messages` |

---

## Phase 11: Manager Approvals & Family Summary
| # | Feature | Effort | Depends On | Notes |
|---|---------|--------|------------|-------|
| 11.1 | **Manager Approvals Screen** — review submitted visits | Large | 7.4 | New route `/manager/approvals`; status banner |
| 11.2 | **Approval placeholder** — "No completed shift to review" when empty | Small | 11.1 | Empty state |
| 11.3 | **Live visit summary card** — client, date, carer, time range, completion summary | Medium | 11.1 | Reuse ContinuCare+ data |
| 11.4 | **Medication Log strip in approval** — each drug: given time or refusal reason | Medium | 11.3 | Condensed list |
| 11.5 | **Read Receipt** — family opened summary at what time | Medium | 11.1 | Needs `family_read_at` timestamp field |
| 11.6 | **Approval Checklist** — 4-item pre-release gate with checkboxes | Medium | 11.1 | UI only; no blocking logic |
| 11.7 | **"Approve & Release to Family" button** — flips status to released | Small | 11.6 | PATCH visit status |
| 11.8 | **Post-approval confirmation** — green "Released ✓" with client first name | Small | 11.7 | Success state |
| 11.9 | **Family Summary Screen** — released visit summary for family viewing | Medium | 11.1 | New route `/family-summary/:visitId` |
| 11.10 | **Backend: Add visit approval fields** — `approval_status`, `approved_at`, `approved_by`, `family_read_at` | Small | — | Add columns to `visits` table |

---

## Phase 12: Auth & Platform Enhancements
| # | Feature | Effort | Depends On | Notes |
|---|---------|--------|------------|-------|
| 12.1 | **OTP verification for Sign Up** — email/SMS OTP instead of static PIN | Large | — | Integrate Twilio (SMS) or SendGrid/Resend (email); new `otp_codes` table |
| 12.2 | **OTP verification for Log In** — replace PIN with OTP | Large | 12.1 | Same flow, different trigger |
| 12.3 | **Multi-agency `carerAgency` propagation** — dynamic agency label on every screen | Medium | — | Store `agency` on user record; pass through all components |
| 12.4 | **Profile Screen enhancements** — avatar, stats (visits completed, compliance score, years of service), settings tiles | Medium | — | Expand existing profile modal |
| 12.5 | **Backend: Add agencies table** — id, name, phone, logo, settings | Small | 12.3 | Reference table |
| 12.6 | **Backend: Add user stats fields** — `visits_completed`, `compliance_score`, `created_at` for years of service | Small | — | Add to `users` or compute on the fly |

---

## Phase 13: Admin / Compliance Dashboard
| # | Feature | Effort | Depends On | Notes |
|---|---------|--------|------------|-------|
| 13.1 | **Admin Teaser Screen** (carer-facing) — Compliance Score ring, today's metrics, upgrade prompt | Small | — | Static/demo KPIs for now |
| 13.2 | **Manager Dashboard — Compliance Score ring with breakdown** | Medium | — | Add to existing `/manager` Overview tab |
| 13.3 | **Live alert feed** — lone worker overdue, missed medication, incident raised | Medium | — | Real-time or polling feed |
| 13.4 | **Audit Trail entries** — every action timestamped, filterable | Medium | — | Query `visits`, `task_logs`, `medication_logs`, `incidents` |
| 13.5 | **Staff performance table** — visits per carer, compliance rate, incidents | Medium | — | Aggregated stats per user |
| 13.6 | **Pending approvals count badge** | Small | 11.1 | Query `visits WHERE approval_status = 'pending'` |
| 13.7 | **Export and reporting actions** — CSV/PDF export | Large | — | Client-side CSV generation or server-side PDF |

---

## Phase 14: Audit, Time Clamping & Offline
| # | Feature | Effort | Depends On | Notes |
|---|---------|--------|------------|-------|
| 14.1 | **Audit trail — every action logged with timestamp and carer ID** | Medium | — | Central `audit_log` table or augment existing tables |
| 14.2 | **Time clamping — all task/vitals/medication times clamped to clock-in time** | Small | — | Numeric comparison: `max(timestamp, clockInAt)` |
| 14.3 | **Clock-in time capture** — set once at Active Visit screen mount, fixed throughout | Small | — | Store `clock_in_at` in visit record |
| 14.4 | **Offline data queue — all actions queued when offline, sync on reconnect** | Medium | — | Expand `src/utils/offlineQueue.ts`; persist to IndexedDB |
| 14.5 | **Offline banner** — appears on connectivity loss | Small | 14.4 | Detect `navigator.onLine` |
| 14.6 | **Service Worker caching** — cache static assets and API responses | Medium | — | Enhance existing SW in `main.tsx` |

---

## Summary by Effort

| Effort Level | Count | Examples |
|--------------|-------|----------|
| Small (1-2 days each) | ~35 items | Banners, selectors, counters, badges, simple CRUD |
| Medium (3-5 days each) | ~20 items | Screens with data fetching, forms, timelines, tables |
| Large (1-2 weeks each) | ~6 items | Body Map, Manager Approvals, OTP, ContinuCare+ Summary, Export, Voice Memo |

**Total estimated build time: 12-16 weeks with 1 developer**
