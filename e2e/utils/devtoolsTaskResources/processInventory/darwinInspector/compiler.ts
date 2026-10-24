import type { DarwinInspectorBuildIdentity, PreparedDarwinInspector } from './types'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import { arch } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 显式 Darwin 工具链命令，不经过 shell。
import { execa } from 'execa'

const defaultCache = fileURLToPath(new URL('../../../../../.tmp/darwin-process-inspector/', import.meta.url))
const sourcePath = fileURLToPath(new URL('./helper.m', import.meta.url))
const pending = new Map<string, Promise<PreparedDarwinInspector>>()
export const darwinInspectorHash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex')

interface BuildMetadata {
  schema: 1
  identityKey: string
  identity: DarwinInspectorBuildIdentity
  binaryHash: string
}

async function command(executable: string, args: string[]) {
  const result = await execa(executable, args, { timeout: 30_000, reject: false })
  if (result.exitCode !== 0 || result.timedOut || result.signal || !result.stdout.trim()) {
    throw new Error(`Darwin inspector requires a working public macOS SDK and compiler: ${executable}`)
  }
  return result.stdout.trim()
}

async function regularFile(file: string, executable = false) {
  const stat = await fs.lstat(file)
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o6022) !== 0
    || (typeof process.getuid === 'function' && stat.uid !== process.getuid())
    || (executable && (stat.mode & 0o100) === 0)) {
    throw new Error('Darwin inspector cache contains an unsafe file.')
  }
  return fs.readFile(file)
}

async function readCache(cacheDirectory: string, identity: DarwinInspectorBuildIdentity, identityKey: string): Promise<PreparedDarwinInspector> {
  if (darwinInspectorHash(JSON.stringify(identity)) !== identityKey || path.basename(cacheDirectory) !== identityKey) {
    throw new Error('Darwin inspector cache identity hash does not match.')
  }
  const directory = await fs.lstat(cacheDirectory)
  if (!directory.isDirectory() || directory.isSymbolicLink()) {
    throw new Error('Darwin inspector cache directory is invalid.')
  }
  const metadataBytes = await regularFile(path.join(cacheDirectory, 'metadata.json'))
  const expectedMetadataHash = (await regularFile(path.join(cacheDirectory, 'metadata.sha256'))).toString().trim()
  const metadataHash = darwinInspectorHash(metadataBytes)
  if (metadataHash !== expectedMetadataHash) {
    throw new Error('Darwin inspector metadata hash does not match.')
  }
  const metadata: unknown = JSON.parse(metadataBytes.toString())
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('Darwin inspector metadata is invalid.')
  }
  const value = metadata as BuildMetadata
  if (Object.keys(value).sort().join(',') !== 'binaryHash,identity,identityKey,schema' || value.schema !== 1
    || value.identityKey !== identityKey || JSON.stringify(value.identity) !== JSON.stringify(identity)
    || typeof value.binaryHash !== 'string' || !/^[a-f0-9]{64}$/.test(value.binaryHash)) {
    throw new Error('Darwin inspector cache provenance does not match.')
  }
  if (darwinInspectorHash(await regularFile(path.join(cacheDirectory, 'helper.m'))) !== identity.sourceHash) {
    throw new Error('Darwin inspector cached source hash does not match.')
  }
  const executable = path.join(cacheDirectory, 'inspector')
  if (darwinInspectorHash(await regularFile(executable, true)) !== value.binaryHash) {
    throw new Error('Darwin inspector binary hash does not match.')
  }
  if (await fs.realpath(executable) !== executable) {
    throw new Error('Darwin inspector executable path changed.')
  }
  return { executable, cacheDirectory, identityKey, binaryHash: value.binaryHash, metadataHash, identity }
}

/** 派发前再次验证缓存证据，不在已经启动的共享预算中重新编译。 */
export async function verifyPreparedDarwinInspector(prepared: PreparedDarwinInspector) {
  const verified = await readCache(prepared.cacheDirectory, prepared.identity, prepared.identityKey)
  if (verified.binaryHash !== prepared.binaryHash || verified.metadataHash !== prepared.metadataHash || verified.executable !== prepared.executable) {
    throw new Error('Darwin inspector prepared artifact changed before dispatch.')
  }
  return verified
}

/** 开始共享采样预算前准备产物；缓存损坏、SDK 缺失和编译失败均明确停止。 */
export async function prepareDarwinInspector(options: { cacheRoot?: string, platform?: NodeJS.Platform } = {}): Promise<PreparedDarwinInspector> {
  if ((options.platform ?? process.platform) !== 'darwin') {
    throw new Error('Darwin inspector is only available on macOS.')
  }
  const machineArch = arch()
  if (!['arm64', 'x64'].includes(machineArch)) {
    throw new Error('Darwin inspector does not support this macOS architecture.')
  }
  const source = await fs.readFile(sourcePath)
  const compilerPath = await fs.realpath(await command('/usr/bin/xcrun', ['--find', 'clang']))
  const sdkPath = await fs.realpath(await command('/usr/bin/xcrun', ['--sdk', 'macosx', '--show-sdk-path']))
  const sdkBuild = await command('/usr/bin/xcrun', ['--sdk', 'macosx', '--show-sdk-build-version'])
  const compilerVersion = await command(compilerPath, ['--version'])
  const identity: DarwinInspectorBuildIdentity = {
    sourceHash: darwinInspectorHash(source),
    arch: machineArch,
    sdkPath,
    sdkBuild,
    compilerPath,
    compilerHash: darwinInspectorHash(await fs.readFile(compilerPath)),
    compilerVersion,
  }
  const identityKey = darwinInspectorHash(JSON.stringify(identity))
  await fs.mkdir(options.cacheRoot ?? defaultCache, { recursive: true, mode: 0o700 })
  const root = await fs.realpath(options.cacheRoot ?? defaultCache)
  const cacheDirectory = path.join(root, identityKey)
  const inFlight = pending.get(cacheDirectory)
  if (inFlight) {
    const prepared = await inFlight
    return verifyPreparedDarwinInspector(prepared)
  }
  const build = async () => {
    let exists = false
    try {
      await fs.lstat(cacheDirectory)
      exists = true
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
    if (exists) {
      return readCache(cacheDirectory, identity, identityKey)
    }
    const temporary = await fs.mkdtemp(path.join(root, '.preparing-'))
    try {
      const snapshotSource = path.join(temporary, 'helper.m')
      const binary = path.join(temporary, 'inspector')
      await fs.writeFile(snapshotSource, source, { mode: 0o600 })
      const result = await execa(compilerPath, ['-arch', machineArch === 'x64' ? 'x86_64' : 'arm64', '-fobjc-arc', '-O2', '-Wall', '-Wextra', '-Werror', '-framework', 'Foundation', '-isysroot', sdkPath, snapshotSource, '-o', binary], { timeout: 30_000, reject: false })
      if (result.exitCode !== 0 || result.timedOut || result.signal) {
        throw new Error(`Darwin inspector compilation failed: ${result.stderr}`)
      }
      await fs.chmod(binary, 0o700)
      const metadata: BuildMetadata = { schema: 1, identityKey, identity, binaryHash: darwinInspectorHash(await regularFile(binary, true)) }
      const metadataBytes = `${JSON.stringify(metadata)}\n`
      await fs.writeFile(path.join(temporary, 'metadata.json'), metadataBytes, { mode: 0o600 })
      await fs.writeFile(path.join(temporary, 'metadata.sha256'), `${darwinInspectorHash(metadataBytes)}\n`, { mode: 0o600 })
      try {
        await fs.rename(temporary, cacheDirectory)
      }
      catch (error) {
        if (!['EEXIST', 'ENOTEMPTY'].includes((error as NodeJS.ErrnoException).code ?? '')) {
          throw error
        }
      }
      return await readCache(cacheDirectory, identity, identityKey)
    }
    finally {
      // 只清理本次 mkdtemp 创建的目录，已发布目录和其他构建不受影响。
      await fs.rm(temporary, { recursive: true, force: true })
    }
  }
  const preparation = build()
  pending.set(cacheDirectory, preparation)
  try {
    return await preparation
  }
  finally {
    pending.delete(cacheDirectory)
  }
}
