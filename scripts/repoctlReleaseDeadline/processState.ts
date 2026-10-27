import fs from 'node:fs/promises'

type ReadProcessFile = (file: string) => Promise<string>

export async function waitForProcessExit(
  readState: () => ReturnType<typeof readLinuxProcessState>,
  timeoutMs = 2000,
) {
  const deadline = Date.now() + timeoutMs
  while (true) {
    try {
      const state = await readState()
      if (state !== 'running' || Date.now() >= deadline) {
        return state
      }
    }
    catch (error) {
      // Linux 退出途中可能尚未进入 Z/X 就失去 environ 权限；等待预算内继续确认，不能将权限错误当作终态。
      if (!['EACCES', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '') || Date.now() >= deadline) {
        throw error
      }
    }
    await new Promise(resolve => setTimeout(resolve, Math.min(25, Math.max(0, deadline - Date.now()))))
  }
}

export async function readLinuxProcessState(
  pid: number,
  ownerToken: string,
  readFile: ReadProcessFile = file => fs.readFile(file, 'utf8'),
) {
  async function hasExited() {
    const stat = await readFile(`/proc/${pid}/stat`)
    return ['Z', 'X'].includes(stat.slice(stat.lastIndexOf(')') + 2, stat.lastIndexOf(')') + 3))
  }

  try {
    if (await hasExited()) {
      return 'zombie'
    }

    let environment: string
    try {
      environment = await readFile(`/proc/${pid}/environ`)
    }
    catch (error) {
      // 退出时 environ 可能先失去读取权限，只有 stat 的死亡状态才能将权限错误判为已终结。
      if (['EACCES', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '') && await hasExited()) {
        return 'zombie'
      }
      throw error
    }

    if (environment.split('\0').includes(`FIXTURE_OWNER_TOKEN=${ownerToken}`)) {
      return 'running'
    }
    return await hasExited() ? 'zombie' : 'foreign'
  }
  catch (error) {
    if (!['ENOENT', 'ESRCH'].includes((error as NodeJS.ErrnoException).code ?? '')) {
      throw error
    }
    return 'gone'
  }
}
