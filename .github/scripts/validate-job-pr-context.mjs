import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { projectPrContext } from './native-pr-context.mjs'
import { validateNativeContextShape } from './native-pr-identity.mjs'

/** 实际执行任务重新校验冻结身份，避免为纯 JSON 投影单独占用 runner。 */
export function assertFrozenJobContext(context, profile, name, checkout, env = process.env) {
  assert(context?.schemaVersion === 1 && context.repository === env.GITHUB_REPOSITORY, 'Frozen job repository mismatch')
  assert(String(context.runId) === env.GITHUB_RUN_ID && String(context.runAttempt) === env.GITHUB_RUN_ATTEMPT, 'Frozen job run attempt mismatch')
  if (context.event === 'pull_request') {
    validateNativeContextShape(context)
    if (env.PR_TOPOLOGY) {
      assert.equal(context.verificationTopology ?? 'optimized-v1', env.PR_TOPOLOGY, 'Frozen job topology mismatch')
    }
    assert.equal(context.driverSha, env.GITHUB_SHA, 'Frozen job driver mismatch')
  }
  const projected = name === 'documentation'
    ? { ...context, shouldRun: context.event === 'pull_request' && context.documentationOnly === true }
    : projectPrContext(context, profile, name)
  assert.equal(projected.shouldRun, true, 'Unselected frozen job cannot execute')
  assert.equal(checkout, projected.checkoutSha, 'Frozen job checkout mismatch')
  return projected
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const profiles = JSON.parse(await readFile(new URL('../pr-checks.json', import.meta.url), 'utf8'))
  const name = process.env.PR_PROFILE
  const checkout = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  assertFrozenJobContext(JSON.parse(process.env.PR_FROZEN_CONTEXT), profiles[name], name, checkout)
}
