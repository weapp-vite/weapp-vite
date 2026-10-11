import type { ManagedWechatHostIdentity, ManagedWechatProjectRecord, ManagedWechatWindowLogCursor } from '../types'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 身份与文件描述符检查复用跨平台子进程封装。
import { execa } from 'execa'
import { readManagedProcessIdentity, sameManagedProcess } from '../host'
import { captureActiveLogCursor } from './logCursor'

export interface ActiveMainLogCursors {
  cursors: ManagedWechatWindowLogCursor[]
  host: ManagedWechatHostIdentity
}

interface OpenFile {
  descriptor: string
  access?: string
  type?: string
  device?: string
  inode?: string
  links?: string
  filename?: string
}

const inspectionOptions = { timeout: 3_000, reject: false, windowsHide: true } as const

function invalidLog(reason: string) {
  return new Error(`Managed DevTools active MAIN log ${reason}; destruction evidence is unresolved.`)
}

async function parentPid(pid: number) {
  const result = await execa('ps', ['-p', String(pid), '-o', 'ppid='], inspectionOptions)
  const value = result.stdout.trim()
  const parent = Number(value)
  if (result.exitCode !== 0 || !/^\d+$/.test(value) || !Number.isSafeInteger(parent) || parent <= 0 || parent === pid) {
    throw invalidLog('parent process could not be verified')
  }
  return parent
}

async function currentIdentity(expected: ManagedWechatHostIdentity) {
  const live = await readManagedProcessIdentity(expected.pid, 'darwin')
  if (!live || !sameManagedProcess(expected, live)) {
    throw invalidLog('process identity changed')
  }
  return live
}

async function selectedInstallation(record: ManagedWechatProjectRecord) {
  const cliPath = await fs.realpath(record.target.cliPath)
  const macos = path.dirname(cliPath)
  const contents = path.dirname(macos)
  const bundle = path.dirname(contents)
  const appPath = await fs.realpath(record.target.appPath)
  if (path.basename(macos) !== 'MacOS' || path.basename(contents) !== 'Contents' || !bundle.endsWith('.app')
    || !['app.asar', 'app', 'package.nw'].some(name => appPath === path.join(contents, 'Resources', name))) {
    throw invalidLog('CLI and application resources do not identify one selected bundle')
  }
  return { cliPath, appPath, bundle }
}

async function assertLogDirectory(record: ManagedWechatProjectRecord, directory: string) {
  const profile = await fs.realpath(record.target.profileDir)
  if (directory !== path.join(profile, 'WeappLog', 'logs') || await fs.realpath(directory) !== directory) {
    throw invalidLog('directory was redirected or does not belong to the selected profile')
  }
}

async function mainHost(record: ManagedWechatProjectRecord, bundlePath: string): Promise<ManagedWechatHostIdentity> {
  const backend = await currentIdentity(record.host!)
  const executable = await fs.realpath(backend.executable)
  const expected = path.join(bundlePath, 'Contents', 'MacOS', 'Electron')
  if (executable === expected) {
    return backend
  }
  if (!executable.startsWith(`${bundlePath}${path.sep}`)) {
    throw invalidLog('backend belongs to a different installation')
  }
  const main = await readManagedProcessIdentity(await parentPid(backend.pid), 'darwin')
  if (!main || await fs.realpath(main.executable) !== expected) {
    throw invalidLog('parent does not belong to the selected main executable')
  }
  const mainStarted = Date.parse(main.started)
  const backendStarted = Date.parse(backend.started)
  if (!Number.isFinite(mainStarted) || !Number.isFinite(backendStarted) || mainStarted > backendStarted) {
    throw invalidLog('parent process generation is inconsistent')
  }
  return main
}

/** NUL 字段保留文件名中的空白与换行；每个描述符必须来自唯一指定进程。 */
function parseOpenFiles(output: string, pid: number) {
  const files: OpenFile[] = []
  const properties = { a: 'access', t: 'type', D: 'device', i: 'inode', k: 'links', n: 'filename' } as const
  let processSeen = false
  let current: OpenFile | undefined
  for (const raw of output.split('\0')) {
    const field = raw.replace(/^\n/, '')
    if (!field) {
      continue
    }
    const key = field[0]!
    const value = field.slice(1)
    if (key === 'p') {
      if (processSeen || value !== String(pid)) {
        throw invalidLog('file descriptors belong to an ambiguous process')
      }
      processSeen = true
    }
    else if (key === 'f' && processSeen) {
      current = { descriptor: value }
      files.push(current)
    }
    else if (current && key in properties) {
      const property = properties[key as keyof typeof properties]
      if (current[property] !== undefined) {
        throw invalidLog('file descriptor fields are ambiguous')
      }
      current[property] = value
    }
    else {
      throw invalidLog('file descriptor output could not be verified')
    }
  }
  if (!processSeen) {
    throw invalidLog('main process has no file descriptor evidence')
  }
  return files
}

async function existingLog(file: OpenFile, directory: string) {
  if (!/^\d+$/.test(file.descriptor) || !['w', 'u'].includes(file.access ?? '') || file.type !== 'REG'
    || !file.filename?.endsWith('.log') || path.dirname(file.filename) !== directory) {
    return undefined
  }
  if (!file.links || !/^\d+$/.test(file.links) || !file.device || !/^0x[\da-f]+$/i.test(file.device)
    || !file.inode || !/^\d+$/.test(file.inode)) {
    throw invalidLog('file descriptor identity could not be verified')
  }
  // FileTransport 会保留已被轮转删除的旧描述符；零链接证明它不能再提供路径上的新增日志。
  if (BigInt(file.links) === 0n) {
    return undefined
  }
  const stat = await fs.lstat(file.filename, { bigint: true })
  if (!stat.isFile() || await fs.realpath(file.filename) !== file.filename
    || stat.dev !== BigInt(file.device) || stat.ino !== BigInt(file.inode) || stat.nlink !== BigInt(file.links)) {
    throw invalidLog('file was redirected or replaced')
  }
  return { name: path.basename(file.filename), identity: `${stat.dev}:${stat.ino}` }
}

async function readWritableLogs(pid: number, directory: string) {
  const result = await execa('lsof', ['-nP', '-a', '-p', String(pid), '-F0pftainDk'], inspectionOptions)
  if (result.exitCode !== 0) {
    throw invalidLog('file descriptor inspection failed')
  }
  const files = parseOpenFiles(result.stdout, pid)
  const candidates: { file: OpenFile, name: string, identity: string }[] = []
  for (const file of files) {
    const candidate = await existingLog(file, directory)
    if (candidate) {
      candidates.push({ file, ...candidate })
    }
  }
  if (!candidates.length) {
    throw invalidLog('requires at least one verified writable file')
  }
  const descriptors = new Set<string>()
  const identities = new Map<string, string>()
  for (const candidate of candidates) {
    if (descriptors.has(candidate.file.descriptor) || (identities.has(candidate.identity) && identities.get(candidate.identity) !== candidate.name)) {
      throw invalidLog('file descriptors contain ambiguous aliases')
    }
    descriptors.add(candidate.file.descriptor)
    identities.set(candidate.identity, candidate.name)
  }
  return candidates.sort((a, b) => Number(a.file.descriptor) - Number(b.file.descriptor))
}

/** 仅用已登记 backend 的直接父进程固定全部活动流；游标捕获前后核验完整描述符集合，不授予父进程清理权。 */
export async function captureActiveMainLogCursors(record: ManagedWechatProjectRecord, directory: string, platform = process.platform): Promise<ActiveMainLogCursors | undefined> {
  if (platform !== 'darwin' || !record.host) {
    return undefined
  }
  await assertLogDirectory(record, directory)
  const installation = await selectedInstallation(record)
  const main = await mainHost(record, installation.bundle)
  const candidates = await readWritableLogs(main.pid, directory)
  const cursors: ManagedWechatWindowLogCursor[] = []
  for (const candidate of candidates) {
    if (!cursors.some(cursor => cursor.identity === candidate.identity)) {
      cursors.push(...await captureActiveLogCursor(directory, candidate))
    }
  }
  const retained = await readWritableLogs(main.pid, directory)
  if (retained.length !== candidates.length || retained.some((file, index) => {
    const candidate = candidates[index]!
    return file.file.descriptor !== candidate.file.descriptor || file.name !== candidate.name || file.identity !== candidate.identity
      || file.file.access !== candidate.file.access || file.file.links !== candidate.file.links
  })) {
    throw invalidLog('file descriptor set changed during capture')
  }
  const after = await mainHost(record, installation.bundle)
  const selected = await selectedInstallation(record)
  if (!sameManagedProcess(main, after) || selected.appPath !== installation.appPath || selected.cliPath !== installation.cliPath || selected.bundle !== installation.bundle) {
    throw invalidLog('main process or selected directory changed')
  }
  await assertLogDirectory(record, directory)
  for (const candidate of candidates) {
    const verified = await existingLog(candidate.file, directory)
    if (!verified || verified.identity !== candidate.identity) {
      throw invalidLog('file changed during capture')
    }
  }
  return { cursors, host: main }
}
