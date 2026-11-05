import path from 'node:path'
import process from 'node:process'
import { acquireMachineE2ELease } from '../../../packages/devtools-runtime/src/lease/machine'
import { INHERITED_LEASE_ENV } from '../../../packages/devtools-runtime/src/lease/machineScope'
import { assertNoUnreleasedDevtoolsProjects } from '../devtoolsProcessOwnership'
import { inventoryScanResult } from './protocol'

// 此入口只借用父命令的机器 scope 并读取历史登记，不创建 journal、scope 或 IDE。
async function main() {
  const [rootDirectory, nonce, stateDirectory, ...extra] = process.argv.slice(2)
  if (!rootDirectory || !path.isAbsolute(rootDirectory) || path.resolve(rootDirectory) !== rootDirectory
    || !nonce || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(nonce)
    || !stateDirectory || !path.isAbsolute(stateDirectory) || extra.length || !process.env[INHERITED_LEASE_ENV]) {
    throw new Error('Managed DevTools inventory scanner received an invalid request.')
  }
  const lease = await acquireMachineE2ELease({ stateDirectory })
  try {
    await assertNoUnreleasedDevtoolsProjects(rootDirectory)
  }
  finally {
    await lease.release()
  }
  process.stdout.write(`${JSON.stringify(inventoryScanResult(rootDirectory, nonce))}\n`)
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
})
