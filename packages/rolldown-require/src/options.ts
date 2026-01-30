import type { InternalOptions, Options } from './types'
import path from 'node:path'
import process from 'node:process'
import { getTsconfig } from 'get-tsconfig'
import { isFilePathESM } from './utils'

export function resolveEntryFilepath(options: Options): string {
  if (path.isAbsolute(options.filepath)) {
    return options.filepath
  }
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd()
  return path.resolve(cwd, options.filepath)
}

export function detectModuleType(resolvedPath: string): boolean {
  return typeof process.versions.deno === 'string' || isFilePathESM(resolvedPath)
}

export function createInternalOptions(
  userOptions: Options,
  isESM: boolean,
): InternalOptions {
  const {
    filepath: _filepath,
    cwd: _cwd,
    ...rest
  } = userOptions
  const tsconfig = userOptions.tsconfig === false
    ? false
    : resolveTsconfigPath(userOptions)
  const format = userOptions.format ?? (isESM ? 'esm' : 'cjs')
  return {
    ...rest,
    isESM,
    format,
    tsconfig,
  }
}

export function resolveTsconfigPath(options: Options): string | undefined {
  if (options.tsconfig === false) {
    return undefined
  }
  if (typeof options.tsconfig === 'string') {
    return options.tsconfig
  }
  return getTsconfig(options.cwd, 'tsconfig.json')?.path ?? undefined
}
