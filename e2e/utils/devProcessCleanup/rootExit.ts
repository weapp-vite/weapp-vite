import type { ChildProcess } from 'node:child_process'

type NativeChild = Pick<ChildProcess, 'exitCode' | 'signalCode' | 'once' | 'off'>

/** 根身份已消失时只等原始子进程退出事实，不把 error 或输出排空当作退出。 */
export async function waitForNativeDevProcessExit(child: NativeChild | undefined, timeoutMs: number): Promise<boolean> {
  const exited = () => child != null && (child.exitCode != null || child.signalCode != null)
  if (exited()) {
    return true
  }
  if (!child) {
    return false
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  let onExit: (() => void) | undefined
  try {
    return await new Promise<boolean>((resolve) => {
      onExit = () => resolve(exited())
      child.once('exit', onExit)
      timer = setTimeout(resolve, timeoutMs, false)
      if (exited()) {
        resolve(true)
      }
    })
  }
  finally {
    clearTimeout(timer)
    if (onExit) {
      child.off('exit', onExit)
    }
  }
}
