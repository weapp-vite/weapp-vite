import type { FileHandle, OpenMode, PathLike } from 'node:fs/promises'
import { close as closeFd, closeSync, constants, Dirent, existsSync, promises as nodeFs, openSync, readFileSync, Stats, utimesSync } from 'node:fs'
import path from 'node:path'

export interface JsonReadOptions {
  encoding?: BufferEncoding
  throws?: boolean
}

export interface JsonWriteOptions {
  encoding?: BufferEncoding
  replacer?: ((this: any, key: string, value: any) => any) | Array<number | string> | null
  spaces?: number | string
}

export interface CopyOptions {
  dereference?: boolean
  errorOnExist?: boolean
  filter?: (src: string, dest: string) => boolean | Promise<boolean>
  overwrite?: boolean
  preserveTimestamps?: boolean
  verbatimSymlinks?: boolean
}

export interface MoveOptions {
  overwrite?: boolean
}

function normalizeJsonEncoding(encoding?: BufferEncoding) {
  return encoding ?? 'utf8'
}

function normalizeJsonText(source: string) {
  return source.charCodeAt(0) === 0xFEFF ? source.slice(1) : source
}

function serializeJson(data: unknown, options?: JsonWriteOptions) {
  return JSON.stringify(data, options?.replacer ?? null, options?.spaces)
}

async function pathExists(target: string) {
  try {
    await nodeFs.access(target)
    return true
  }
  catch {
    return false
  }
}

function pathExistsSync(target: string) {
  try {
    return existsSync(target)
  }
  catch {
    return false
  }
}

async function exists(target: string) {
  return pathExists(target)
}

async function ensureDir(dir: string) {
  await nodeFs.mkdir(dir, { recursive: true })
}

async function remove(target: string) {
  await nodeFs.rm(target, { force: true, recursive: true })
}

async function emptyDir(dir: string) {
  await ensureDir(dir)
  const entries = await nodeFs.readdir(dir, { withFileTypes: true })
  await Promise.all(entries.map((entry) => {
    return remove(path.join(dir, entry.name))
  }))
}

async function outputFile(file: string, data: string | NodeJS.ArrayBufferView, options?: BufferEncoding) {
  await ensureDir(path.dirname(file))
  await nodeFs.writeFile(file, data, options)
}

async function writeJson(file: string, data: unknown, options?: JsonWriteOptions) {
  const source = serializeJson(data, options)
  await nodeFs.writeFile(file, source, normalizeJsonEncoding(options?.encoding))
}

async function writeJSON(file: string, data: unknown, options?: JsonWriteOptions) {
  await writeJson(file, data, options)
}

async function outputJson(file: string, data: unknown, options?: JsonWriteOptions) {
  await ensureDir(path.dirname(file))
  await writeJson(file, data, options)
}

async function outputJSON(file: string, data: unknown, options?: JsonWriteOptions) {
  await outputJson(file, data, options)
}

async function readJson<T = unknown>(file: string, options?: JsonReadOptions): Promise<T | null> {
  try {
    const source = await nodeFs.readFile(file, normalizeJsonEncoding(options?.encoding))
    return JSON.parse(normalizeJsonText(source)) as T
  }
  catch (error) {
    if (options?.throws === false && error instanceof SyntaxError) {
      return null
    }
    throw error
  }
}

async function readJSON<T = unknown>(file: string, options?: JsonReadOptions) {
  return readJson<T>(file, options)
}

function readJsonSync<T = unknown>(file: string, options?: JsonReadOptions): T | null {
  try {
    const source = readFileSync(file, normalizeJsonEncoding(options?.encoding))
    return JSON.parse(normalizeJsonText(source)) as T
  }
  catch (error) {
    if (options?.throws === false && error instanceof SyntaxError) {
      return null
    }
    throw error
  }
}

async function copy(src: string, dest: string, options?: CopyOptions) {
  await nodeFs.cp(src, dest, {
    ...(typeof options?.dereference === 'boolean' ? { dereference: options.dereference } : {}),
    ...(typeof options?.errorOnExist === 'boolean' ? { errorOnExist: options.errorOnExist } : {}),
    ...(typeof options?.filter === 'function' ? { filter: options.filter } : {}),
    ...(typeof options?.preserveTimestamps === 'boolean' ? { preserveTimestamps: options.preserveTimestamps } : {}),
    ...(typeof options?.verbatimSymlinks === 'boolean' ? { verbatimSymlinks: options.verbatimSymlinks } : {}),
    force: options?.overwrite ?? true,
    recursive: true,
  })
}

async function move(src: string, dest: string, options?: MoveOptions) {
  if (src === dest) {
    return
  }

  const targetExists = await pathExists(dest)
  if (targetExists) {
    if (!options?.overwrite) {
      const error = new Error(`dest already exists: ${dest}`) as NodeJS.ErrnoException
      error.code = 'EEXIST'
      throw error
    }
    await remove(dest)
  }

  await ensureDir(path.dirname(dest))

  try {
    await nodeFs.rename(src, dest)
  }
  catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code
    if (code !== 'EXDEV') {
      throw error
    }
    await copy(src, dest, { overwrite: options?.overwrite ?? true })
    await remove(src)
  }
}

async function close(handle: number | FileHandle) {
  if (typeof handle === 'number') {
    await new Promise<void>((resolve, reject) => {
      closeFd(handle, (error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
    return
  }
  await handle.close()
}

export const fs = {
  Dirent,
  Stats,
  access: nodeFs.access,
  close,
  closeSync,
  constants,
  copy,
  emptyDir,
  ensureDir,
  exists,
  existsSync,
  mkdtemp: nodeFs.mkdtemp,
  move,
  open: (file: PathLike, flags: OpenMode) => nodeFs.open(file, flags),
  openSync,
  outputFile,
  outputJSON,
  outputJson,
  pathExists,
  pathExistsSync,
  readFile: nodeFs.readFile,
  readFileSync,
  readJSON,
  readJson,
  readJsonSync,
  readdir: nodeFs.readdir,
  remove,
  stat: nodeFs.stat,
  utimes: nodeFs.utimes,
  utimesSync,
  writeFile: nodeFs.writeFile,
  writeJSON,
  writeJson,
}

export type FsDirent = Dirent
export type FsStats = Stats
