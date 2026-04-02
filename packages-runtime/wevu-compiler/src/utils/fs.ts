import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'

/**
 * 创建目录，行为等价于 ensureDir。
 */
export async function ensureDir(path: string) {
  await mkdir(path, { recursive: true })
}

/**
 * 删除文件或目录，行为等价于 remove。
 */
export async function remove(path: string) {
  await rm(path, { recursive: true, force: true })
}

/**
 * 判断路径是否存在。
 */
export async function pathExists(path: string) {
  try {
    await access(path)
    return true
  }
  catch {
    return false
  }
}

export {
  mkdtemp,
  readFile,
  stat,
  writeFile,
}
