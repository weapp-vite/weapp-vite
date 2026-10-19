import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 使用跨平台启动器读取实际 pnpm 身份。
import { execa } from 'execa'
import { coverageLogicalScope } from './logicalCoverage.mjs'

export { coverageLogicalScope } from './logicalCoverage.mjs'

export const hash = value => createHash('sha256').update(value).digest('hex')
export const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'))
export async function saveJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`)
}

export function normalizeInventory(entries, root) {
  return entries.map((entry) => {
    const file = path.relative(root, path.resolve(root, entry.file)).replaceAll('\\', '/')
    assert(file && !file.startsWith('../') && !path.isAbsolute(file), 'Coverage test escaped repository')
    return { file, projectName: entry.projectName ?? '' }
  }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
}

/** 使用完整实际版本与原配置内容，不能用 packageManager 声明冒充执行身份。 */
export async function coverageIdentity(root, env = process.env, execute = execa) {
  const commit = env.BUILD_ARTIFACT_EXPECTED_COMMIT || env.GITHUB_SHA
  assert(/^[a-f\d]{40}$/u.test(commit ?? ''), 'Coverage requires an immutable commit')
  const files = await Promise.all(['pnpm-lock.yaml', 'vitest.config.mts', 'vitest.coverage.ts'].map(async file => [file, hash(await fs.readFile(path.join(root, file)))]))
  const version = (await execute('pnpm', ['--version'], { cwd: root })).stdout.trim()
  assert(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/u.test(version), 'Invalid actual pnpm version')
  return { commit, nodeVersion: process.version, nodeMajor: process.versions.node.split('.')[0], packageManager: `pnpm@${version}`, os: process.platform, arch: process.arch, configHash: hash(JSON.stringify(files)) }
}

export function coveragePlan(identity, inventory) {
  const keys = inventory.map(item => JSON.stringify([item.projectName, item.file]))
  assert(keys.length && new Set(keys).size === keys.length, 'Empty or duplicate coverage inventory')
  const data = { schemaVersion: 1, identity, shards: 1, inventory }
  return { ...data, planHash: hash(JSON.stringify(data)) }
}

/** 仅由原 Run command 成功后的步骤调用，覆盖率阈值仍由原 Vitest 进程裁决。 */
export async function finalizeBaselineCoverage(root, output, options = {}) {
  const plan = await readJson(path.join(output, 'plan.json'))
  const observed = await readJson(path.join(output, 'observed.json'))
  assert.equal(plan.planHash, coveragePlan(plan.identity, plan.inventory).planHash, 'Coverage plan was modified')
  assert.deepEqual(plan.identity, options.identity ?? await coverageIdentity(root), 'Coverage execution identity changed')
  assert.equal(options.commandSucceeded, true, 'Original coverage command did not succeed')
  assert.equal(observed.passed, true, 'Coverage reporter recorded failure')
  const report = { schemaVersion: 1, identity: plan.identity, planHash: plan.planHash, index: 1, status: 'passed', inventory: observed.inventory, cases: observed.cases, durationMs: observed.durationMs, blobHash: hash(await fs.readFile(path.join(output, 'blob.json'))) }
  assert(Number.isFinite(report.durationMs) && report.durationMs >= 0, 'Invalid coverage duration')
  const scope = coverageLogicalScope(plan, [report])
  await saveJson(path.join(output, 'manifest.json'), report)
  await saveJson(path.join(output, 'logical-scope.json'), scope)
  await saveJson(path.join(output, 'shard-verdict.json'), { schemaVersion: 1, planHash: plan.planHash, shards: 1, tests: plan.inventory.length, status: 'passed' })
  return { plan, report, scope }
}
