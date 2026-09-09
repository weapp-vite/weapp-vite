import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createReactPlugin, isReactStaticTemplateSource, resolveReactConfigValue } from './index'

describe('react plugin', () => {
  it('resolves project-level defaults', () => {
    expect(resolveReactConfigValue(true)).toEqual({
      compiler: false,
      renderMode: 'auto',
      devWarnings: true,
    })
    expect(resolveReactConfigValue(false)).toBeUndefined()
    expect(isReactStaticTemplateSource(true, '/project/src/pages/home/view.tsx')).toBe(true)
    expect(isReactStaticTemplateSource({ renderMode: 'dynamic' }, '/project/src/pages/home/view.tsx')).toBe(false)
    expect(isReactStaticTemplateSource(true, '/project/node_modules/pkg/view.tsx')).toBe(false)
  })

  it('transforms TSX with the automatic React runtime', async () => {
    const plugin = createReactPlugin({
      configService: { weappViteConfig: { react: true } },
    } as any)[0]
    const result = await plugin.transform!.call({
      warn: vi.fn(),
    } as any, 'export const view = () => <view>hello</view>', '/project/src/pages/index/view.tsx')
    expect(result).toMatchObject({ code: expect.stringContaining('jsx') })
  })

  it('emits a page view template as the page index WXML', async () => {
    const plugin = createReactPlugin({
      configService: {
        cwd: '/project',
        weappViteConfig: { react: true },
      },
    } as any)[0]
    await plugin.transform!.call({ warn: vi.fn() } as any, 'export function View() { return <view>hello</view> }', '/project/src/pages/home/view.tsx')

    const emitted: Array<Record<string, unknown>> = []
    plugin.generateBundle!.call({
      emitFile(asset: Record<string, unknown>) {
        emitted.push(asset)
      },
    } as any, {} as any, {})

    expect(emitted).toContainEqual(expect.objectContaining({
      fileName: 'pages/home/index.wxml',
      source: '<view>hello</view>',
    }))
  })

  it('emits the dynamic page wrapper and shared runtime template after static fallback', async () => {
    const plugin = createReactPlugin({
      configService: {
        cwd: '/project',
        weappViteConfig: { react: true },
      },
    } as any)[0]
    await plugin.transform!.call({ warn: vi.fn() } as any, `
      export function View({ items }) {
        return <view>{items.map(item => <text key={item}>{item}</text>)}</view>
      }
    `, '/project/src/pages/home/view.tsx')

    const emitted: Array<Record<string, unknown>> = []
    plugin.generateBundle!.call({
      emitFile(asset: Record<string, unknown>) {
        emitted.push(asset)
      },
    } as any, {} as any, {})

    expect(emitted).toContainEqual(expect.objectContaining({
      fileName: 'pages/home/index.wxml',
      source: '<import src="../../runtime/base.wxml" />\n<template is="react_root" data="{{root:root}}" />',
    }))
    expect(emitted).toContainEqual(expect.objectContaining({
      fileName: 'runtime/base.wxml',
    }))
  })

  it('validates native bridge registrations before emitting WXML', async () => {
    const plugin = createReactPlugin({
      configService: {
        cwd: '/project',
        weappViteConfig: { react: true },
      },
    } as any)[0]
    await plugin.transform!.call({ warn: vi.fn() } as any, `
      import { createNativeComponent } from '@weapp-vite/react'
      const NativeCard = createNativeComponent('native-card')
      export function View() { return <NativeCard label="ready" /> }
    `, '/project/src/pages/home/view.tsx')

    const emitted: Array<Record<string, unknown>> = []
    plugin.generateBundle!.call({
      emitFile(asset: Record<string, unknown>) {
        emitted.push(asset)
      },
    } as any, {} as any, {
      'pages/home/index.json': {
        fileName: 'pages/home/index.json',
        name: undefined,
        names: [],
        needsCodeReference: false,
        originalFileName: undefined,
        originalFileNames: [],
        source: '{"usingComponents":{"native-card":"/components/native-card/index"}}',
        type: 'asset',
      },
    } as any)

    expect(emitted).toContainEqual(expect.objectContaining({
      fileName: 'pages/home/index.wxml',
      source: '<native-card label="ready" />',
    }))
  })

  it('rejects missing native bridge registrations', async () => {
    const plugin = createReactPlugin({
      configService: {
        cwd: '/project',
        weappViteConfig: { react: true },
      },
    } as any)[0]
    await plugin.transform!.call({ warn: vi.fn() } as any, `
      import { createNativeComponent } from '@weapp-vite/react'
      const NativeCard = createNativeComponent('native-card')
      export function View() { return <NativeCard /> }
    `, '/project/src/pages/home/view.tsx')

    expect(() => plugin.generateBundle!.call({ emitFile: vi.fn() } as any, {} as any, {
      'pages/home/index.json': {
        source: '{"usingComponents":{}}',
        type: 'asset',
      },
    } as any)).toThrow('未在 pages/home/index.json 的 usingComponents 注册：native-card')
  })

  it('rejects native bridges in dynamic render mode', async () => {
    const plugin = createReactPlugin({
      configService: {
        cwd: '/project',
        weappViteConfig: { react: { renderMode: 'dynamic' } },
      },
    } as any)[0]

    await expect(plugin.transform!.call({ warn: vi.fn() } as any, `
      import { createNativeComponent } from '@weapp-vite/react'
      const NativeCard = createNativeComponent('native-card')
      export function View() { return <NativeCard /> }
    `, '/project/src/pages/home/view.tsx')).rejects.toThrow('renderMode: \'dynamic\' 不支持自定义组件')
  })

  it('refreshes an emitted static template when its TSX owner changes', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'weapp-react-watch-'))
    const file = path.join(cwd, 'src/pages/home/view.tsx')
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, 'export function View() { return <view>before</view> }')
    const plugin = createReactPlugin({
      configService: {
        cwd,
        weappViteConfig: { react: true },
      },
    } as any)[0]

    try {
      await plugin.transform!.call({ warn: vi.fn() } as any, await readFile(file, 'utf8'), file)
      await writeFile(file, 'export function View() { return <view>after</view> }')
      await plugin.watchChange!.call({ warn: vi.fn() } as any, file, { event: 'update' })

      const emitted: Array<Record<string, unknown>> = []
      plugin.generateBundle!.call({
        emitFile(asset: Record<string, unknown>) {
          emitted.push(asset)
        },
      } as any, {} as any, {})
      expect(emitted).toContainEqual(expect.objectContaining({
        fileName: 'pages/home/index.wxml',
        source: '<view>after</view>',
      }))
    }
    finally {
      await rm(cwd, { force: true, recursive: true })
    }
  })
})
