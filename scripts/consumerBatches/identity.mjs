import assert from 'node:assert/strict'
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

export function assertConsumerEvidence(value, identity, host, node) {
  assert.equal(value.schemaVersion, 1, 'Unsupported consumer evidence')
  assert.equal(value.toolchain, host, 'Consumer evidence host mismatch')
  assert.equal(value.node.replace(/^v/u, ''), node.replace(/^v/u, ''), 'Consumer evidence Node mismatch')
  assert.equal(value.platform, identity.os, 'Consumer evidence OS mismatch')
  assert.equal(value.arch, identity.arch, 'Consumer evidence architecture mismatch')
}
