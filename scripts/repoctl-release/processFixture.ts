import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import process from 'node:process'

export interface ProcessRecord {
  pid: number
  role: 'supervisor' | 'command' | 'descendant'
}

type ProcessState = 'running' | 'foreign' | 'zombie' | 'gone'
type ReadProcessFile = (file: string) => Promise<string>

interface CleanupOperations {
  inspect: (pid: number, ownerToken: string) => Promise<ProcessState>
  kill: (pid: number) => void
  wait: (pid: number, ownerToken: string) => Promise<ProcessState>
}

/** 先确认终态，避免已退出进程的环境读取权限阻断状态判断。 */
export async function readLinuxFixtureProcess(pid: number, ownerToken: string, readFile: ReadProcessFile = file => fs.readFile(file, 'utf8')): Promise<ProcessState> {
  const readState = async (): Promise<'zombie' | 'gone' | 'present'> => {
    try {
      const stat = await readFile(`/proc/${pid}/stat`)
      const nameEnd = stat.lastIndexOf(')')
      const state = stat.slice(nameEnd + 2, nameEnd + 3)
      if (nameEnd < 0 || stat[nameEnd + 1] !== ' ' || !/^[a-z]$/i.test(state)) {
        throw new Error('Cannot identify the fixture process state from proc stat.')
      }
      return ['Z', 'X'].includes(state) ? 'zombie' : 'present'
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
      return 'gone'
    }
  }
  const initial = await readState()
  if (initial !== 'present') {
    return initial
  }
  let environment: string
  try {
    environment = await readFile(`/proc/${pid}/environ`)
  }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      return 'gone'
    }
    if (code === 'EACCES' || code === 'EPERM') {
      let current: Awaited<ReturnType<typeof readState>>
      try {
        current = await readState()
      }
      catch (stateError) {
        throw new AggregateError([error, stateError], 'Fixture process permission and state inspection both failed.', { cause: error })
      }
      if (current !== 'present') {
        return current
      }
    }
    // 仍存活或身份不明时保留权限错误，不能把拒绝访问当作清理授权。
    throw error
  }
  if (environment.split('\0').includes(`FIXTURE_OWNER_TOKEN=${ownerToken}`)) {
    return 'running'
  }
  // 读取环境前也可能刚好退出；只有再次确认仍存活时才判为其他进程。
  const current = await readState()
  return current === 'present' ? 'foreign' : current
}

export async function processState(pid: number, ownerToken: string): Promise<ProcessState> {
  if (process.platform === 'linux') {
    return readLinuxFixtureProcess(pid, ownerToken)
  }
  const result = spawnSync('ps', ['eww', '-p', String(pid), '-o', 'command='], { encoding: 'utf8' })
  if (result.status !== 0) {
    return 'gone'
  }
  return result.stdout.includes(`FIXTURE_OWNER_TOKEN=${ownerToken}`) ? 'running' : 'foreign'
}

export async function waitForProcessExit(pid: number, ownerToken: string) {
  const deadline = Date.now() + 2000
  let state = await processState(pid, ownerToken)
  while (state === 'running' && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 25))
    state = await processState(pid, ownerToken)
  }
  return state
}

/** 仅清理登记且身份仍匹配的进程；逐项收集错误，不影响其他已确认归属的清理。 */
export async function cleanupFixtureProcesses(records: ProcessRecord[], ownerToken: string, overrides: Partial<CleanupOperations> = {}) {
  const operations: CleanupOperations = {
    inspect: processState,
    kill: pid => process.kill(pid, 'SIGKILL'),
    wait: waitForProcessExit,
    ...overrides,
  }
  const errors: unknown[] = []
  for (const { pid, role } of records) {
    try {
      if (await operations.inspect(pid, ownerToken) !== 'running') {
        continue
      }
      try {
        operations.kill(pid)
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
          throw error
        }
      }
      const state = await operations.wait(pid, ownerToken)
      if (state !== 'gone' && state !== 'zombie') {
        throw new Error(`Fixture ${role} cleanup did not confirm process exit: ${state}.`)
      }
    }
    catch (error) {
      errors.push(error)
    }
  }
  if (errors.length === 1) {
    throw errors[0]
  }
  if (errors.length > 1) {
    throw new AggregateError(errors, 'Fixture process cleanup failed.')
  }
}

/** 保留测试正文与清理错误，避免 finally 中的失败覆盖最初断言。 */
export async function withFixtureProcessCleanup(run: () => Promise<void>, cleanup: () => Promise<void>) {
  let failure: { error: unknown } | undefined
  try {
    await run()
  }
  catch (error) {
    failure = { error }
  }
  try {
    await cleanup()
  }
  catch (error) {
    if (failure) {
      throw new AggregateError([failure.error, error], 'Fixture test and process cleanup both failed.', { cause: failure.error })
    }
    throw error
  }
  if (failure) {
    throw failure.error
  }
}
