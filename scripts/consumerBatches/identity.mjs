import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import process from 'node:process'

/** 运行身份包含 attempt 与实际构建工具链；同一提交的另一轮不能复用执行报告。 */
export function freezeConsumerIdentity(identity, env = process.env) {
  const result = {
    ...identity,
    repository: env.GITHUB_REPOSITORY,
    runId: String(env.GITHUB_RUN_ID),
    runAttempt: Number(env.GITHUB_RUN_ATTEMPT),
    builderNode: process.versions.node,
  }
  assertFrozenConsumerIdentity(result)
  return result
}

export function assertFrozenConsumerIdentity(identity) {
  assert(/^[a-f\d]{40}$/u.test(identity?.commit ?? ''), 'Invalid consumer commit')
  assert(typeof identity.repository === 'string' && identity.repository.includes('/'), 'Missing consumer repository')
  assert(/^[1-9]\d*$/u.test(identity.runId) && Number.isSafeInteger(identity.runAttempt) && identity.runAttempt > 0, 'Missing consumer run attempt')
  assert(['linux', 'win32', 'darwin'].includes(identity.os) && typeof identity.arch === 'string' && identity.arch, 'Missing consumer platform')
  assert(/^\d+\.\d+\.\d+$/u.test(identity.builderNode) && /^pnpm@\d+\.\d+\.\d+/u.test(identity.packageManager), 'Missing consumer builder toolchain')
}

export function assertConsumerExecutionIdentity(identity, env = process.env) {
  assertFrozenConsumerIdentity(identity)
  assert.equal(identity.repository, env.GITHUB_REPOSITORY, 'Consumer repository mismatch')
  assert.equal(identity.runId, env.GITHUB_RUN_ID, 'Consumer run mismatch')
  assert.equal(String(identity.runAttempt), env.GITHUB_RUN_ATTEMPT, 'Consumer run attempt mismatch')
  assert.equal(identity.os, process.platform, 'Consumer OS mismatch')
  assert.equal(identity.arch, process.arch, 'Consumer architecture mismatch')
}

export function assertConsumerEvidence(value, identity, host, node, profile) {
  assert.equal(value.schemaVersion, 1, 'Unsupported consumer evidence')
  assert.equal(value.toolchain, host, 'Consumer evidence host mismatch')
  assert.equal(value.node.replace(/^v/u, ''), node.replace(/^v/u, ''), 'Consumer evidence Node mismatch')
  assert.equal(value.platform, identity.os, 'Consumer evidence OS mismatch')
  assert.equal(value.arch, identity.arch, 'Consumer evidence architecture mismatch')
  if (profile === 'imports') {
    assertImportsConsumerReceipt(value.imports, host)
  }
}

/** imports 独立入口必须完成全部阶段，启动时保存的来源记录不能冒充成功。 */
export function assertImportsConsumerReceipt(value, host) {
  assert.equal(value?.toolchain, host, 'Imports consumer evidence host mismatch')
  assert.deepEqual(value.dependencies?.map(item => item.name), [host === 'vite-plus' ? '@voidzero-dev/vite-plus-core' : 'vite', 'rolldown'], 'Imports consumer dependency inventory incomplete')
  for (const dependency of value.dependencies) {
    assert(dependency.patched === false && Number.isSafeInteger(dependency.comparedFiles) && dependency.comparedFiles > 0
      && /^[a-f\d]{64}$/u.test(dependency.contentSha256) && dependency.resolved?.startsWith('https://registry.npmjs.org/')
      && typeof dependency.integrity === 'string' && dependency.integrity, 'Imports consumer requires original registry dependency evidence')
  }
  const required = [
    'main, independent and worker build; exact query key',
    'development raw source update',
    'configuration restart with changed package imports',
    'Web build',
    ...(host === 'wv' ? ['headless raw source and exact key runtime in main and independent pages'] : []),
  ]
  assert(Array.isArray(value.checks) && required.every(check => value.checks.includes(check)), 'Imports consumer completion evidence incomplete')
}

/** 聚合时同时回读原始来源证据，不能用封装报告代替缺失或漂移的原始字节。 */
export async function assertImportsConsumerEvidenceFile(filename, value, host) {
  assertImportsConsumerReceipt(value.imports, host)
  const bytes = await readFile(`${filename}.imports.json`)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), value.importsSha256, 'Imports source evidence digest mismatch')
  assert.deepEqual(JSON.parse(bytes.toString('utf8')), value.imports, 'Imports source evidence mismatch')
}
