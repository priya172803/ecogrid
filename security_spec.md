# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **Identity Isolation**: A user may only read, create, update, or delete their own `/users/{userId}`, `/energyRecords/{recordId}`, `/bills/{billId}`, and `/offsetRedemptions/{redemptionId}` documents (`userId == request.auth.uid`).
2. **Privilege Escalation Prevention**: Non-admin users can NEVER create or update a `/users/{userId}` document with `role == 'government_admin'`, nor write to `/admins/{adminId}`, `/tariffPolicies/{policyId}`, or `/policyAdvisories/{advisoryId}`.
3. **Immutable Ownership & Temporal Integrity**: `uid`, `userId`, and `createdAt` cannot be modified after creation. `createdAt` and `updatedAt` must equal `request.time`.
4. **Strict Payload Boundaries**: Every collection rejects unknown shadow fields (`hasOnly`), oversized strings, negative kWh/amounts, and malformed IDs (`isValidId`).
5. **Secure List Queries**: Every `allow list` rule enforces `resource.data.userId == request.auth.uid` (or `isAdmin()`), never delegating filtering solely to client queries.
6. **Verified Auth Mandate**: All write operations require `request.auth != null && request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Self-Admin Escalation on Create**: Creating `/users/{uid}` with `role: "government_admin"` as a regular user -> MUST DENY.
2. **Self-Admin Escalation on Update**: Updating `/users/{uid}` changing `role` from `"domestic"` to `"government_admin"` -> MUST DENY.
3. **Cross-User PII Read**: Authenticated user A reading `/users/{userB}` -> MUST DENY.
4. **Shadow Field Injection**: Creating `/energyRecords/{id}` with extra field `isVerified: true` -> MUST DENY.
5. **Identity Spoofing on EnergyRecord**: User A creating `/energyRecords/{id}` with `userId: "userB"` -> MUST DENY.
6. **Negative Consumption Poisoning**: Creating `/energyRecords/{id}` with `kwh: -500` -> MUST DENY.
7. **ID Poisoning**: Creating `/bills/{1500_char_invalid_id}` -> MUST DENY.
8. **Client-Spoofed Timestamp**: Creating `/bills/{id}` with `createdAt` in the past instead of `request.time` -> MUST DENY.
9. **Unauthorized Tariff Policy Tampering**: Regular consumer writing `/tariffPolicies/{id}` -> MUST DENY.
10. **Unauthorized Advisory Publishing**: Regular consumer writing `/policyAdvisories/{id}` -> MUST DENY.
11. **Unverified Email Admin Spoof**: Token with `email: "vishnuachar74@gmail.com"` and `email_verified: false` accessing admin resources -> MUST DENY.
12. **Blanket List Query Scraping**: Regular consumer running unfiltered `getDocs(collection(db, 'energyRecords'))` -> MUST DENY.
