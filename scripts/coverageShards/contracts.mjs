import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 读取当前工作目录实际解析的 pnpm 版本，避免声明版本冒充运行身份。
import { execa } from 'execa'

export const hash = value => createHash('sha256').update(value).digest('hex')
export const digestFile = async filename => hash(await readFile(filename))
export const readJson = async filename => JSON.parse(await readFile(filename, 'utf8'))

/** 测试归属使用项目名与仓库相对路径，避免同文件的不同项目互相覆盖。 */
export function normalizeInventory(entries, root) {
  return entries.map((entry) => {
    const file = path.relative(root, path.resolve(root, entry.file)).replaceAll('\\', '/')
    assert(file && !file.startsWith('../') && !path.isAbsolute(file), 'Coverage test escaped repository')
    return { file, projectName: entry.projectName ?? '' }
  }).sort((a, b) => `${a.projectName}:${a.file}`.localeCompare(`${b.projectName}:${b.file}`))
}

export const inventoryKey = entry => JSON.stringify([entry.projectName, entry.file])

export function verifyCoveragePlan(plan, identity) {
  const { planHash, ...data } = plan
  assert.equal(plan.schemaVersion, 1, 'Unsupported coverage plan')
  assert.equal(hash(JSON.stringify(data)), planHash, 'Coverage plan digest mismatch')
  assert.deepEqual(plan.identity, identity, 'Coverage plan identity mismatch')
  assert(Number.isSafeInteger(plan.shards) && plan.shards > 0, 'Invalid coverage shard count')
  assert(plan.inventory.length > 0, 'Empty coverage inventory')
  for (const entry of plan.inventory) {
    assert(typeof entry.file === 'string' && entry.file && !entry.file.includes('\\') && !entry.file.startsWith('/')
      && !entry.file.split('/').includes('..') && !path.win32.isAbsolute(entry.file) && typeof entry.projectName === 'string', 'Invalid coverage inventory path')
  }
}

/** 所有分片与合并进程必须使用同一源码、工具链和测试发现配置。 */
export async function coverageIdentity(root, commit = process.env.BUILD_ARTIFACT_EXPECTED_COMMIT || process.env.GITHUB_SHA, execute = execa) {
  assert(/^[a-f\d]{40}$/u.test(commit ?? ''), 'Coverage requires an immutable commit')
  const configFiles = ['pnpm-lock.yaml', 'vitest.config.mts', 'vitest.coverage.ts']
  const files = await Promise.all(configFiles.map(async file => [file, await digestFile(path.join(root, file))]))
  const pnpmVersion = (await execute('pnpm', ['--version'], { cwd: root })).stdout.trim()
  assert(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/u.test(pnpmVersion), 'Invalid actual pnpm version')
  return { commit, nodeVersion: process.version, nodeMajor: process.versions.node.split('.')[0], packageManager: `pnpm@${pnpmVersion}`, os: process.platform, arch: process.arch, configHash: hash(JSON.stringify(files)) }
}

/** 缺失、重复、失败或不完整分片均拒绝合并，不用局部成功替代完整验证。 */
export function verifyCoverageShards(plan, reports, identity) {
  verifyCoveragePlan(plan, identity)
  assert.equal(reports.length, plan.shards, 'Missing coverage shards')
  const indices = new Set()
  const observed = []
  for (const report of reports) {
    assert.equal(report.schemaVersion, 1, 'Unsupported coverage shard')
    assert.equal(report.planHash, plan.planHash, 'Coverage shard plan mismatch')
    assert.deepEqual(report.identity, identity, 'Coverage shard identity mismatch')
    assert.equal(report.status, 'passed', 'Failed coverage shard')
    assert(Number.isFinite(report.durationMs) && report.durationMs >= 0, 'Invalid coverage shard duration')
    assert(Number.isSafeInteger(report.index) && report.index >= 1 && report.index <= plan.shards && !indices.has(report.index), 'Duplicate or invalid coverage shard')
    indices.add(report.index)
    observed.push(...report.inventory.map(inventoryKey))
  }
  const expected = plan.inventory.map(inventoryKey).sort()
  assert.equal(new Set(expected).size, expected.length, 'Duplicate expected coverage tests')
  assert.deepEqual(observed.sort(), expected, 'Coverage test inventory is incomplete or duplicated')
}
