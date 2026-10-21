import assert from 'node:assert/strict'
import { NATIVE_PR_WORKLOAD_PATH, readNativePrWorkload, selectNativePrWorkload } from '../../../.github/scripts/native-pr-workload.mjs'
import { immutableTree } from './tree.mjs'

/** 只读取原始 merge tree，head 模式子流程不能替换全轮调度和清单身份。 */
export async function readCiWorkload(context, get) {
  assert(context.checkoutMode === 'merge' && context.checkoutSha === context.driverSha, 'Benchmark workload requires the root merge context')
  const tree = await immutableTree(context, get)
  const profiles = JSON.parse((await tree.read('.github/pr-checks.json')).bytes.toString('utf8'))
  const source = await tree.read(NATIVE_PR_WORKLOAD_PATH)
  const workload = await readNativePrWorkload(context.checkoutSha, profiles, async () => ({
    type: 'file',
    path: NATIVE_PR_WORKLOAD_PATH,
    encoding: 'base64',
    content: source.bytes.toString('base64'),
    sha: source.sha,
  }))
  const names = Object.keys(profiles).sort()
  assert(context.pathSelections && typeof context.pathSelections === 'object'
    && JSON.stringify(Object.keys(context.pathSelections).sort()) === JSON.stringify(names)
    && Object.values(context.pathSelections).every(value => typeof value === 'boolean'), 'Missing or invalid frozen workload path selections')
  const selected = selectNativePrWorkload(context, profiles, context.pathSelections, workload)
  assert(selected.benchmarkWorkload, 'PR is not explicitly selected by the immutable benchmark workload')
  for (const key of ['benchmarkWorkload', 'pathSelections', 'selections', 'selectionSources']) {
    assert.deepEqual(context[key], selected[key], `Frozen benchmark workload ${key} differs from its immutable manifest`)
  }
  assert.deepEqual(Object.keys(context.selections).filter(name => context.selections[name]).sort(), [...workload.value.profiles].sort(), 'Actual CI selections must equal the complete benchmark workload')
  return selected.benchmarkWorkload
}
