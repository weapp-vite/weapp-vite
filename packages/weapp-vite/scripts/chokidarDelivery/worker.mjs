import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { withMachineE2ELease } from '../../../devtools-runtime/src/lease/machine.ts'
import { MANAGED_PROJECT_JOURNAL_ENV } from '../../../weapp-ide-cli/src/index.ts'

const [id, consumerRoot, resultFile, ...extra] = process.argv.slice(2)
assert(id && path.isAbsolute(consumerRoot) && path.isAbsolute(resultFile) && extra.length === 0, 'Internal worker requires scenario, consumer root and result file')
assert(typeof MANAGED_PROJECT_JOURNAL_ENV === 'string' && MANAGED_PROJECT_JOURNAL_ENV)
assert.equal(process.env[MANAGED_PROJECT_JOURNAL_ENV], undefined, 'Public consumer workers cannot inherit a real IDE journal')
let result
try {
  await withMachineE2ELease(async (lease) => {
    assert.equal(lease.borrowed, true, 'Consumer workers must borrow their independent supervisor scope')
    // 探针位于普通 npm consumer 内，所有 bare import 均按真实安装解析。
    const { runPublicScenario } = await import(pathToFileURL(path.join(consumerRoot, 'probe/index.mjs')).href)
    result = await runPublicScenario(id, consumerRoot)
    result.cleanup.machineLeaseReleased = false
  })
  result.cleanup.machineLeaseReleased = true
}
catch (error) {
  result ??= { id, pid: process.pid, cleanup: { machineLeaseReleased: false } }
  result.status = 'failed'
  result.leaseError = { message: String(error), stack: error?.stack }
}
await writeFile(resultFile, `${JSON.stringify(result, null, 2)}\n`)
if (result.status !== 'passed') {
  process.exitCode = 1
}
