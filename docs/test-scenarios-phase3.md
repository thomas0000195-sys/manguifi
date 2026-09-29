# PHASE 3 — Test Scenarios & Validation

**Date** : 29 septembre 2026  
**Testeur** : Manuel + Jest unit tests  
**Environnement** : Local dev + staging

---

## Unit Tests (Jest)

Run with:
```bash
npm test -- --testPathPattern="access-code|phone"
```

### ✓ Tests Couverts

#### access-code.test.ts
- [x] `generateAccessCode()` generates 8-digit codes
- [x] No ambiguous digits (0, 1) in generated codes
- [x] Unique codes (50 consecutive)
- [x] `hashAccessCode()` hashes without reversibility
- [x] `verifyAccessCode()` accepts correct code
- [x] `verifyAccessCode()` rejects wrong code
- [x] Constant-time comparison (bcryptjs)

#### phone.test.ts
- [x] `toE164()` converts local Senegal format (77 123 45 67 → +221771234567)
- [x] `toE164()` normalizes international format
- [x] Different formats normalize to same result
- [x] Invalid numbers rejected (empty, non-numeric, too short)
- [x] `hashPhone()` deterministic (same input = same hash)
- [x] `hashPhone()` produces different hashes for different numbers
- [x] `hashPhone()` non-reversible (HMAC-based)

---

## Manual End-to-End Scenarios

### Scenario 1: Create Employee → Code Generated

**Setup:**
1. Login as Admin → `/dashboard`
2. Go to `/employes` (Employees)
3. Click "Ajouter un employé" (Add Employee)

**Steps:**
```
Form:
  Prénom: Jean
  Nom: Dupont
  Numéro: 77 123 45 67
  Poste: Responsable pointage
  Équipe: [select any]
  
Click "Créer"
```

**Expected Result:**
- ✓ Employee created in DB
- ✓ `EmployeeAccessCode` row created with:
  - `codeHash` (hashed, not plaintext)
  - `expiresAt` = today + 30 days
  - `usedAt` = NULL
- ✓ Plaintext code displayed ONCE in green banner:
  ```
  Code d'accès généré: [8 digits]
  ⚠️ Ce code ne s'affichera qu'une fois. Notez-le ou partagez-le maintenant.
  ```
- ✓ Banner disappears on page reload (code never re-displayed)

**Audit:**
- Check `AuditLog`: action = "GENERATE_EMPLOYEE_ACCESS_CODE"

---

### Scenario 2: Login with Valid Code → Session Active

**Setup:**
1. Employee from Scenario 1 created with code (e.g., `32455432`)
2. Logout from admin session (or use private window)

**Steps:**
```
1. Go to /connexion-employe
2. Enter phone: "77 123 45 67"
3. Click "Continuer"
4. Form displays: "Code d'accès pour +221771234567"
5. Enter code: "32455432"
6. Click "Vérifier"
```

**Expected Result:**
- ✓ Redirects to `/espace` (employee dashboard)
- ✓ Session cookie set (`manguifi_session`)
- ✓ `EmployeeSession` row created with:
  - `token` (hashed, secure)
  - `lastActivityAt` = now
- ✓ Can access employee features (scanner, history, etc.)

**Persistence Test:**
```
1. Close browser completely (simulate device restart)
2. Go to /espace in new session
3. Should redirect to /connexion-employe (session lost)
   OR
4. If token persisted in localStorage (mobile app behavior):
   - Validate token → still valid?
   - Update lastActivityAt
   - Redirect to /espace
```

**Audit:**
- Check `AuditLog`: action = "EMPLOYEE_ACCESS_CODE_LOGIN"
- Check `EmployeeLoginAttempt`: outcome = "SUCCESS"

---

### Scenario 3: Reuse Same Code → Rejected

**Setup:**
1. From Scenario 2: employee just logged in with code `32455432`
2. Code has been marked `usedAt` = timestamp

**Steps:**
```
1. Logout from employee session
2. Go to /connexion-employe
3. Enter phone: "77 123 45 67"
4. Enter same code: "32455432"
5. Click "Vérifier"
```

**Expected Result:**
- ✗ Error: "Code invalide. Vérifiez et réessayez." OR "Aucun code d'accès actif."
- ✗ NOT redirected to /espace
- ✓ `EmployeeLoginAttempt` row: outcome = "CODE_INVALID" or "NO_CODE"

---

### Scenario 4: Expired Code → Rejected

**Setup:**
1. Manually set `EmployeeAccessCode.expiresAt` to yesterday:
   ```sql
   UPDATE "EmployeeAccessCode" 
   SET "expiresAt" = NOW() - INTERVAL '1 day'
   WHERE "employeeId" = '[employee-id]';
   ```

**Steps:**
```
1. Go to /connexion-employe
2. Enter phone: "77 123 45 67"
3. Enter code (valid hash, but past expiration)
4. Click "Vérifier"
```

**Expected Result:**
- ✗ Error: "Aucun code d'accès actif." (same generic message as #3)
- ✗ `EmployeeLoginAttempt`: outcome = "NO_CODE"

---

### Scenario 5: Rate Limiting — 5 Failed Attempts

**Setup:**
1. Valid employee with code `32455432`

**Steps:**
```
Attempt 1-5:
  Enter wrong code (e.g., 11111111)
  Error each time: "Code invalide."
  
Attempt 6:
  Enter any code
```

**Expected Result:**
- ✓ Attempts 1-5 each fail with "Code invalide."
- ✗ Attempt 6: Error "Trop de tentatives. Réessayez dans 15 minutes."
- ✓ `EmployeeLoginAttempt` rows: 5x "CODE_INVALID", then "RATE_LIMITED"

**Recovery:**
```
Wait 15 minutes, then:
  Attempt 7: Should work again with correct code
```

---

### Scenario 6: Admin Regenerates Code → Old Session Revoked

**Setup:**
1. Employee Jean Dupont logged in (has active `EmployeeSession`)
2. Code on device: `32455432`

**Steps (as Admin):**
```
1. Go to /employes/[jean-id]
2. Find "Régénérer le code d'accès" button
3. Click → displays new code (e.g., `34567892`)
4. Note new code
```

**Expected Result:**
- ✓ `EmployeeAccessCode` row created for new code (hash `34567892`)
- ✓ Previous code marked `usedAt` = now (revoked)
- ✓ **Old `EmployeeSession` deleted** (employee logged out)
- ✓ New plaintext code displayed once

**Test Old Session:**
```
Employee device still has old session token:
1. Try to access /espace
2. Should be redirected to /connexion-employe (session invalid)
3. Must login with NEW code: `34567892`
```

**Test New Login:**
```
1. Go to /connexion-employe
2. Enter phone: "77 123 45 67"
3. Enter new code: "34567892"
4. Should login successfully
5. New `EmployeeSession` created
```

**Audit:**
- `AuditLog`: action = "GENERATE_EMPLOYEE_ACCESS_CODE", userId = admin-id
- Previous `EmployeeSession` deleted

---

### Scenario 7: Responsable Scope — Regenerate for Own Team Only

**Setup:**
1. User "Alice" = Responsable for Team "Pointage"
2. Employee "Jean" = in Team "Pointage"
3. Employee "Marie" = in Team "Livraison"

**Steps (as Responsable Alice):**
```
Go to /employes?team=pointage
Find Jean → Click "Régénérer le code"
✓ Code regenerated
```

**Expected Failure:**
```
Try to access /employes/[marie-id]
Click "Régénérer le code"
✗ Error: "Accès réservé aux administrateurs" OR "Hors de votre périmètre"
```

**Implementation Note:**
- Current code does NOT restrict by team yet (all responsables can regenerate)
- This scenario assumes future implementation of team/site-level scoping

---

### Scenario 8: Phone Formats Normalize to Same Employee

**Setup:**
1. Create employee with phone stored as `+221771234567`

**Steps:**
```
Login Test 1:
  Phone input: "77 123 45 67"
  toE164() → "+221771234567"
  Find employee: ✓

Login Test 2:
  Phone input: "77-123-4567"
  toE164() → "+221771234567"
  Find employee: ✓

Login Test 3:
  Phone input: "+221 77 123 45 67"
  toE164() → "+221771234567"
  Find employee: ✓
```

**Expected Result:**
- ✓ All formats resolve to same employee
- ✓ Can use any format, always finds correct employee

---

### Scenario 9: CSV Import → Bulk Code Generation

**Setup:**
1. Prepare CSV file (UTF-8 with BOM):
```
Prénom,Nom,Numéro,Email,Poste
Youssef,Sall,771234567,youssef@example.com,Pointeur
Fatou,Ba,778234567,fatou@example.com,Pointeur
Moussa,Diallo,779234567,moussa@example.com,Pointeur
```

**Steps (as Admin):**
```
1. Go to /employes
2. Click "Importer (CSV)"
3. Upload file
4. Click "Importer"
```

**Expected Result:**
- ✓ 3 employees created in DB
- ✓ 3 `EmployeeAccessCode` rows created (one per employee)
- ✓ Success page displays:
  ```
  3 employés importés avec succès.
  
  [TABLE: Prénom | Nom | Code d'accès | Date expiration]
  Youssef Sall  34567892  Oct 29, 2026
  Fatou Ba      23456789  Oct 29, 2026
  Moussa Diallo 34678901  Oct 29, 2026
  
  [Button: Télécharger les codes (CSV)]
  [Button: Partager par WhatsApp]
  ```
- ✓ Codes shown plaintext only on this screen
- ✓ Can download CSV for bulk distribution

---

### Scenario 10: WhatsApp Share Button → Correct wa.me Link

**Setup:**
1. Code generated for employee with phone `+221771234567`
2. Plaintext code displayed (e.g., `32455432`)

**Steps:**
```
Click "Envoyer par WhatsApp"
Link should be:
https://wa.me/221771234567?text=Bienvenue%20sur%20Manguifi%20!%0A%0ACode%20d%27acc%C3%A8s%20%3A%2032455432%0A%0AV%C3%A9rifiez%20%3A%20https%3A%2F%2Fmanguifi.sn%2Fconnexion-employe
```

**URL Breakdown:**
- `wa.me/221771234567` — phone without +
- `?text=...` — URL-encoded message:
  ```
  Bienvenue sur Manguifi !
  
  Code d'accès : 32455432
  
  Vérifiez : https://manguifi.sn/connexion-employe
  ```

**Expected Behavior:**
- ✓ On mobile: Opens WhatsApp app with pre-filled message
- ✓ On desktop: Opens browser WhatsApp web
- ✓ Message shows code clearly
- ✓ Phone number is E.164 normalized

---

### Scenario 11: Generate Absence/OT Report + Share

**Setup:**
1. Employee logged in with access code (from previous scenarios)
2. Has attendance records (present, absent, overtime)

**Steps:**
```
1. Go to /espace/justificatifs (or /espace/historique for OT report)
2. Select date range
3. Click "Télécharger rapport PDF"
   OR "Partager le rapport"
```

**Expected Result:**
- ✓ PDF generated with:
  - Employee name, date range
  - Absences (dates, reasons)
  - Overtime (dates, hours)
  - NO sensitive data (wages, rates)
- ✓ "Partager" button uses native share (Web Share API or Android intent)
- ✓ Can select WhatsApp as destination
- ✓ Report file sent via WhatsApp

---

### Scenario 12: Employee Deactivated → Session Revoked

**Setup:**
1. Employee Jean logged in (active `EmployeeSession`)
2. Has device with session token

**Steps (as Admin):**
```
1. Go to /employes/[jean-id]
2. Find "Désactiver" button
3. Click → confirm
```

**Expected Result:**
- ✓ `Employee.status` changed to "INACTIF"
- ✓ **`EmployeeSession` deleted** for Jean
- ✓ Jean's session token now invalid

**Test Session Loss:**
```
On Jean's device:
1. Try to access /espace
2. Session validation fails (employee status = INACTIF)
3. Redirected to /connexion-employe with error:
   "Compte désactivé"
4. Cannot login even with old code (employee inactive)
```

**Audit:**
- `AuditLog`: action = "EMPLOYEE_DEACTIVATED" or similar

---

### Scenario 13: Regression — Existing Features Still Work

#### 13a. Admin Login (Email + Password + OTP)

```
1. Go to /connexion
2. Email: admin@example.com
3. Password: [password]
4. Submit → Resend sends OTP email
5. Enter OTP → Login successful
✓ Dashboard accessible
```

#### 13b. Responsable Login (Email + Password)

```
1. Go to /connexion
2. Email: responsable@example.com
3. Password: [password]
4. Submit → Logged in
✓ Responsable dashboard accessible
✓ Can see only their team's employees
```

#### 13c. QR Code Attendance (Employee)

```
1. Login as Employee (via access code)
2. Go to /espace/scanner
3. Scan QR code (on site)
✓ Attendance marked (checkin/checkout)
✓ GPS captured
✓ Timestamp recorded
```

#### 13d. GPS Verification

```
1. Go to /espace/scanner
2. Should request location permission
✓ GPS coordinates captured
✓ Stored with attendance record
```

#### 13e. Planning View

```
1. Admin: /planning
2. See employee schedule by team/site
✓ Can view full month
✓ Color-coded (worked, absent, OT)
```

#### 13f. Export CSV (Wave / Orange Money)

```
1. Admin: /rapports
2. Select date range
3. Click "Exporter (Wave)" OR "Exporter (Orange Money)"
✓ CSV generated with proper format
✓ Contains: employee name, amount, date
✓ No sensitive fields
```

---

## Test Execution Checklist

Run before considering PHASE 3 complete:

- [ ] Jest tests pass: `npm test`
- [ ] Scenario 1: Create employee + code visible once
- [ ] Scenario 2: Login + session active + persistence
- [ ] Scenario 3: Code reuse rejected
- [ ] Scenario 4: Expired code rejected
- [ ] Scenario 5: Rate limiting 5 attempts → block 15 min
- [ ] Scenario 6: Admin regenerate → old session revoked
- [ ] Scenario 7: Responsable scope (or documented as TODO)
- [ ] Scenario 8: Phone format normalization
- [ ] Scenario 9: CSV import + code generation
- [ ] Scenario 10: WhatsApp link correct
- [ ] Scenario 11: PDF report generation + share
- [ ] Scenario 12: Deactivated employee → session lost
- [ ] Scenario 13a-f: Regressions (existing features)

---

## Known Limitations & TODOs

1. **Scenario 7** (Responsable scope): Not yet implemented
   - All responsables can regenerate for any employee
   - Future: Restrict to managed team/site

2. **Scenario 9** (CSV import): Depends on UI implementation
   - Core code generation works
   - Import/export UI not yet built

3. **Scenario 11** (Report sharing): Depends on report generation
   - WhatsApp link works
   - Report PDF generation exists but may need updates

4. **Manual Testing Only**: No automated integration tests
   - Jest covers unit level
   - E2E tests would require DB setup + Playwright/Cypress
   - Recommended for PHASE 4 (Audit) before production

---

## Next Steps (PHASE 4)

- [ ] Security audit (IDOR, SQLi, XSS, CORS, etc.)
- [ ] Performance testing (rate limiting edge cases)
- [ ] Database migration testing (on staging DB)
- [ ] Deployment checklist
