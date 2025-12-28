# Billing Request OS - Implementation Plan

## Problem
Collectors use Google Forms + Slack which causes:
- Double data entry
- No ownership/SLAs
- PHI exposure risk
- Duplicate requests
- Accounts sitting in limbo

## Solution
A single system replacing Google Forms.

---

## Core Workflow (10 Steps)

1. **Collector Creates Request** - Fields auto-populate from CRM (Account #, Client ID are READ-ONLY)
2. **System Validates** - Required fields per request type
3. **System Dedupes** - Blocks if same account + type exists
4. **Auto-Routes** - Internal requests (PIF/SIF) auto-resolve; External (disputes) go to Client Services
5. **Posts to Slack** - Creates admin task
6. **Client Services Sends** - Same-day SLA
7. **Client Responds** - Via secure portal
8. **Auto-Escalation** - 3 days → nudge, 7 days → supervisor
9. **Collector Notified** - Gets outcome
10. **Request Closes** - With resolution code

---

## 5 Request Categories

### Category 1: Insurance / Billing
| Type | Required Fields | Hold Behavior |
|------|-----------------|---------------|
| Insurance Coverage Claim | Payer name, Policy/Member ID provided? (Y/N), Primary/Secondary? | Soft hold |
| Wrong Insurance / Refile | Correct payer info, Reason for refile | Soft hold |
| Auto Accident / 3rd Party | Date of accident, Insurance carrier, Claim # | Hard hold |
| Medicaid/Medicare Question | Coverage type, Eligibility dates claimed | Soft hold |

### Category 2: Payment
| Type | Required Fields | Hold Behavior |
|------|-----------------|---------------|
| Paid Direct to Provider | Payment method, Date, Amount, Proof offered? (Y/N) | Soft hold |
| On Payment Plan | Plan start date, Monthly amount, Provider contact | Hard hold |
| Payment Posted Wrong | Payment date, Amount, Where posted, Where should be | Soft hold |

### Category 3: Identity / Validity
| Type | Required Fields | Hold Behavior |
|------|-----------------|---------------|
| Not Our Patient / No Service | ID verification status, What debtor claimed | Hard hold |
| Identity Theft / Fraud | ID verification status, Fraud affidavit offered? | Hard hold |

### Category 4: Documentation
| Type | Required Fields | Hold Behavior |
|------|-----------------|---------------|
| Itemized Bill Request | Delivery preference (mail/email/portal) | Soft hold |
| Validation Package Request | Delivery preference, Reason for request | Hard hold (30 day) |
| Statement Resend | Delivery preference, Address verified? | No hold |

### Category 5: Charge Dispute
| Type | Required Fields | Hold Behavior |
|------|-----------------|---------------|
| Overcharged / Balance Incorrect | What is disputed, Expected balance | Soft hold |
| Service Cancelled / Not Billed | Cancellation date, Reason, Reference # | Hard hold |

---

## Data Model

### Request Object
| Field | Type | Description |
|-------|------|-------------|
| request_id | string | REQ-#### format |
| agency_id | enum | ICS, MSB, VV |
| client_id | foreign key | Links to Client table |
| account_reference | string | READ-ONLY from CRM |
| internal_file_id | string | READ-ONLY from CRM |
| debtor_language | enum | EN, ES, etc. |
| collector_id | foreign key | Auto from login |
| request_type | enum | See categories above |
| required_fields_payload | json | Dynamic per type |
| status | enum | OPEN, CLAIMED, SENT, RESPONDED, CLOSED |
| priority | enum | NORMAL, HIGH |
| assigned_admin_id | foreign key | Client Services owner |
| created_at | timestamp | |
| claimed_at | timestamp | |
| sent_at | timestamp | |
| responded_at | timestamp | |
| closed_at | timestamp | |
| sla_due_at | timestamp | |
| sla_breached | boolean | |
| resolution_code | enum | See below |
| audit_log | json array | Immutable history |

### Resolution Codes
- DEBT_VALID
- BALANCE_ADJUSTED
- INSURANCE_PAID
- PATIENT_PAID
- ACCOUNT_RECALLED
- IDENTITY_CONFIRMED_FRAUD
- NO_CLIENT_RESPONSE
- DUPLICATE_CLOSED

---

## Key Features

### PHI Safety
- NO PHI in Slack messages (only request ID, account #, status)
- NO PHI in client emails (only secure portal links)
- Red-flag validator blocks PHI in free-text fields
- Email validation before sending

### SLA Enforcement
- Request unclaimed > 15 min → Slack alert
- Request not sent > 4 hrs → Supervisor escalation
- No client response > 3 days → Auto follow-up
- No client response > 7 days → Supervisor + client escalation

### Analytics
- Requests per 100 accounts worked
- Request-to-cash conversion (14/30 day)
- Stall Ratio (disputes / $ collected)
- False Alarm Rate (% resolved as "Debt Valid")
- Rework rate

---

## Acceptance Criteria

1. [ ] Collector can submit with fields auto-populated from CRM
2. [ ] Account # and Client ID are read-only
3. [ ] Dedupe prevents duplicate requests
4. [ ] Internal requests auto-resolve (PIF/SIF letters)
5. [ ] Slack posts immediately with standardized format
6. [ ] Admin queue with filters (agency, client, type, SLA breach)
7. [ ] One-click actions: Claim, Need Info, Send, Close, Escalate
8. [ ] Client email validation before sending
9. [ ] Client portal for responses/uploads
10. [ ] SLA auto-escalation
11. [ ] PHI red-flag validator
12. [ ] Analytics dashboards

---

## Current State vs Target

### Current (App.tsx)
- 3 request types: PIF Letter, SIF Letter, Dispute
- Basic form with notes field
- Hardcoded account/client info

### Target
- 14+ request types with dynamic fields
- Auto-populated READ-ONLY fields from CRM
- Dedupe logic
- Slack integration
- Admin queue
- Client portal
- SLA tracking
- Analytics dashboard
