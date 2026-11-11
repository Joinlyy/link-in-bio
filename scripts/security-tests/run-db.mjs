// Runs db-access.sql against the linked Supabase project inside one transaction that always rolls back.
// While the hardening migration isn't applied yet, it is run first inside the same transaction.
// Usage: node scripts/security-tests/run-db.mjs
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const MIGRATION = 'supabase/migrations/20261110000100_security_hardening.sql'
const dir = mkdtempSync(join(tmpdir(), 'sec-'))
const query = (sqlText) => {
  const file = join(dir, `q${Date.now()}.sql`)
  writeFileSync(file, sqlText)
  return execFileSync('npx', ['supabase', 'db', 'query', '--linked', '-f', `"${file}"`], { encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'inherit'] })
}
const applied = /"applied":\s*true/.test(query("select to_regclass('public.app_settings') is not null as applied"))
let sql = readFileSync('scripts/security-tests/db-access.sql', 'utf8')
// A function replacement keeps the migration's $$ quoting intact
sql = sql.replace(/^-- @MIGRATION@.*$/m, () => (applied ? '-- migration already applied' : readFileSync(MIGRATION, 'utf8')))
const out = query(sql)
const { rows } = JSON.parse(out.slice(out.indexOf('{')))
for (const r of rows) console.log(r.result, r.test, '|', r.detail)
const failed = rows.filter((r) => r.result !== 'PASS').length
console.log(`\n${rows.length - failed} passed, ${failed} failed${applied ? '' : ' (migration run inside the test, then rolled back)'}`)
process.exit(failed ? 1 : 0)
