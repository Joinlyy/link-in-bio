// Runs a rolled-back SQL test file against the linked Supabase project.
// Any "-- @MIGRATION@" line is replaced with migrations that aren't applied yet, so they're tested too.
// Usage: node scripts/security-tests/run-sql.mjs scripts/security-tests/upi.sql
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'sec-'))
const query = (sqlText) => {
  const file = join(dir, `q${Date.now()}.sql`)
  writeFileSync(file, sqlText)
  return execFileSync('npx', ['supabase', 'db', 'query', '--linked', '-f', `"${file}"`], { encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'inherit'] })
}

const applied = new Set(JSON.parse((s => s.slice(s.indexOf('{')))(query('select version from supabase_migrations.schema_migrations'))).rows.map((r) => r.version))
const pending = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql') && !applied.has(f.split('_')[0])).sort()
const sql = readFileSync(process.argv[2], 'utf8').replace(/^-- @MIGRATION@.*$/m, () => pending.map((f) => readFileSync(join('supabase/migrations', f), 'utf8')).join('\n') || '-- nothing pending')

const out = query(sql)
const result = JSON.parse(out.slice(out.indexOf('{')))
if (!result.rows) {
  console.log(out)
  process.exit(1)
}
for (const r of result.rows) console.log(r.result, r.test, '|', r.detail)
const failed = result.rows.filter((r) => r.result !== 'PASS').length
console.log(`\n${result.rows.length - failed} passed, ${failed} failed${pending.length ? ` (with ${pending.join(', ')} run inside the test, then rolled back)` : ''}`)
process.exit(failed ? 1 : 0)
