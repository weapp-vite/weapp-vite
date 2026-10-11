import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { acquireMachineE2ELease } from '../../src/lease/machine'

async function main() {
  const stateDirectory = process.argv[2]!
  const parentResource = process.argv[3]!
  const legacy = process.argv[4] === 'legacy'
  const childKey = path.join(parentResource, 'children', 'child')
  const grandchildKey = path.join(childKey, 'children', 'grandchild')
  const lease = await acquireMachineE2ELease({ stateDirectory })
  const child = await lease.createChildScope(legacy ? {} : { cleanupKey: childKey })
  const nested = await acquireMachineE2ELease({ stateDirectory, env: { ...process.env, ...child.environment } })
  const grandchild = await nested.createChildScope({ cleanupKey: grandchildKey })
  for (const key of [childKey, grandchildKey]) {
    await mkdir(key, { recursive: true })
    await writeFile(path.join(key, 'owned-resource'), 'registered')
  }
  // 父测试在登记全部落盘后强制退出本进程，故意不运行 seal/complete/release。
  process.on('message', () => {})
  process.send?.({ ready: true, childKey, grandchildKey, childEnvironment: child.environment, grandchildEnvironment: grandchild.environment })
}

void main().catch((error: unknown) => {
  process.send?.({ error: error instanceof Error ? error.message : String(error) })
  process.exitCode = 1
  process.disconnect?.()
})
