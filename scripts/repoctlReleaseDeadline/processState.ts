import fs from 'node:fs/promises'

type ReadProcessFile = (file: string) => Promise<string>

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
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
    return 'gone'
  }
}
