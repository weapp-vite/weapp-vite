/* eslint-disable e18e/ban-dependencies -- 扫描器身份登记使用现有 execa 子进程类型。 */
import type { Subprocess } from 'execa'
import type { MachineE2EChildScope, MachineE2ELease, MachineE2ELeaseOptions } from '../../../packages/devtools-runtime/src/lease/machine'
import type { ManagedWechatHostIdentity } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { withMachineE2ELease } from '../../../packages/devtools-runtime/src/lease/machine'
import { machineStateDirectory } from '../../../packages/devtools-runtime/src/lease/machineContext'
import { readManagedProcessIdentity } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/processIdentity'
import { OwnedCommandShutdownError } from '../../scripts/ownedE2ECommand/shutdown'

interface ScanRequest {
  rootDirectory: string
  nonce: string
  entry: string
}

interface ScannerRecord extends ScanRequest {
  protocol: 'weapp-vite-inventory-scanner-ownership-v1'
  parentPid: number
  stateDirectory: string
  createdAt: string
  child?: { pid?: number, observedAt: string, identity?: ManagedWechatHostIdentity, identityError?: string }
  stoppedAt?: string
  failure?: string
}

export interface InventoryCommandOwnership {
  environment: Record<string, string>
  stateDirectory: string
  recordChild: (child: Subprocess) => Promise<void>
  confirmStopped: () => void
}

function describe(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function writeRecord(file: string, record: ScannerRecord) {
  const temporary = `${file}.${randomUUID()}.tmp`
  try {
    await fs.writeFile(temporary, `${JSON.stringify(record)}\n`, { mode: 0o600, flag: 'wx' })
    await fs.rename(temporary, file)
  }
  finally {
    await fs.rm(temporary, { force: true })
  }
}

async function runInventoryCommandScope<T>(
  lease: MachineE2ELease,
  request: ScanRequest,
  run: (ownership: InventoryCommandOwnership) => Promise<T>,
  options: MachineE2ELeaseOptions,
): Promise<T> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-inventory-scanner-'))
  const file = path.join(directory, 'owner.json')
  const record: ScannerRecord = {
    protocol: 'weapp-vite-inventory-scanner-ownership-v1',
    ...request,
    parentPid: process.pid,
    stateDirectory: machineStateDirectory(options),
    createdAt: new Date().toISOString(),
  }
  try {
    await writeRecord(file, record)
  }
  catch (error) {
    await fs.rm(directory, { recursive: true, force: true }).catch(() => {})
    throw error
  }
  // scope 创建可能在持久化后报错，不能删除其可能已经绑定的身份记录。
  let scope: MachineE2EChildScope
  try {
    scope = await lease.createChildScope({ cleanupKey: file })
  }
  catch (error) {
    // 创建 scope 的结果未知时保留证据，避免把可能已写入的登记当成可安全删除。
    record.failure = describe(error)
    await writeRecord(file, record).catch(() => {})
    throw error
  }
  let spawned = false
  let stopped = false
  let failure: { error: unknown } | undefined
  let result: T | undefined
  try {
    result = await run({
      environment: scope.environment,
      stateDirectory: record.stateDirectory,
      recordChild: async (child) => {
        spawned = true
        record.child = { pid: child.pid, observedAt: new Date().toISOString() }
        await writeRecord(file, record)
        if (child.pid !== undefined) {
          try {
            const identity = await readManagedProcessIdentity(child.pid)
            if (identity) {
              record.child.identity = identity
            }
            else {
              record.child.identityError = 'The scanner exited before its process identity could be observed.'
            }
          }
          catch (error) {
            record.child.identityError = describe(error)
          }
          await writeRecord(file, record)
        }
      },
      confirmStopped: () => { stopped = true },
    })
  }
  catch (error) {
    failure = { error }
    record.failure = describe(error)
  }
  const errors = failure ? [failure.error] : []
  if (spawned && !stopped) {
    try {
      await writeRecord(file, record)
    }
    catch (error) {
      errors.push(error)
    }
    try {
      await scope.seal()
    }
    catch (error) {
      errors.push(error)
    }
    // 不完成 scope，也不删除身份记录；根租约必须因未终结命令而保留。
    if (errors.length === 1 && errors[0] instanceof OwnedCommandShutdownError) {
      throw errors[0]
    }
    throw new OwnedCommandShutdownError('Managed DevTools inventory scanner shutdown is unconfirmed; preserve its machine scope and ownership record.', {
      cause: new AggregateError(errors, 'Inventory scanner shutdown and scope sealing did not complete.'),
    })
  }
  try {
    record.stoppedAt = new Date().toISOString()
    await writeRecord(file, record)
    await scope.seal()
    await scope.complete()
    if (!failure) {
      await fs.rm(directory, { recursive: true })
    }
  }
  catch (error) {
    errors.push(error)
  }
  if (errors.length > 1) {
    throw new AggregateError(errors, 'Inventory scanner operation and ownership cleanup did not complete.', { cause: errors[0] })
  }
  if (errors.length) {
    throw errors[0]
  }
  return result as T
}

/** 扫描器仅登记机器命令 scope；停止不明时不能借用 IDE journal 掩盖所有权。 */
export async function withInventoryCommandScope<T>(
  request: ScanRequest,
  run: (ownership: InventoryCommandOwnership) => Promise<T>,
  options: MachineE2ELeaseOptions = {},
): Promise<T> {
  try {
    return await withMachineE2ELease(lease => runInventoryCommandScope(lease, request, run, options), options)
  }
  catch (error) {
    if (error instanceof AggregateError && error.errors.some(item => item instanceof OwnedCommandShutdownError)) {
      throw new OwnedCommandShutdownError('Managed DevTools inventory scanner shutdown and machine lease release did not complete.', { cause: error })
    }
    throw error
  }
}
