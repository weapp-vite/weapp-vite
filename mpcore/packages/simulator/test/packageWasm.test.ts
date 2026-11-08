import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles, createBrowserVirtualFilesFromDirectory, readBrowserVirtualBinary } from '../src/browser'
import { createFileSystemArtifactSource, createMemoryArtifactSource, createOverlayArtifactSource } from '../src/kernel'
import { createArtifactProject, createPluginArtifactSource, createPluginVirtualRoot } from '../src/project'
import { createHeadlessSession } from '../src/runtime'
import { createPackageWebAssembly } from '../src/runtime/packageWebAssembly'
import { createHeadlessWxState } from '../src/runtime/wxState'
import { cleanupTempDirs } from './helpers'
import { addWasmBytes, createPackageWasmFiles } from './helpers/packageWasmFiles'

const directories: string[] = []
afterEach(() => cleanupTempDirs(directories))

it.each(['memory', 'filesystem', 'browser'] as const)('executes packaged WASM and preserves binary snapshots in the %s session', async (provider) => {
  const files = createPackageWasmFiles()
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-package-wasm-'))
  directories.push(root)
  if (provider === 'filesystem') {
    for (const [file, content] of files) {
      const target = path.join(root, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, typeof content === 'string' ? content : new Uint8Array(content))
    }
  }
  const create = () => provider === 'browser'
    ? createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
    : createHeadlessSession({ project: createArtifactProject({
        miniprogramRootPath: root,
        artifactSource: provider === 'filesystem'
          ? createFileSystemArtifactSource()
          : createMemoryArtifactSource(files.map(([file, content]) => [path.join(root, file), content])),
      }) })
  const hostWebAssembly = globalThis.WebAssembly
  const first = create()
  const second = create()
  try {
    const page = first.reLaunch('/pages/index')
    const secondPage = second.reLaunch('/pages/index')
    expect(await page.run()).toEqual({ result: 42, bytes: '0,255,128,42', saved: '0,255,128,42' })
    expect(() => secondPage.snapshotSize()).toThrow('no such file')
    expect(page.snapshotSize()).toBe(4)
    page.remove()
    expect(() => page.snapshotSize()).toThrow('no such file')
    expect(globalThis.WebAssembly).toBe(hostWebAssembly)
    expect(first.getDiagnostics()).toEqual([])
  }
  finally {
    first.close()
    second.close()
  }
})

it('preserves binary artifacts without sharing mutable buffers', () => {
  const file = path.resolve('shared/add.wasm')
  const source = createMemoryArtifactSource([[file, addWasmBytes.buffer]])
  const read = source.readBinary?.(file)
  expect(read).toEqual(addWasmBytes.buffer)
  new Uint8Array(read!)[0] = 99
  expect(new Uint8Array(source.readBinary!(file)!)[0]).toBe(0)
})

it('reads binary overlay precedence without returning stale fallback bytes', () => {
  const file = path.resolve('shared/add.wasm')
  const fallback = createMemoryArtifactSource([[file, addWasmBytes.buffer]])
  const overlay = createMemoryArtifactSource([[file, new Uint8Array([0, 255]).buffer]])
  expect(new Uint8Array(createOverlayArtifactSource(overlay, fallback).readBinary!(file)!)).toEqual(new Uint8Array([0, 255]))
  expect(createOverlayArtifactSource(createMemoryArtifactSource([]), fallback).readBinary!(file)).toEqual(addWasmBytes.buffer)
})

it('preserves host and remapped plugin binary reads through the project artifact wrapper', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-plugin-binary-'))
  directories.push(root)
  const miniprogramRoot = path.join(root, 'dist')
  const pluginRoot = path.join(root, 'plugin')
  const hostWasm = path.join(miniprogramRoot, 'shared/assets/add.wasm')
  const source = createPluginArtifactSource(createMemoryArtifactSource([
    [hostWasm, addWasmBytes.buffer],
    [path.join(pluginRoot, 'assets/add.wasm'), addWasmBytes.buffer],
  ]), miniprogramRoot, [{ alias: 'probe', config: {}, provider: 'provider', rootPath: pluginRoot, virtualRoot: createPluginVirtualRoot('probe') }])
  expect(source.readBinary?.(hostWasm)).toEqual(addWasmBytes.buffer)
  expect(source.readBinary?.(path.join(miniprogramRoot, createPluginVirtualRoot('probe'), 'assets/add.wasm'))).toEqual(addWasmBytes.buffer)
  expect(source.readBinary?.(path.join(miniprogramRoot, 'missing.wasm'))).toBeUndefined()
  expect(createPluginArtifactSource({ has: () => false, readText: () => undefined }, miniprogramRoot, []).readBinary?.(hostWasm)).toBeUndefined()
})

it('imports browser directory bytes without decoding the WASM payload as text', async () => {
  const files = await createBrowserVirtualFilesFromDirectory([{
    name: 'add.wasm',
    webkitRelativePath: 'shared/add.wasm',
    arrayBuffer: async () => addWasmBytes.slice().buffer,
    text: async () => { throw new Error('Binary files must not be decoded during import') },
  }])
  expect(readBrowserVirtualBinary(files, 'shared/add.wasm')).toEqual(addWasmBytes.buffer)
})

it('executes current package bytes and rejects missing, invalid and escaped WASM paths', async () => {
  let content = addWasmBytes.slice().buffer
  const reads: string[] = []
  const wasm = createPackageWebAssembly((file) => {
    reads.push(file)
    return file === 'shared/add.wasm' ? content : undefined
  })
  const loaded = await wasm.instantiate('/shared/add.wasm', {})
  expect('instance' in loaded && typeof loaded.instance.exports.add === 'function').toBe(true)
  content = new Uint8Array([0, 255]).buffer
  await expect(wasm.instantiate('shared/add.wasm', {})).rejects.toThrow(WebAssembly.CompileError)
  await expect(wasm.instantiate('shared/missing.wasm', {})).rejects.toThrow('file not found')
  for (const file of ['../secret.wasm', '/../../secret.wasm', 'wxfile://usr/secret.wasm', 'C:\\secret.wasm']) {
    await expect(wasm.instantiate(file, {})).rejects.toThrow('file not found')
    expect(reads).not.toContain(file)
  }
})

it('appends and copies binary files while keeping byte size and digest correct', () => {
  const state = createHeadlessWxState()
  const fs = state.getFileSystemManager()
  fs.writeFileSync('snapshot.db', new Uint8Array([0, 255]).buffer)
  fs.appendFileSync('snapshot.db', new Uint8Array([128, 1]).buffer)
  fs.copyFileSync('snapshot.db', 'snapshot-copy.db')
  fs.renameSync('snapshot-copy.db', 'snapshot-renamed.db')
  const bytes = new Uint8Array([0, 255, 128, 1])
  expect(new Uint8Array(fs.readFileSync('snapshot-renamed.db'))).toEqual(bytes)
  expect(fs.statSync('snapshot-renamed.db').size).toBe(4)
  const snapshot = state.getFileSnapshot()['snapshot-renamed.db'] as ArrayBuffer
  new Uint8Array(snapshot)[0] = 99
  expect(new Uint8Array(fs.readFileSync('snapshot-renamed.db'))).toEqual(bytes)
  expect(state.getFileInfo({ filePath: 'snapshot-renamed.db' }).digest).toBe(createHash('md5').update(bytes).digest('hex'))
  expect(state.getFileInfo({ filePath: 'snapshot-renamed.db', digestAlgorithm: 'sha1' }).digest).toBe(createHash('sha1').update(bytes).digest('hex'))
})
