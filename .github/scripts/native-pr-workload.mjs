import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { matchesFilters } from './pr-context.mjs'

export const NATIVE_PR_WORKLOAD_PATH = '.github/verification-workload.json'

/** 工作量清单只从已审批 merge 的不可变 blob 读取，摘要覆盖原始字节。 */
export async function readNativePrWorkload(checkoutSha, profiles, get) {
  assert(/^[a-f\d]{40}$/u.test(checkoutSha), 'Invalid benchmark workload checkout')
  const file = await get(`/contents/${NATIVE_PR_WORKLOAD_PATH}?ref=${checkoutSha}`)
  assert(file?.type === 'file' && file.path === NATIVE_PR_WORKLOAD_PATH && file.encoding === 'base64'
    && typeof file.content === 'string' && /^[A-Z\da-z+/=\r\n]*$/u.test(file.content), 'Invalid benchmark workload blob')
  const encoded = file.content.replace(/[\r\n]/gu, '')
  const bytes = Buffer.from(encoded, 'base64')
  const blobSha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
  assert(bytes.toString('base64') === encoded && file.sha === blobSha, 'Benchmark workload blob identity mismatch')
  const value = JSON.parse(bytes.toString('utf8'))
  const keys = ['schemaVersion', 'draft', 'id', 'pullRequests', 'baseBranch', 'profiles']
  assert(value && Object.keys(value).every(key => [...keys, 'verificationTopology', 'verificationTopologyByAttempt'].includes(key)) && keys.every(key => Object.hasOwn(value, key))
    && value.schemaVersion === 1 && value.draft === false
    && (value.verificationTopology === undefined || ['optimized-v1', 'optimized-v2'].includes(value.verificationTopology))
    && (value.verificationTopologyByAttempt === undefined || (value.verificationTopologyByAttempt !== null
      && typeof value.verificationTopologyByAttempt === 'object' && !Array.isArray(value.verificationTopologyByAttempt)
      && Object.keys(value.verificationTopologyByAttempt).length > 0
      && Object.entries(value.verificationTopologyByAttempt).every(([attempt, topology]) => /^[1-9]\d*$/u.test(attempt) && Number.isSafeInteger(Number(attempt)) && ['optimized-v1', 'optimized-v2'].includes(topology))))
    && typeof value.id === 'string' && /^[a-z\d]+(?:-[a-z\d]+)*$/u.test(value.id)
    && typeof value.baseBranch === 'string' && /^[\w./-]+$/u.test(value.baseBranch)
    && Array.isArray(value.pullRequests) && value.pullRequests.length > 0
    && value.pullRequests.every(number => Number.isSafeInteger(number) && number > 0)
    && new Set(value.pullRequests).size === value.pullRequests.length
    && Array.isArray(value.profiles) && value.profiles.length > 0
    && value.profiles.every(name => typeof name === 'string' && Object.hasOwn(profiles, name))
    && new Set(value.profiles).size === value.profiles.length, 'Invalid benchmark workload manifest')
  return {
    value,
    manifest: { path: NATIVE_PR_WORKLOAD_PATH, blobSha, sha256: createHash('sha256').update(bytes).digest('hex') },
  }
}

/** 同一不可变清单可以按正式 rerun attempt 选择对照拓扑，每次仍须原生审批。 */
export function verificationTopologyForAttempt(workload, attempt) {
  assert(/^[1-9]\d*$/u.test(String(attempt)) && Number.isSafeInteger(Number(attempt)), 'Invalid verification run attempt')
  const topology = workload.verificationTopologyByAttempt?.[String(attempt)] ?? workload.verificationTopology ?? 'optimized-v1'
  assert(['optimized-v1', 'optimized-v2'].includes(topology), 'Invalid verification attempt topology')
  return topology
}

/** 普通路径检查始终保留，只有清单点名的 PR 可以在审批后追加固定检查。 */
export function selectNativePrWorkload(context, profiles, pathSelections, workload) {
  const active = workload.value.pullRequests.includes(context.prNumber)
  if (active) {
    assert(context.baseRef === workload.value.baseBranch, `Benchmark workload requires base ${workload.value.baseBranch}; retarget the PR and approve the new run`)
    for (const name of workload.value.profiles) {
      assert(matchesFilters([context.baseRef], profiles[name].baseBranches), `Benchmark workload profile ${name} does not apply to base ${context.baseRef}; retarget the PR to an applicable base and approve the new run`)
    }
  }
  const sources = Object.fromEntries(Object.entries(pathSelections).map(([name, selected]) => {
    const added = active && workload.value.profiles.includes(name)
    return [name, selected ? (added ? 'path+workload' : 'path') : (added ? 'workload' : 'skipped')]
  }))
  return {
    verificationTopology: active ? verificationTopologyForAttempt(workload.value, context.runAttempt) : 'optimized-v1',
    pathSelections,
    selectionSources: sources,
    selections: Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, source !== 'skipped'])),
    ...(active
      ? { benchmarkWorkload: { schemaVersion: 1, id: workload.value.id, baseBranch: workload.value.baseBranch, profiles: [...workload.value.profiles], manifest: workload.manifest } }
      : {}),
  }
}
