import { generateWrite, repeatBuild } from './build.mjs'
import { closing, failures, inflightError } from './lifecycle.mjs'
import { scanning, watching } from './watch.mjs'

export const productContractNames = Object.freeze(['generate-write', 'close', 'errors', 'inflight-error', 'repeat-build', 'watch', 'scan'])

/** 只编排公开构建、监听与扫描行为；所有场景均由调用方显式执行。 */
export function createProductContracts({ rolldown, watch, scan }, root) {
  return {
    'generate-write': () => generateWrite(rolldown, root),
    'close': () => closing(rolldown, root),
    'errors': () => failures(rolldown, root),
    'inflight-error': () => inflightError(rolldown, root),
    'repeat-build': () => repeatBuild(rolldown, root),
    'watch': () => watching(watch, root),
    'scan': () => scanning(scan, root),
  }
}
