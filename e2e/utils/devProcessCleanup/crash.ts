import type { ChildProcess } from 'node:child_process'
import { waitForNativeDevProcessExit } from './rootExit'

interface DevProcessCrashOptions {
  root: ChildProcess | undefined
  isRootHeld: () => boolean
  capture: (timeoutMs: number) => Promise<void>
  onSignal: () => void
}

/** 先登记完整后代树，再使用原始子进程句柄模拟崩溃；根消失后不重新推定 PPID 归属。 */
export async function crashDevProcess(options: DevProcessCrashOptions, timeoutMs: number) {
  await options.capture(timeoutMs)
  if (!options.root || !options.isRootHeld()) {
    throw new Error('Dev process root exited before its registered crash could be requested.')
  }
  if (!options.root.kill('SIGKILL')) {
    throw new Error('Dev process crash could not be requested through its held child handle.')
  }
  options.onSignal()
  if (!await waitForNativeDevProcessExit(options.root, timeoutMs)) {
    throw new Error('Dev process native exit was not confirmed after its registered crash.')
  }
}
