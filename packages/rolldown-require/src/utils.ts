import type { Buffer } from 'node:buffer'
import type { DepOptimizationOptions } from './optimizer'
import type { RequireFunction } from './types'
import { exec } from 'node:child_process'
import crypto from 'node:crypto'
import { promises as dns } from 'node:dns'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { builtinModules, createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import { createFilter as _createFilter } from '@rollup/pluginutils'
import { VALID_ID_PREFIX } from './constants'
import {
  CLIENT_PUBLIC_PATH,
  ENV_PUBLIC_PATH,
  FS_PREFIX,
  OPTIMIZABLE_ENTRY_RE,
} from './constants'
import {
  findNearestPackageData,
  type PackageCache,
} from './packages'
import {
  cleanUrl,
  isWindows,
  slash,
  splitFileAndPostfix,
  withTrailingSlash,
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

export function moduleListContains(
  moduleList: string[] | undefined,
  id: string,
): boolean | undefined {
  return moduleList?.some(
    m => m === id || id.startsWith(withTrailingSlash(m)),
  )
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

// TODO: use import()
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

const VOLUME_RE = /^[A-Z]:/i

export function normalizePath(id: string): string {
  return path.posix.normalize(isWindows ? slash(id) : id)
}

export function fsPathFromId(id: string): string {
  const fsPath = normalizePath(
    id.startsWith(FS_PREFIX) ? id.slice(FS_PREFIX.length) : id,
  )
  return fsPath[0] === '/' || VOLUME_RE.test(fsPath) ? fsPath : `/${fsPath}`
}

export function fsPathFromUrl(url: string): string {
  return fsPathFromId(cleanUrl(url))
}

export const externalRE = /^([a-z]+:)?\/\//
export const isExternalUrl = (url: string): boolean => externalRE.test(url)

export const dataUrlRE = /^\s*data:/i
export const isDataUrl = (url: string): boolean => dataUrlRE.test(url)

export const virtualModuleRE = /^virtual-module:.*/
export const virtualModulePrefix = 'virtual-module:'

// NOTE: We should start relying on the "Sec-Fetch-Dest" header instead of this
// hardcoded list. We can eventually remove this function when the minimum version
// of browsers we support in dev all support this header.
const knownJsSrcRE
  = /\.(?:[jt]sx?|m[jt]s|vue|marko|svelte|astro|imba|mdx)(?:$|\?)/
export function isJSRequest(url: string): boolean {
  url = cleanUrl(url)
  if (knownJsSrcRE.test(url)) {
    return true
  }
  if (!path.extname(url) && url[url.length - 1] !== '/') {
    return true
  }
  return false
}

const importQueryRE = /(\?|&)import=?(?:&|$)/
const directRequestRE = /(\?|&)direct=?(?:&|$)/
const internalPrefixes = [
  FS_PREFIX,
  VALID_ID_PREFIX,
  CLIENT_PUBLIC_PATH,
  ENV_PUBLIC_PATH,
]
const InternalPrefixRE = new RegExp(`^(?:${internalPrefixes.join('|')})`)
const trailingSeparatorRE = /[?&]$/
export const isImportRequest = (url: string): boolean => importQueryRE.test(url)
export function isInternalRequest(url: string): boolean {
  return InternalPrefixRE.test(url)
}

export function removeImportQuery(url: string): string {
  return url.replace(importQueryRE, '$1').replace(trailingSeparatorRE, '')
}
export function removeDirectQuery(url: string): string {
  return url.replace(directRequestRE, '$1').replace(trailingSeparatorRE, '')
}

export const urlRE = /(\?|&)url(?:&|$)/
export const rawRE = /(\?|&)raw(?:&|$)/
export function removeUrlQuery(url: string): string {
  return url.replace(urlRE, '$1').replace(trailingSeparatorRE, '')
}
export function removeRawQuery(url: string): string {
  return url.replace(rawRE, '$1').replace(trailingSeparatorRE, '')
}

export function injectQuery(url: string, queryToInject: string): string {
  const { file, postfix } = splitFileAndPostfix(url)
  const normalizedFile = isWindows ? slash(file) : file
  return `${normalizedFile}?${queryToInject}${postfix[0] === '?' ? `&${postfix.slice(1)}` : /* hash only */ postfix}`
}

const timestampRE = /\bt=\d{13}&?\b/
export function removeTimestampQuery(url: string): string {
  return url.replace(timestampRE, '').replace(trailingSeparatorRE, '')
}

export async function asyncReplace(
  input: string,
  re: RegExp,
  replacer: (match: RegExpExecArray) => string | Promise<string>,
): Promise<string> {
  let match: RegExpExecArray | null
  let remaining = input
  let rewritten = ''
  while ((match = re.exec(remaining))) {
    rewritten += remaining.slice(0, match.index)
    rewritten += await replacer(match)
    remaining = remaining.slice(match.index + match[0].length)
  }
  rewritten += remaining
  return rewritten
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

export function lookupFile(
  dir: string,
  fileNames: string[],
): string | undefined {
  while (dir) {
    for (const fileName of fileNames) {
      const fullPath = path.join(dir, fileName)
      if (tryStatSync(fullPath)?.isFile()) { return fullPath }
    }
    const parentDir = path.dirname(dir)
    if (parentDir === dir) { return }

    dir = parentDir
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

const range: number = 2

export function pad(source: string, n = 2): string {
  const lines = source.split(splitRE)
  return lines.map(l => ` `.repeat(n) + l).join(`\n`)
}

interface Pos {
  /** 1-based */
  line: number
  /** 0-based */
  column: number
}

export function posToNumber(source: string, pos: number | Pos): number {
  if (typeof pos === 'number') {
    return pos
  }
  const lines = source.split(splitRE)
  const { line, column } = pos
  let start = 0
  for (let i = 0; i < line - 1 && i < lines.length; i++) {
    start += lines[i].length + 1
  }
  return start + column
}

export function numberToPos(source: string, offset: number | Pos): Pos {
  if (typeof offset !== 'number') {
    return offset
  }
  if (offset > source.length) {
    throw new Error(
      `offset is longer than source length! offset ${offset} > length ${source.length}`,
    )
  }
  const lines = source.split(splitRE)
  let counted = 0
  let line = 0
  let column = 0
  for (; line < lines.length; line++) {
    const lineLength = lines[line].length + 1
    if (counted + lineLength >= offset) {
      column = offset - counted + 1
      break
    }
    counted += lineLength
  }
  return { line: line + 1, column }
}

export function generateCodeFrame(
  source: string,
  start: number | Pos = 0,
  end?: number | Pos,
): string {
  start = Math.max(posToNumber(source, start), 0)
  end = Math.min(
    end !== undefined ? posToNumber(source, end) : start,
    source.length,
  )
  const lines = source.split(splitRE)
  let count = 0
  const res: string[] = []
  for (let i = 0; i < lines.length; i++) {
    count += lines[i].length
    if (count >= start) {
      for (let j = i - range; j <= i + range || end > count; j++) {
        if (j < 0 || j >= lines.length) { continue }
        const line = j + 1
        res.push(
          `${line}${' '.repeat(Math.max(3 - String(line).length, 0))}|  ${
            lines[j]
          }`,
        )
        const lineLength = lines[j].length
        if (j === i) {
          // push underline
          const pad = Math.max(start - (count - lineLength), 0)
          const length = Math.max(
            1,
            end > count ? lineLength - pad : end - start,
          )
          res.push(`   |  ${' '.repeat(pad)}${'^'.repeat(length)}`)
        }
        else if (j > i) {
          if (end > count) {
            const length = Math.max(Math.min(end - count, lineLength), 1)
            res.push(`   |  ${'^'.repeat(length)}`)
          }
          count += lineLength + 1
        }
      }
      break
    }
    count++
  }
  return res.join('\n')
}

export function isFileReadable(filename: string): boolean {
  if (!tryStatSync(filename)) {
    return false
  }

  try {
    // Check if current process has read permission to the file
    fs.accessSync(filename, fs.constants.R_OK)

    return true
  }
  catch {
    return false
  }
}

const splitFirstDirRE = /(.+?)[\\/](.+)/

/**
 * Delete every file and subdirectory. **The given directory must exist.**
 * Pass an optional `skip` array to preserve files under the root directory.
 */
export function emptyDir(dir: string, skip?: string[]): void {
  const skipInDir: string[] = []
  let nested: Map<string, string[]> | null = null
  if (skip?.length) {
    for (const file of skip) {
      if (path.dirname(file) !== '.') {
        const matched = splitFirstDirRE.exec(file)
        if (matched) {
          nested ??= new Map()
          const [, nestedDir, skipPath] = matched
          let nestedSkip = nested.get(nestedDir)
          if (!nestedSkip) {
            nestedSkip = []
            nested.set(nestedDir, nestedSkip)
          }
          if (!nestedSkip.includes(skipPath)) {
            nestedSkip.push(skipPath)
          }
        }
      }
      else {
        skipInDir.push(file)
      }
    }
  }
  for (const file of fs.readdirSync(dir)) {
    if (skipInDir.includes(file)) {
      continue
    }
    if (nested?.has(file)) {
      emptyDir(path.resolve(dir, file), nested.get(file))
    }
    else {
      fs.rmSync(path.resolve(dir, file), { recursive: true, force: true })
    }
  }
}

export function copyDir(srcDir: string, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true })
  for (const file of fs.readdirSync(srcDir)) {
    const srcFile = path.resolve(srcDir, file)
    if (srcFile === destDir) {
      continue
    }
    const destFile = path.resolve(destDir, file)
    const stat = fs.statSync(srcFile)
    if (stat.isDirectory()) {
      copyDir(srcFile, destFile)
    }
    else {
      fs.copyFileSync(srcFile, destFile)
    }
  }
}

export const ERR_SYMLINK_IN_RECURSIVE_READDIR
  = 'ERR_SYMLINK_IN_RECURSIVE_READDIR'
export async function recursiveReaddir(dir: string): Promise<string[]> {
  if (!fs.existsSync(dir)) {
    return []
  }
  let dirents: fs.Dirent[]
  try {
    dirents = await fsp.readdir(dir, { withFileTypes: true })
  }
  catch (e) {
    // @ts-ignore
    if (e.code === 'EACCES') {
      // Ignore permission errors
      return []
    }
    throw e
  }
  if (dirents.some(dirent => dirent.isSymbolicLink())) {
    const err: any = new Error(
      'Symbolic links are not supported in recursiveReaddir',
    )
    err.code = ERR_SYMLINK_IN_RECURSIVE_READDIR
    throw err
  }
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name)
      return dirent.isDirectory() ? recursiveReaddir(res) : normalizePath(res)
    }),
  )
  return files.flat(1)
}

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

/**
 * Returns resolved localhost address when `dns.lookup` result differs from DNS
 *
 * `dns.lookup` result is same when defaultResultOrder is `verbatim`.
 * Even if defaultResultOrder is `ipv4first`, `dns.lookup` result maybe same.
 * For example, when IPv6 is not supported on that machine/network.
 */
export async function getLocalhostAddressIfDiffersFromDNS(): Promise<
  string | undefined
> {
  const [nodeResult, dnsResult] = await Promise.all([
    dns.lookup('localhost'),
    dns.lookup('localhost', { verbatim: true }),
  ])
  const isSame
    = nodeResult.family === dnsResult.family
      && nodeResult.address === dnsResult.address
  return isSame ? undefined : nodeResult.address
}

export interface Hostname {
  /** undefined sets the default behaviour of server.listen */
  host: string | undefined
  /** resolve to localhost when possible */
  name: string
}

export function arraify<T>(target: T | T[]): T[] {
  return Array.isArray(target) ? target : [target]
}

// Taken from https://stackoverflow.com/a/36328890
export const multilineCommentsRE = /\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g
export const singlelineCommentsRE = /\/\/.*/g
export const requestQuerySplitRE = /\?(?!.*[/|}])/
export const requestQueryMaybeEscapedSplitRE = /\\?\?(?!.*[/|}])/

export const blankReplacer = (match: string): string => ' '.repeat(match.length)

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

type AsyncFlatten<T extends unknown[]> = T extends (infer U)[]
  ? Exclude<Awaited<U>, U[]>[]
  : never

export async function asyncFlatten<T extends unknown[]>(
  arr: T,
): Promise<AsyncFlatten<T>> {
  do {
    arr = (await Promise.all(arr)).flat(Infinity) as any
  } while (arr.some((v: any) => v?.then))
  return arr as unknown[] as AsyncFlatten<T>
}

// strip UTF-8 BOM
export function stripBomTag(content: string): string {
  if (content.charCodeAt(0) === 0xFEFF) {
    return content.slice(1)
  }

  return content
}

export function removeLeadingSlash(str: string): string {
  return str[0] === '/' ? str.slice(1) : str
}

export function getRandomId() {
  return Math.random().toString(36).substring(2, 15)
}

export function stripBase(path: string, base: string): string {
  if (path === base) {
    return '/'
  }
  const devBase = withTrailingSlash(base)
  return path.startsWith(devBase) ? path.slice(devBase.length - 1) : path
}

export function arrayEqual(a: any[], b: any[]): boolean {
  if (a === b) { return true }
  if (a.length !== b.length) { return false }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) { return false }
  }
  return true
}

export function evalValue<T = any>(rawValue: string): T {
  // eslint-disable-next-line no-new-func
  const fn = new Function(`
    var console, exports, global, module, process, require
    return (\n${rawValue}\n)
  `)
  return fn()
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

export function getPkgName(name: string): string | undefined {
  return name[0] === '@' ? name.split('/')[1] : name
}

const escapeRegexRE = /[-/\\^$*+?.()|[\]{}]/g
export function escapeRegex(str: string): string {
  return str.replace(escapeRegexRE, '\\$&')
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
