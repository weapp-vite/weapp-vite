import type { Buffer } from 'node:buffer'
import type { DepOptimizationOptions } from './optimizer'
import type { RequireFunction } from './types'
import { exec } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { builtinModules, createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import { createFilter as _createFilter } from '@rollup/pluginutils'
import {
  OPTIMIZABLE_ENTRY_RE,
} from './constants'
import {
  findNearestPackageData,
  type PackageCache,
} from './packages'
import {
  isWindows,
  slash,
  splitFileAndPostfix,
} from './sharedUtils'

/**
 * Inlined to keep `@rollup/pluginutils` in devDependencies
 */
export type FilterPattern
  = | ReadonlyArray<string | RegExp>
    | string
    | RegExp
    | null
export const createFilter = _createFilter as (
  include?: FilterPattern,
  exclude?: FilterPattern,
  options?: { resolve?: string | false | null },
) => (id: string | unknown) => boolean

export { VERSION as rolldownVersion } from 'rolldown'

const replaceSlashOrColonRE = /[/:]/g
const replaceDotRE = /\./g
const replaceNestedIdRE = /\s*>\s*/g
const replaceHashRE = /#/g
export function flattenId(id: string): string {
  const flatId = limitFlattenIdLength(
    id
      .replace(replaceSlashOrColonRE, '_')
      .replace(replaceDotRE, '__')
      .replace(replaceNestedIdRE, '___')
      .replace(replaceHashRE, '____'),
  )
  return flatId
}

const FLATTEN_ID_HASH_LENGTH = 8
const FLATTEN_ID_MAX_FILE_LENGTH = 170

function limitFlattenIdLength(id: string, limit: number = FLATTEN_ID_MAX_FILE_LENGTH): string {
  if (id.length <= limit) {
    return id
  }
  return `${id.slice(0, limit - (FLATTEN_ID_HASH_LENGTH + 1))}_${getHash(id)}`
}

export function normalizeId(id: string): string {
  return id.replace(replaceNestedIdRE, ' > ')
}

// Supported by Node, Deno, Bun
const NODE_BUILTIN_NAMESPACE = 'node:'
// Supported by Deno
const NPM_BUILTIN_NAMESPACE = 'npm:'
// Supported by Bun
const BUN_BUILTIN_NAMESPACE = 'bun:'
// Some runtimes like Bun injects namespaced modules here, which is not a node builtin
const nodeBuiltins = builtinModules.filter(id => !id.includes(':'))

const isBuiltinCache = new WeakMap<
  (string | RegExp)[],
  (id: string, importer?: string) => boolean
>()

export function isBuiltin(builtins: (string | RegExp)[], id: string): boolean {
  let isBuiltin = isBuiltinCache.get(builtins)
  if (!isBuiltin) {
    isBuiltin = createIsBuiltin(builtins)
    isBuiltinCache.set(builtins, isBuiltin)
  }
  return isBuiltin(id)
}

export function createIsBuiltin(
  builtins: (string | RegExp)[],
): (id: string) => boolean {
  const plainBuiltinsSet = new Set(
    builtins.filter(builtin => typeof builtin === 'string'),
  )
  const regexBuiltins = builtins.filter(
    builtin => typeof builtin !== 'string',
  )

  return id =>
    plainBuiltinsSet.has(id) || regexBuiltins.some(regexp => regexp.test(id))
}

export const nodeLikeBuiltins = [
  ...nodeBuiltins,
  new RegExp(`^${NODE_BUILTIN_NAMESPACE}`),
  new RegExp(`^${NPM_BUILTIN_NAMESPACE}`),
  new RegExp(`^${BUN_BUILTIN_NAMESPACE}`),
]

export function isNodeLikeBuiltin(id: string): boolean {
  return isBuiltin(nodeLikeBuiltins, id)
}

export function isNodeBuiltin(id: string): boolean {
  if (id.startsWith(NODE_BUILTIN_NAMESPACE)) {
    return true
  }
  return nodeBuiltins.includes(id)
}

export function isInNodeModules(id: string): boolean {
  return id.includes('node_modules')
}

export function isOptimizable(
  id: string,
  optimizeDeps: DepOptimizationOptions,
): boolean {
  const { extensions } = optimizeDeps
  return (
    OPTIMIZABLE_ENTRY_RE.test(id)
    || (extensions?.some(ext => id.endsWith(ext)) ?? false)
  )
}

export const bareImportRE = /^(?![a-z]:)[\w@](?!.*:\/\/)/i
export const deepImportRE = /^([^@][^/]*)\/|^(@[^/]+\/[^/]+)\//

const _require = createRequire(import.meta.url)

const _dirname = path.dirname(fileURLToPath(import.meta.url))

export { withFilter } from 'rolldown/filter'

export type ViteDebugScope = `vite:${string}`

export const urlCanParse

  = URL.canParse
  // URL.canParse is supported from Node.js 18.17.0+, 20.0.0+
    ?? ((path: string, base?: string | undefined): boolean => {
      try {
        // eslint-disable-next-line no-new
        new URL(path, base)
        return true
      }
      catch {
        return false
      }
    })

export function normalizePath(id: string): string {
  return path.posix.normalize(isWindows ? slash(id) : id)
}

const trailingSeparatorRE = /[?&]$/

export const urlRE = /(\?|&)url(?:&|$)/
export const rawRE = /(\?|&)raw(?:&|$)/

export function injectQuery(url: string, queryToInject: string): string {
  const { file, postfix } = splitFileAndPostfix(url)
  const normalizedFile = isWindows ? slash(file) : file
  return `${normalizedFile}?${queryToInject}${postfix[0] === '?' ? `&${postfix.slice(1)}` : /* hash only */ postfix}`
}

const timestampRE = /\bt=\d{13}&?\b/
export function removeTimestampQuery(url: string): string {
  return url.replace(timestampRE, '').replace(trailingSeparatorRE, '')
}

export function isObject(value: unknown): value is Record<string, any> {
  return Object.prototype.toString.call(value) === '[object Object]'
}

export function isDefined<T>(value: T | undefined | null): value is T {
  return value != null
}

export function tryStatSync(file: string): fs.Stats | undefined {
  try {
    // The "throwIfNoEntry" is a performance optimization for cases where the file does not exist
    return fs.statSync(file, { throwIfNoEntry: false })
  }
  catch {
    // Ignore errors
  }
}

export function isFilePathESM(
  filePath: string,
  packageCache?: PackageCache,
): boolean {
  if (/\.m[jt]s$/.test(filePath)) {
    return true
  }
  else if (/\.c[jt]s$/.test(filePath)) {
    return false
  }
  else {
    // check package.json for type: "module"
    try {
      const pkg = findNearestPackageData(path.dirname(filePath), packageCache)
      return pkg?.data.type === 'module'
    }
    catch {
      return false
    }
  }
}

export const splitRE = /\r?\n/g

export function pad(source: string, n = 2): string {
  const lines = source.split(splitRE)
  return lines.map(l => ` `.repeat(n) + l).join(`\n`)
}

export const ERR_SYMLINK_IN_RECURSIVE_READDIR
  = 'ERR_SYMLINK_IN_RECURSIVE_READDIR'

// `fs.realpathSync.native` resolves differently in Windows network drive,
// causing file read errors. skip for now.
// https://github.com/nodejs/node/issues/37737
export let safeRealpathSync = isWindows
  ? windowsSafeRealPathSync
  : fs.realpathSync.native

// Based on https://github.com/larrybahr/windows-network-drive
// MIT License, Copyright (c) 2017 Larry Bahr
const windowsNetworkMap = new Map()
function windowsMappedRealpathSync(path: string) {
  const realPath = fs.realpathSync.native(path)
  if (realPath.startsWith('\\\\')) {
    for (const [network, volume] of windowsNetworkMap) {
      if (realPath.startsWith(network)) { return realPath.replace(network, volume) }
    }
  }
  return realPath
}
const parseNetUseRE = /^\w* +(\w:) +([^ ]+)\s/
let firstSafeRealPathSyncRun = false

function windowsSafeRealPathSync(path: string): string {
  if (!firstSafeRealPathSyncRun) {
    optimizeSafeRealPathSync()
    firstSafeRealPathSyncRun = true
  }
  return fs.realpathSync(path)
}

function optimizeSafeRealPathSync() {
  // Skip if using Node <18.10 due to MAX_PATH issue: https://github.com/vitejs/vite/issues/12931
  const nodeVersion = process.versions.node.split('.').map(Number)
  if (nodeVersion[0] < 18 || (nodeVersion[0] === 18 && nodeVersion[1] < 10)) {
    safeRealpathSync = fs.realpathSync
    return
  }
  // Check the availability `fs.realpathSync.native`
  // in Windows virtual and RAM disks that bypass the Volume Mount Manager, in programs such as imDisk
  // get the error EISDIR: illegal operation on a directory
  try {
    fs.realpathSync.native(path.resolve('./'))
  }
  catch (error) {
    // @ts-ignore
    if (error.message.includes('EISDIR: illegal operation on a directory')) {
      safeRealpathSync = fs.realpathSync
      return
    }
  }
  exec('net use', (error, stdout) => {
    if (error) { return }
    const lines = stdout.split('\n')
    // OK           Y:        \\NETWORKA\Foo         Microsoft Windows Network
    // OK           Z:        \\NETWORKA\Bar         Microsoft Windows Network
    for (const line of lines) {
      const m = parseNetUseRE.exec(line)
      if (m) { windowsNetworkMap.set(m[2], m[1]) }
    }
    if (windowsNetworkMap.size === 0) {
      safeRealpathSync = fs.realpathSync.native
    }
    else {
      safeRealpathSync = windowsMappedRealpathSync
    }
  })
}

export function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

export function arraify<T>(target: T | T[]): T[] {
  return Array.isArray(target) ? target : [target]
}

const hash

  = crypto.hash
    ?? ((
      algorithm: string,
      data: crypto.BinaryLike,
      outputEncoding: crypto.BinaryToTextEncoding,
    ) => crypto.createHash(algorithm).update(data).digest(outputEncoding))

export function getHash(text: Buffer | string, length = 8): string {
  const h = hash('sha256', text, 'hex').substring(0, length)
  if (length <= 64) { return h }
  return h.padEnd(length, '_')
}

// strip UTF-8 BOM
export function stripBomTag(content: string): string {
  if (content.charCodeAt(0) === 0xFEFF) {
    return content.slice(1)
  }

  return content
}

export function getRandomId() {
  return Math.random().toString(36).substring(2, 15)
}

export function getNpmPackageName(importPath: string): string | null {
  const parts = importPath.split('/')
  if (parts[0][0] === '@') {
    if (!parts[1]) { return null }
    return `${parts[0]}/${parts[1]}`
  }
  else {
    return parts[0]
  }
}

// Injected by TSUP
declare const TSUP_FORMAT: 'esm' | 'cjs'
export const dynamicImport: RequireFunction = async (
  id: string,
  { format },
) => {
  const fn
    = format === 'esm'
      ? (file: string) => import(file)
      : TSUP_FORMAT === 'esm'
        ? createRequire(import.meta.url)
        : require
  return fn(id)
}
