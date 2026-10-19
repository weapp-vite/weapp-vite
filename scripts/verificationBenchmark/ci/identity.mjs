import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { validateNativePrContext } from '../../../.github/scripts/native-pr-context.mjs'

const identityKeys = ['repository', 'prNumber', 'runId', 'runAttempt', 'event', 'workflow', 'headSha', 'baseSha', 'driverSha', 'checkoutSha', 'checkoutMode']
const sha = value => /^[a-f\d]{40}$/u.test(value ?? '')
const positiveInteger = value => Number.isSafeInteger(value) && value > 0

export function validateCiConfiguration(configuration, repository, runId) {
  const identity = configuration?.identity
  if (configuration?.schemaVersion !== 1 || !identity
    || ['inputDigest', 'scopeDigest'].some(key => Object.hasOwn(configuration, key))
    || Object.keys(identity).length !== identityKeys.length || identityKeys.some(key => !Object.hasOwn(identity, key))
    || Object.keys(identity).some(key => !identityKeys.includes(key))
    || identity.repository !== repository || String(identity.runId) !== String(runId)
    || !['prNumber', 'runId', 'runAttempt'].every(key => positiveInteger(identity[key]))
    || identity.event !== 'pull_request' || identity.workflow !== '.github/workflows/ci-pr.yml'
    || identity.checkoutMode !== 'merge' || identity.checkoutSha !== identity.driverSha
    || !['headSha', 'baseSha', 'driverSha', 'checkoutSha'].every(key => sha(identity[key]))) {
    throw new Error('Missing or invalid frozen CI identity; unknown identity fields are rejected')
  }
  const cohort = configuration.cohort
  if (!cohort || typeof cohort.id !== 'string' || !cohort.id || !['baseline', 'candidate'].includes(cohort.variant)) {
    throw new Error('Missing benchmark cohort configuration')
  }
}

export function validateCiRun(run, identity) {
  if (run.id !== identity.runId || run.run_attempt !== identity.runAttempt || run.event !== identity.event
    || run.path !== identity.workflow || run.head_sha !== identity.headSha
    || run.repository?.full_name !== identity.repository || !positiveInteger(run.repository.id)
    || !positiveInteger(run.head_repository?.id) || !run.head_repository.full_name
    || !Number.isFinite(Date.parse(run.run_started_at)) || !Number.isFinite(Date.parse(run.updated_at))) {
    throw new Error('CI run identity does not match the frozen configuration')
  }
}

export { currentAttemptArtifacts, validateArtifact } from '../../../.github/scripts/verification-artifacts.mjs'

/** 冻结 artifact 与实际 merge parent 双重绑定，不能只信 workflow 的 head SHA。 */
export async function validateCiContext(directory, run, identity, get) {
  if (!Array.isArray(run.pull_requests) || !run.pull_requests.length) {
    throw new Error('Frozen CI context cannot be verified: run has no original pull_request identity metadata')
  }
  const context = validateNativePrContext(JSON.parse(await readFile(path.join(directory, 'context.json'), 'utf8')), run, identity.repository)
  if (Number(context.runAttempt) !== run.run_attempt || context.headRepository !== run.head_repository.full_name
    || identityKeys.filter(key => key !== 'workflow').some(key => String(context[key]) !== String(identity[key]))) {
    throw new Error('Frozen CI context identity or attempt mismatch')
  }
  const commit = await get(`repos/${identity.repository}/git/commits/${context.checkoutSha}`)
  if (commit.sha !== context.checkoutSha || !sha(commit.tree?.sha) || commit.parents?.length !== 2
    || commit.parents[0].sha !== context.baseSha || commit.parents[1].sha !== context.headSha) {
    throw new Error('Frozen CI checkout is not the verified base/head merge commit')
  }
  return {
    context: { ...context, treeSha: commit.tree.sha },
    sourceFingerprint: createHash('sha256').update(JSON.stringify([identity.repository, commit.sha, commit.tree.sha])).digest('hex'),
  }
}
