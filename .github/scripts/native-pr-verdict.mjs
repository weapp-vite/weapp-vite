import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { validateNativeContextShape } from './native-pr-identity.mjs'

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const sortedKeys = value => Object.keys(value).sort()

/** 只裁决本轮已冻结的完整任务切片，不读取远端或把旧快照宣称为最新主线验收。 */
export function assertNativePrVerdict(context, needs, profiles) {
  validateNativeContextShape(context)
  assert(record(profiles) && Object.keys(profiles).length > 0, 'Invalid native PR profiles')
  const names = Object.keys(profiles)
  assert(names.every(name => !['approval', 'plan', 'documentation', 'verdict'].includes(name)), 'Invalid native PR profile job ID')
  assert(record(context.selections), 'Invalid frozen profile selections')
  assert.deepEqual(sortedKeys(context.selections), [...names].sort(), 'Incomplete or unknown frozen profile selections')
  assert(names.every(name => typeof context.selections[name] === 'boolean'), 'Invalid frozen profile selection')
  assert.equal(typeof context.documentationOnly, 'boolean', 'Invalid frozen documentation selection')
  const selected = names.filter(name => context.selections[name])
  assert(context.documentationOnly ? selected.length === 0 : selected.length > 0, 'Frozen snapshot must select profiles or documentation only')
  assert(record(needs), 'Invalid native PR job results')
  assert.deepEqual(sortedKeys(needs), ['approval', 'plan', ...names, 'documentation'].sort(), 'Incomplete or unknown native PR job results')
  for (const name of ['approval', 'plan', ...names, 'documentation']) {
    const expected = name === 'approval' || name === 'plan' || (name === 'documentation' ? context.documentationOnly : context.selections[name]) ? 'success' : 'skipped'
    assert(record(needs[name]), `Invalid native PR job result: ${name}`)
    assert.equal(needs[name].result, expected, `Native PR job ${name} must be ${expected}`)
  }
  return context
}

async function main() {
  const profiles = JSON.parse(await readFile(new URL('../pr-checks.json', import.meta.url), 'utf8'))
  const context = assertNativePrVerdict(JSON.parse(process.env.PR_FROZEN_CONTEXT), JSON.parse(process.env.PR_NEEDS_JSON), profiles)
  process.stdout.write(`PR snapshot checks passed for frozen merge ${context.checkoutSha} (base ${context.baseSha}, head ${context.headSha}).\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
