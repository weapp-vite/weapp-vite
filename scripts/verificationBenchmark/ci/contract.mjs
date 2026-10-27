import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { comparisonTopology, resolveVerificationTopology } from '../../verification/topology.ts'
import { frameworkInputs } from './inputs.mjs'
import { immutableTree, relativeFile } from './tree.mjs'

export { relativeFile } from './tree.mjs'

const digest = value => createHash('sha256').update(value).digest('hex')

function comparisonIdentity(value, context, configuration) {
  const protocol = value.comparisonProtocol
  assert.equal(protocol, configuration.comparisonProtocol, 'Immutable benchmark comparison protocol mismatch')
  if (protocol === undefined) {
    return {}
  }
  const expected = comparisonTopology(protocol, configuration.cohort?.variant)
  assert.equal(context.verificationTopology, expected, 'Frozen benchmark cohort has the wrong reviewed topology')
  return { comparisonProtocol: protocol, executionTopology: resolveVerificationTopology(context.verificationTopology, {}) }
}

/** 配置与输入字节均读取冻结 merge tree，外部摘要不能自行声明已验证。 */
export async function readCiContract(filename, context, get, configuration = {}) {
  relativeFile(filename)
  const { entries, read } = await immutableTree(context, get)
  const source = await read(filename)
  const value = JSON.parse(source.bytes.toString('utf8'))
  const explicitFiles = Array.isArray(value.inputFiles) && value.inputFiles.length && new Set(value.inputFiles).size === value.inputFiles.length
  if (value.schemaVersion !== 1 || value.draft === true || (value.inputPolicy ? Object.hasOwn(value, 'inputFiles') : !explicitFiles)
    || ['inputDigest', 'scopeDigest'].some(key => Object.hasOwn(value, key))
    || ['os', 'node', 'provider', 'platform', 'runnerClass', 'cachePolicy'].some(key => typeof value.profile?.[key] !== 'string' || !value.profile[key])) {
    throw new Error('Invalid immutable benchmark contract')
  }
  assert.deepEqual(value.workload, context.benchmarkWorkload, 'Immutable benchmark contract workload mismatch')
  const comparison = comparisonIdentity(value, context, configuration)
  if (value.inputPolicy) {
    const inputs = await frameworkInputs(entries, read, value.inputPolicy)
    return { value, comparison, inputDigest: inputs.inputDigest, receipt: { path: filename, blobSha: source.sha, checkoutSha: context.checkoutSha, ...inputs.receipt } }
  }
  const inputs = []
  for (const file of [...value.inputFiles].sort()) {
    inputs.push([file, digest((await read(file)).bytes)])
  }
  return { value, comparison, inputDigest: digest(JSON.stringify(inputs)), receipt: { path: filename, blobSha: source.sha, checkoutSha: context.checkoutSha, inputFiles: value.inputFiles } }
}
