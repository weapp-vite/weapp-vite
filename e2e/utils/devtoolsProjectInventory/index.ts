/* eslint-disable e18e/ban-dependencies -- 只读扫描需要 execa 的跨平台进程组所有权与取消。 */
import type { MachineE2ELeaseOptions } from '../../../packages/devtools-runtime/src/lease/machine'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { clearTimeout, setTimeout } from 'node:timers'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { MANAGED_PROJECT_JOURNAL_ENV } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { OwnedCommandShutdownError, waitForOwnedCommand } from '../../scripts/ownedE2ECommand/shutdown'
import { withInventoryCommandScope } from './ownership'
import { assertInventoryScanResult } from './protocol'

const DEFAULT_SCAN_TIMEOUT_MS = 120_000
const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)))
const scannerPath = fileURLToPath(new URL('./child.ts', import.meta.url))

/** 隔离不可取消的文件系统等待；确认扫描进程已停止后才允许父进程创建 journal。 */
export async function scanDevtoolsProjectInventory(
  rootDirectory: string,
  options: { signal?: AbortSignal, machineLeaseOptions?: MachineE2ELeaseOptions, timeoutMs?: number } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_SCAN_TIMEOUT_MS
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('Managed DevTools inventory scan timeout must be a positive integer.')
  }
  const timeout = options.signal ? undefined : new AbortController()
  const timer = timeout
    ? setTimeout(() => {
        timeout.abort(new DOMException('Managed DevTools inventory scan exceeded its deadline.', 'TimeoutError'))
      }, timeoutMs)
    : undefined
  const signal = options.signal ?? timeout!.signal
  try {
    signal.throwIfAborted()
    const root = path.resolve(rootDirectory)
    const nonce = randomUUID()
    await withInventoryCommandScope({ rootDirectory: root, nonce, entry: scannerPath }, async (ownership) => {
      signal.throwIfAborted()
      const child = execa(process.execPath, ['--import', 'tsx', scannerPath, root, nonce, ownership.stateDirectory], {
        cwd: repositoryRoot,
        env: { ...ownership.environment, [MANAGED_PROJECT_JOURNAL_ENV]: undefined },
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        buffer: true,
        maxBuffer: 64 * 1024,
        reject: false,
        killDescendants: true,
        killSignal: 'SIGKILL',
        forceKillAfterDelay: false,
      })
      const localCancellation = new AbortController()
      // 先接管退出和取消，再做身份持久化；记录失败也必须等该进程确认停止。
      const waiting = waitForOwnedCommand(child, AbortSignal.any([signal, localCancellation.signal])).then(
        result => ({ result, error: undefined }),
        (error: unknown) => ({ result: undefined, error }),
      )
      let recordError: unknown
      try {
        await ownership.recordChild(child)
      }
      catch (error) {
        recordError = error
        localCancellation.abort(error)
      }
      const outcome = await waiting
      if (outcome.error instanceof OwnedCommandShutdownError) {
        throw outcome.error
      }
      ownership.confirmStopped()
      signal.throwIfAborted()
      if (recordError) {
        throw recordError
      }
      if (outcome.error) {
        throw outcome.error
      }
      signal.throwIfAborted()
      const result = outcome.result!
      if (result.exitCode !== 0 || result.signal || result.failed) {
        throw new Error(`Managed DevTools inventory scanner exited unsuccessfully (exit code: ${result.exitCode ?? 'unavailable'}, signal: ${result.signal ?? 'none'}). ${String(result.stderr).trim()}`, { cause: result })
      }
      assertInventoryScanResult(String(result.stdout), root, nonce)
      signal.throwIfAborted()
    }, options.machineLeaseOptions)
    signal.throwIfAborted()
  }
  finally {
    clearTimeout(timer)
  }
}
