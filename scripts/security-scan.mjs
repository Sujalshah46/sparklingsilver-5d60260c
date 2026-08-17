#!/usr/bin/env node
/**
 * Store-build security gate.
 *
 * 1. Dependency scan  — `npm audit` on the production dependency tree; fails on
 *    any NEW high/critical advisory that is not listed in
 *    `.github/security-allowlist.json`.
 * 2. Secret-exposure scan — greps client-reachable source for server-only
 *    secret names and hardcoded credential patterns.
 *
 * Exit code 1 = build must fail.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ALLOWLIST_PATH = path.join(ROOT, '.github', 'security-allowlist.json');
const allowlist = existsSync(ALLOWLIST_PATH)
  ? JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'))
  : { advisories: [], secretMatches: [] };

const failures = [];

/* ------------------------------------------------------------------ *
 * 1. Dependency vulnerabilities
 * ------------------------------------------------------------------ */
function dependencyScan() {
  let raw;
  try {
    raw = execFileSync(
      'npm',
      ['audit', '--json', '--omit=dev', '--audit-level=high'],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (err) {
    // npm audit exits non-zero when vulnerabilities exist; stdout still holds JSON.
    raw = err.stdout?.toString() ?? '';
    if (!raw.trim()) {
      failures.push(`dependency scan could not run: ${err.message}`);
      return;
    }
  }

  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    failures.push('dependency scan returned unparsable output');
    return;
  }

  if (!report.vulnerabilities) {
    const msg =
      'dependency scan produced no vulnerability data (registry audit endpoint unavailable)';
    if (process.env.SECURITY_SCAN_ALLOW_AUDIT_SKIP === '1') {
      console.log(`dependency scan: SKIPPED — ${msg}`);
      return;
    }
    failures.push(msg);
    return;
  }



  const vulns = Object.values(report.vulnerabilities ?? {}).filter((v) =>
    ['high', 'critical'].includes(v.severity),
  );

  const news = vulns.filter((v) => !allowlist.advisories.includes(v.name));
  console.log(
    `dependency scan: ${vulns.length} high/critical package(s), ${news.length} not allowlisted`,
  );
  for (const v of news) {
    const fix = v.fixAvailable?.version
      ? `fix: ${v.fixAvailable.name}@${v.fixAvailable.version}`
      : 'no automatic fix';
    failures.push(
      `[${v.severity}] ${v.name} (${v.range}) — ${fix}` +
        (v.via?.[0]?.title ? ` — ${v.via[0].title}` : ''),
    );
  }
}

/* ------------------------------------------------------------------ *
 * 2. Secret exposure in client-reachable code
 * ------------------------------------------------------------------ */
const SERVER_ONLY_SECRETS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_PASSWORD',
  'LOVABLE_API_KEY',
  'CRON_SECRET',
  'VAPID_PRIVATE_KEY',
  'EXPO_ACCESS_TOKEN',
  'RESEND_API_KEY',
  'STRIPE_SECRET_KEY',
];

const HARDCODED_PATTERNS = [
  { name: 'Supabase secret key', re: /\bsb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: 'Service-role JWT', re: /"role"\s*:\s*"service_role"/ },
  { name: 'Stripe live secret', re: /\bsk_live_[A-Za-z0-9]{16,}/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{30,}/ },
  { name: 'Private key block', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

// Files that legitimately run only on the server.
function isServerOnly(rel) {
  return (
    /\.server\.[cm]?tsx?$/.test(rel) ||
    rel.startsWith('src/routes/api/') ||
    rel.includes('/server/')
  );
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(t|j)sx?$/.test(entry)) out.push(full);
  }
  return out;
}

function secretScan() {
  const files = walk(path.join(ROOT, 'src'));
  let checked = 0;
  for (const file of files) {
    const rel = path.relative(ROOT, file).replaceAll('\\', '/');
    const source = readFileSync(file, 'utf8');
    checked++;

    for (const { name, re } of HARDCODED_PATTERNS) {
      if (re.test(source) && !allowlist.secretMatches.includes(rel)) {
        failures.push(`hardcoded credential (${name}) in ${rel}`);
      }
    }

    if (isServerOnly(rel)) continue;

    for (const secret of SERVER_ONLY_SECRETS) {
      if (source.includes(secret) && !allowlist.secretMatches.includes(rel)) {
        failures.push(`server-only secret ${secret} referenced in client-reachable ${rel}`);
      }
    }
    if (/import\.meta\.env\.(?!(VITE_|DEV\b|PROD\b|MODE\b|SSR\b|BASE_URL\b))[A-Z_]+/.test(source)) {
      failures.push(`non-VITE_ env var read from browser code in ${rel}`);
    }
  }
  console.log(`secret-exposure scan: ${checked} source file(s) checked`);
}

dependencyScan();
secretScan();

if (failures.length) {
  console.error(`\n❌ Security gate failed with ${failures.length} finding(s):`);
  for (const f of failures) console.error(`  • ${f}`);
  console.error(
    '\nFix the finding, or add a reviewed exception to .github/security-allowlist.json.',
  );
  process.exit(1);
}

console.log('\n✅ Security gate passed — no new high/critical findings.');
