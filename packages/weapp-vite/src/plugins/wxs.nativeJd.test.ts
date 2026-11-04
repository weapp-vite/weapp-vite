import type { CompilerContext } from '../context'
import type { WxmlDep } from '../types'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { expect, it, vi } from 'vitest'
import { wxs } from './wxs'

it.each([
  { label: 'JDS update', extension: 'jxml', changed: 'peer.jds' },
  { label: 'partial native template update', extension: 'jxml', changed: 'index.jxml' },
  { label: 'partial portable template update', extension: 'wxml', changed: 'index.wxml' },
])('re-emits fresh JD native cycles and binds only source dependencies during $label', async ({ extension, changed }) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-native-jds-'))
  const main = path.join(root, 'main.jds')
  const peer = path.join(root, 'peer.jds')
  const compound = path.join(root, 'shared.wxs.js')
  const outputOnly = path.join(root, 'output-only.jds')
  const setTokenDeps = vi.fn(async (_file: string, _deps: WxmlDep[]) => {})
  const owner = path.join(root, `index.${extension}`)
  const otherOwner = path.join(root, `other.${extension}`)
  const ctx = {
    configService: {
      absoluteSrcRoot: root,
      platform: 'jd',
      isDev: true,
      outputExtensions: { wxml: 'jxml', wxs: 'wxs' },
      relativeOutputPath: (file: string) => path.relative(root, file).replaceAll('\\', '/'),
    },
    wxmlService: {
      tokenMap: new Map([owner, otherOwner].map(file => [file, { deps: [
        { tagName: 'jds', value: './main.jds', attrs: { src: './main.jds' } },
        { tagName: 'wxs', value: './portable.wxs.ts', attrs: { src: './portable.wxs.ts' } },
      ] }] as const)),
      setTokenDeps,
    },
    runtimeState: { build: { hmr: { profile: { event: 'update', file: path.join(root, changed) } } } },
  } as unknown as CompilerContext
  const plugin = wxs(ctx)[0]!
  const hook = plugin.generateBundle
  const generate = typeof hook === 'function' ? hook : hook!.handler
  let emitted: Array<{ fileName: string, source: string }> = []
  const watches = new Set<string>()
  const host = { emitFile: (asset: any) => emitted.push(asset), addWatchFile: (file: string) => watches.add(file) }
  const bundle = Object.fromEntries(['index', 'other', 'generated'].map(name => [`${name}.jxml`, {
    type: 'asset' as const,
    fileName: `${name}.jxml`,
    source: name === 'generated' ? '<jds src="./output-only.jds"/>' : '<jds src="./main.jds"/><wxs src="./portable.wxs"/>',
  }]))
  try {
    await writeFile(main, 'var peer = require("./peer.jds"); var shared = require("./shared.wxs.js"); module.exports = { value: peer.value + shared.value }\r\n')
    await writeFile(peer, 'var main = require("./main.jds"); module.exports = { value: 42 }\n')
    await writeFile(compound, 'module.exports = { value: 1 }\r\n')
    await writeFile(outputOnly, 'module.exports = { value: 9 }\n')
    await generate.call(host as any, {} as any, bundle, false)
    expect(emitted.map(asset => asset.fileName).sort()).toEqual(['main.jds', 'output-only.jds', 'peer.jds', 'shared.wxs.js'])
    expect(emitted.find(asset => asset.fileName === 'main.jds')?.source).toBe(await readFile(main, 'utf8'))
    expect(emitted.find(asset => asset.fileName === 'shared.wxs.js')?.source).toBe(await readFile(compound, 'utf8'))
    expect(emitted.find(asset => asset.fileName === 'output-only.jds')?.source).toBe(await readFile(outputOnly, 'utf8'))
    for (const file of [owner, otherOwner]) {
      expect(setTokenDeps).toHaveBeenCalledWith(file, expect.arrayContaining([
        expect.objectContaining({ value: './main.jds' }),
        expect.objectContaining({ value: './portable.wxs.ts' }),
        expect.objectContaining({ value: 'peer.jds' }),
        expect.objectContaining({ value: 'shared.wxs.js' }),
      ]))
    }
    expect(setTokenDeps.mock.calls.every(([file]) => file === owner || file === otherOwner)).toBe(true)
    expect([...watches].sort()).toEqual([main, peer, compound, outputOnly].sort())
    emitted = []
    await writeFile(peer, 'var main = require("./main.jds"); module.exports = { value: 43 }\r\n')
    await generate.call(host as any, {} as any, bundle, false)
    expect(emitted.find(asset => asset.fileName === 'peer.jds')?.source).toBe(await readFile(peer, 'utf8'))
    expect(emitted.some(asset => asset.fileName.endsWith('.wxs'))).toBe(false)
    await writeFile(main, 'module.exports = { value: 44 }\n')
    setTokenDeps.mockClear()
    await generate.call(host as any, {} as any, bundle, false)
    for (const file of [owner, otherOwner]) {
      expect(setTokenDeps).toHaveBeenCalledWith(file, [expect.objectContaining({ value: './main.jds' }), expect.objectContaining({ value: './portable.wxs.ts' })])
    }
    await writeFile(main, 'var typed = require("./typed.ts"); module.exports = typed')
    await writeFile(path.join(root, 'typed.ts'), 'const value: number = 1; module.exports = { value }')
    emitted = []
    await expect(generate.call(host as any, {} as any, bundle, false)).rejects.toThrow('Native script modules require an explicit file extension and cannot use lang=js/ts')
    expect(emitted).toEqual([])
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
