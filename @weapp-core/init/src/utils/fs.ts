import fs from 'fs-extra'

/**
 * @description 文件读取错误
 */
export class FsReadError extends Error {
  constructor(public filepath: string, public cause: unknown) {
    super(`Failed to read ${filepath}`)
    this.name = 'FsReadError'
  }
}

/**
 * @description 文件写入错误
 */
export class FsWriteError extends Error {
  constructor(public filepath: string, public cause: unknown) {
    super(`Failed to write ${filepath}`)
    this.name = 'FsWriteError'
  }
}

/**
 * @description 读取 JSON 文件；不存在则返回 null
 */
export async function readJsonIfExists<T>(filepath: string): Promise<T | null> {
  try {
    return await fs.readJSON(filepath) as T
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return null
    }
    throw new FsReadError(filepath, error)
  }
}

/**
 * @description 读取文本文件；不存在则返回 null
 */
export async function readFileIfExists(filepath: string): Promise<string | null> {
  try {
    return await fs.readFile(filepath, 'utf8')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return null
    }
    throw new FsReadError(filepath, error)
  }
}

/**
 * @description 写入 JSON 文件
 */
export async function writeJsonFile(filepath: string, data: unknown, spaces = 2) {
  try {
    await fs.outputJSON(filepath, data, {
      spaces,
    })
  }
  catch (error) {
    throw new FsWriteError(filepath, error)
  }
}

/**
 * @description 写入文本文件
 */
export async function writeFile(filepath: string, contents: string) {
  try {
    await fs.outputFile(filepath, contents, 'utf8')
  }
  catch (error) {
    throw new FsWriteError(filepath, error)
  }
}
