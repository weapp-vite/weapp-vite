import fs from 'fs-extra'

export async function readJsonIfExists<T>(filepath: string): Promise<T | null> {
  try {
    if (!await fs.pathExists(filepath)) {
      return null
    }
    return await fs.readJSON(filepath) as T
  }
  catch (error) {
    throw new FsReadError(filepath, error)
  }
}

export async function readFileIfExists(filepath: string): Promise<string | null> {
  try {
    if (!await fs.pathExists(filepath)) {
      return null
    }
    return await fs.readFile(filepath, 'utf8')
  }
  catch (error) {
    throw new FsReadError(filepath, error)
  }
}

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

export async function writeFile(filepath: string, contents: string) {
  try {
    await fs.outputFile(filepath, contents, 'utf8')
  }
  catch (error) {
    throw new FsWriteError(filepath, error)
  }
}

export class FsReadError extends Error {
  constructor(public filepath: string, public cause: unknown) {
    super(`Failed to read ${filepath}`)
    this.name = 'FsReadError'
  }
}

export class FsWriteError extends Error {
  constructor(public filepath: string, public cause: unknown) {
    super(`Failed to write ${filepath}`)
    this.name = 'FsWriteError'
  }
}
