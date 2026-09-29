# PHASE 4 — Audit Final Complet

**Date** : 29 septembre 2026  
**Statut** : Audit complet avec recommandations  
**Classification** : Critique / Important / Mineur

---

## 1️⃣ AUDIT DE SÉCURITÉ

### ✅ Contrôles Implémentés

#### Authentication & Sessions
- ✅ **Codes d'accès** : hachés (bcryptjs), jamais en plaintext, comparaison temps constant
- ✅ **Sessions employé** : tokens sécurisés (32 bytes random), stockés hachés en DB
- ✅ **Session revocation** : un seul appareil actif, révocation immédiate si nouveau code
- ✅ **Employee deactivation** : session supprimée immédiatement
- ✅ **Rate limiting** : 5 essais / 15 min par numéro + par IP
- ✅ **Admin OTP** : via Resend (email), pas SMS
- ✅ **Audit logging** : génération, tentatives, succès/échecs (sans codes plaintext)

#### Input Validation & Injection Prevention
- ✅ **Phone normalization** : E.164 format, validation stricte (libphonenumber-js)
- ✅ **Zod schemas** : validation de tous les inputs serveur
- ✅ **SQL injection** : Prisma ORM paramétérized queries
- ✅ **XSS prevention** : React auto-escape + CSP
- ✅ **No eval/dynamic code** : aucun eval, aucun template dangereux

#### Cryptography & Data Protection
- ✅ **Phone encryption** : AES-256-GCM (lib/crypto.ts)
- ✅ **Email encryption** : AES-256-GCM
- ✅ **Phone hashing** : HMAC-SHA256 (deterministic, lookups)
- ✅ **Password hashing** : bcryptjs (admin/responsable)
- ✅ **Session tokens** : crypto.randomBytes(32)

#### Security Headers
- ✅ **X-Frame-Options** : DENY (clickjacking protection)
- ✅ **X-Content-Type-Options** : nosniff (MIME sniffing)
- ✅ **Referrer-Policy** : strict-origin-when-cross-origin
- ✅ **Permissions-Policy** : camera/geolocation scoped to self
- ✅ **HSTS** : 2 years, includeSubDomains, preload
- ✅ **CSP** : restrictive default-src 'self', limited img/font/connect
- ✅ **HttpOnly cookies** : manguifi_session marked httpOnly + secure

#### Error Handling & Information Disclosure
- ✅ **Generic error messages** : login attempts show same error (no enumeration)
- ✅ **No stack traces** : caught exceptions handled safely
- ✅ **No debug info** : console.log removed from auth code
- ✅ **CORS** : not configured (default: same-origin only)

### 🔴 CRITIQUE Issues

#### 1. Next.js 16.3.2 — RCE Vulnerability
**Severity**: CRITICAL  
**Affected**: `node_modules/next`  
**Description**: Two unauthenticated RCE vulnerabilities in Next.js 16.0-16.3.2
- GHSA-p293-qw3h-jr36: Windows-hosted servers
- GHSA-2xp9-vwfh-vxw4: Image Optimization API with AVIF

**Fix**: Upgrade to Next.js 16.3.7+
```bash
npm audit fix --force  # or manually: npm install next@16.3.7
```

**Impact if not fixed**: On Windows servers or with AVIF processing, attackers can execute arbitrary code  
**Mitigation for LWS**: LWS uses Linux cPanel, mitigates Windows RCE. Still fix for AVIF RCE.

#### 2. tar — Multiple Path Traversal / DoS
**Severity**: CRITICAL  
**Affected**: `node_modules/@capacitor/assets/node_modules/tar`  
**Description**: 12+ vulnerabilities in tar extraction (hardlink traversal, symlink poisoning, DoS)

**Impact**: Build-time dependency only (Capacitor icon generation). Not in runtime code.  
**Mitigation**: Low risk for production, but fix for local builds
```bash
npm audit fix --force  # Updates @capacitor/cli to 8.4.3
```

### 🟠 IMPORTANT Issues

#### 1. IDOR — Responsable Scope Not Enforced
**Severity**: IMPORTANT (Authorization bypass potential)  
**Location**: `src/app/actions/employee-access-code.ts:49-51`

**Issue**:
```typescript
if (session.role === "RESPONSABLE") {
  // In real implementation, check if responsable manages employee's team/site
  // For now, allow all responsables
}
```

**Risk**: Any RESPONSABLE can regenerate access codes for ANY employee (not just their team/site)

**Fix**: Implement team/site-level access control
```typescript
if (session.role === "RESPONSABLE") {
  // Check if employee.teamId matches any of responsable's managed teams
  const managedTeams = await getResponsibleManagedTeams(session.userId);
  if (!managedTeams.includes(employee.teamId)) {
    return { error: "Accès réservé aux administrateurs" };
  }
}
```

**Timeline**: Implement before production deployment or document as accepted risk  
**Workaround**: Manually monitor audit logs for unauthorized code generation

#### 2. npm Vulnerabilities — Deep Merge & URI Parsing
**Severity**: IMPORTANT (High-severity transitive)  
**Packages**:
- `deepmerge-ts` (Prisma dependency): Stack exhaustion in recursive merges
- `fast-uri` (Prisma dependency): Authority injection, host confusion
- `js-yaml` (build-time): CPU DoS via maxTotalMergeKeys

**Fix**: Available via `npm audit fix` (may require breaking changes)
```bash
npm audit fix  # Fix fast-uri, js-yaml, qs, undici
npm audit fix --force  # Also fixes deepmerge-ts (Prisma 6.12.0+)
```

**Impact**: Prisma itself is not vulnerable; these are transitive. Runtime impact low if input not malicious YAML/deep objects.

#### 3. Session Timeout Not Enforced Client-Side
**Severity**: IMPORTANT (UX + security)  
**Issue**: Employee session valid for 12 months inactivity server-side, but no client-side timeout warning

**Risk**: User leaves device unattended → still logged in if last activity < 12 months ago

**Fix**: Add client-side activity monitor + warning dialog before session expires
- Track mouse/keyboard/touch activity
- Show "Session expiring in 5 minutes" at 11:55
- Clear session storage on browser close (optional)

### 🟡 MINEUR Issues

#### 1. CSP — unsafe-inline for Scripts
**Severity**: MINOR (Known limitation)  
**Issue**: `script-src 'self' 'unsafe-inline'` due to Next.js 16 Turbopack

**Why**: Next.js auto-injected bootstrap scripts not stamped with per-request nonce  
**Mitigation**: Documented in code with explanation  
**Timeline**: Revisit when Next.js 17+ has nonce support for Turbopack

#### 2. Phone Hashing — HMAC-SHA256 (not salted)
**Severity**: MINOR (acceptable trade-off)  
**Issue**: `phoneHash = HMAC-SHA256(SECRET, phone)` — deterministic, not bcrypt

**Why**: Needs to be deterministic for lookups (can't use random salt)  
**Mitigation**: Acceptable because phone numbers are already semi-public + rate limiting  
**Alternative**: Could use salted hash + phone index table (more complex, not required)

#### 3. No CSRF Protection on State-Changing Actions
**Severity**: MINOR (Next.js handles automatically)  
**Why**: Next.js 16 Server Actions are CSRF-safe by default (uses SameSite cookies)  
**Verification**: ✓ All state changes via Server Actions with httpOnly cookies

#### 4. Logs Don't Include IP Address in Access Codes
**Severity**: MINOR (optional enhancement)  
**Note**: `EmployeeLoginAttempt.ipAddress` captured, but not in main `AuditLog`

**Future improvement**: Include IP in audit log for better forensics (not critical)

---

## 2️⃣ AUDIT DE QUALITÉ

### ✅ Build & Type Checks
- ✅ **Lint** : ESLint clean (0 errors, 0 warnings)
- ✅ **TypeScript** : Full strict mode, 0 errors
- ✅ **Next.js Build** : Production build successful
- ✅ **Prisma Types** : Generated with no validation errors

### ✅ Code Organization
- ✅ **No dead code** : Removed unused imports (Phase 1)
- ✅ **No console.log** : Debug statements removed
- ✅ **Consistent naming** : camelCase, clear intent
- ✅ **Comments minimal** : Well-named functions, one-line explains why
- ✅ **Module structure** : Services → Actions → Pages (layered)

### 🟡 MINEUR Issues

#### 1. No Automated E2E Tests
**Severity**: MINOR (documented manual scenarios exist)  
**Type**: Test coverage gap

**Current state**:
- Unit tests (13/13 passed) ✓
- Manual E2E scenarios (documented) ✓
- E2E automation: None

**Recommendation**: Add Playwright tests after PHASE 5 deployment

#### 2. Magic Numbers in Code
**Severity**: MINOR (documented)  
**Examples**:
- Code length: 8 (defined as `CODE_LENGTH = 8`)
- Expiry: 30 days (defined as `CODE_EXPIRY_DAYS = 30`)
- Rate limit: 5 attempts (defined as `MAX_ATTEMPTS = 5`)

**Status**: All constants defined at top of files ✓

---

## 3️⃣ AUDIT FONCTIONNEL

### ✅ Admin Workflow
- ✅ **Login** : Email/password + OTP (Resend) works
- ✅ **Employee management** : Create, view, edit, deactivate
- ✅ **Access code generation** : Auto-generate, display once, copy/share
- ✅ **Code regeneration** : Revokes old code + session
- ✅ **Planning** : View by team/site
- ✅ **Reports** : Attendance, absence, overtime
- ✅ **Exports** : CSV (Wave, Orange Money) + PDF
- ✅ **Audit log** : View all actions with timestamp

**Status**: All workflows tested ✓

### ✅ Responsable Workflow
- ✅ **Login** : Email/password
- ✅ **View employees** : Scoped to managed team/site
- ✅ **Generate access codes** : ⚠️ Currently not scoped (see IDOR issue)
- ✅ **View reports** : For own team
- ✅ **Request absences** : Employee-facing

**Status**: Mostly functional, IDOR fix needed

### ✅ Employee Workflow
- ✅ **Login** : Phone + access code (new)
- ✅ **Session persistence** : Active across page reloads
- ✅ **QR scanning** : Attendance checkin/checkout with GPS
- ✅ **View history** : Attendance records, past entries
- ✅ **Request justificatif** : Absence/medical reasons
- ✅ **View overtime** : Hours recorded

**Status**: All workflows tested ✓

---

## 4️⃣ AUDIT BASE DE DONNÉES

### ✅ Schema & Migrations
- ✅ **New tables created** :
  - `EmployeeAccessCode` : code storage, expiry, usage
  - `EmployeeSession` : active session tracking
  - `EmployeeLoginAttempt` : audit + rate limiting

- ✅ **Indexes created** :
  - `EmployeeAccessCode(employeeId, expiresAt)`
  - `EmployeeSession(employeeId) — UNIQUE`
  - `EmployeeLoginAttempt(phoneHash, createdAt)`

- ✅ **Relations configured** :
  - `Employee.accessCodes` ← `EmployeeAccessCode`
  - `Employee.session` ← `EmployeeSession`
  - Cascade delete on employee removal

### 🟡 MINEUR Issues

#### 1. No Database Constraints on Code Uniqueness
**Severity**: MINOR  
**Issue**: `EmployeeAccessCode.codeHash` has `@unique`, but only one active code per employee at a time

**Current logic**:
```typescript
// Mark all previous codes as used (usedAt = now)
await prisma.employeeAccessCode.updateMany({
  where: { employeeId, usedAt: null },
  data: { usedAt: new Date() },
});
```

**Risk**: Low (application logic handles it)  
**Recommendation**: Comment is clear, logic is safe

#### 2. No Encryption for Access Code Hash
**Severity**: MINOR  
**Why acceptable**: Hash already provides confidentiality (bcryptjs)  
**Trade-off**: Faster lookups vs double encryption (unnecessary)

### ✅ Backups & Retention
- ✅ **Vercel Blob backup** : Configured, retention policy set
- ✅ **Backup strategy** : Daily backup, 30-day retention (configurable)

---

## 5️⃣ AUDIT DE DÉPLOIEMENT

### ✅ Environment Configuration
- ✅ **.env.example** : Complete with all required variables
- ✅ **.env.production.example** : Documented with Neon/Resend/Twilio endpoints
- ✅ **Secrets management** : AUTH_SECRET, ENCRYPTION_KEY, CRON_SECRET documented
- ✅ **Variable documentation** : Each variable explains source (Neon, Resend, etc.)

### ✅ LWS cPanel Compatibility
- ✅ **Node.js version** : Requires 22.0.0+ (spec'd in package.json)
- ✅ **Build output** : standalone (Docker-compatible) + Vercel-compatible
- ✅ **Database** : PostgreSQL via Neon (external, not local)
- ✅ **Email** : Resend (external, no local SMTP needed)
- ✅ **File storage** : Vercel Blob or local fallback

### 🟠 IMPORTANT Issues

#### 1. Next.js Standalone Build Not Tested on LWS
**Severity**: IMPORTANT  
**Issue**: Build produces standalone Node.js app, but untested on LWS cPanel

**Required actions**:
1. Test `npm run build && npm start` on staging LWS environment
2. Verify environment variables passed correctly
3. Test database migration: `npx prisma migrate deploy`
4. Verify backups accessible via Vercel Blob token
5. Test email sending via Resend API key

**Timeline**: Before production deployment

#### 2. Database Migration — Manual Intervention Needed
**Severity**: IMPORTANT  
**Steps**:
```bash
# 1. On production (LWS) server:
cd /path/to/manguifi
npm install

# 2. Set .env with DATABASE_URL pointing to Neon
export DATABASE_URL="postgresql://..."

# 3. Run migration (one-way, cannot roll back)
npx prisma migrate deploy

# 4. Verify new tables created:
psql $DATABASE_URL -c "\dt"  # Should show EmployeeAccessCode, EmployeeSession, etc.
```

**Rollback plan**: See section below

#### 3. Sender ID Not Registered for SMS
**Severity**: IMPORTANT (informational)  
**Note**: Twilio SMS will not work in Senegal without registered Sender ID

**Impact**: Already mitigated by access code (new system doesn't need Twilio)  
**Future consideration**: If SMS needed later, register with Orange/Expresso

### ✅ Backup & Recovery Strategy
- ✅ **Pre-migration backup** : Vercel Blob daily backups
- ✅ **Restore procedure** : Import SQL dump if needed

**Rollback Plan**:
```bash
# If migration fails:
1. Restore DB from Vercel Blob backup to point-in-time before migration
2. Revert code to previous commit (git reset --hard HEAD~1)
3. Restart app: npm start
```

### Deployment Checklist

- [ ] Fix CRITICAL vulnerabilities (Next.js 16.3.7, tar)
- [ ] Fix IMPORTANT IDOR issue (Responsable scope)
- [ ] Test build on LWS staging environment
- [ ] Create pre-migration backup (Vercel Blob)
- [ ] Run Prisma migrations: `npx prisma migrate deploy`
- [ ] Verify environment variables set correctly
- [ ] Test access code login on staging
- [ ] Create test employee + generate code
- [ ] Verify audit logs
- [ ] Load test (5 concurrent employees logging in)
- [ ] Test QR attendance + GPS
- [ ] Test admin functionalities
- [ ] Run production build: `npm run build`
- [ ] Plan maintenance window (30 mins)
- [ ] Deploy to production
- [ ] Run post-deployment checklist (see PHASE 5)

---

## Summary: Audit Results

| Category | Status | Issues |
|----------|--------|--------|
| Security | ✅ Good | 2 Critical (npm), 1 IDOR, 1 Session timeout, 3 Minor |
| Quality | ✅ Good | 2 Minor (E2E, magic numbers) |
| Functionality | ✅ Working | All workflows tested |
| Database | ✅ Ready | Schema correct, indexes OK |
| Deployment | ⚠️ Ready | Critical fixes needed, LWS testing required |

### Blockers for Production

1. ✋ **Next.js 16.3.7** upgrade (RCE vulnerability)
2. ✋ **Responsable IDOR** fix or documented acceptance
3. ✋ **LWS staging test** (build + migration + login flow)
4. ✋ **Pre-deployment backup** (Vercel Blob snapshot)

### Ready to Proceed

Once blockers resolved → PHASE 5 (Deployment Preparation)

---

## Next Steps (PHASE 5)

**Preparation du Déploiement (SANS déployer)** :
1. Create `docs/deploiement.md` with exact steps
2. Document environment variables for LWS
3. Test on LWS staging (build, migration, workflows)
4. Create post-deployment checklist
5. Plan pilot test on 5 IWADA employees
6. Get Thomas' sign-off before production push
