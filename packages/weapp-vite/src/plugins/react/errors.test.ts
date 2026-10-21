import type { CompilerContext } from '../../context'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createReactPlugin } from './index'
import * as compiler from './staticTemplate'
import { ReactStaticTemplateUnsupportedError } from './staticTemplate/types'

const baseline = 'export function View() { return <view>baseline</view> }'
const unsupportedSources = [
  ['arrow component', 'export const View = () => <view />'],
  ['member tag', 'export function View() { return <UI.View /> }'],
  ['dynamic component', 'export function View() { return <Custom /> }'],
  ['spread attributes', 'export function View(props) { return <view {...props} /> }'],
  ['unsupported event', 'export function View() { return <view onUnknown={() => {}} /> }'],
  ['dynamic children', 'export function View({ items }) { return <view>{items.map(item => <text>{item}</text>)}</view> }'],
  ['mixed text children', 'export function View({ label }) { return <text>{label}<text>child</text></text> }'],
  ['slot children', 'import { Slot } from "@weapp-vite/react"; export function View() { return <Slot><view /></Slot> }'],
] as const
const directories: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(directories.splice(0).map(directory => rm(directory, { force: true, recursive: true })))
})

async function createFixture(renderMode: 'auto' | 'static' = 'auto') {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'react-template-errors-'))
  directories.push(cwd)
  const file = path.join(cwd, 'src/pages/home/view.tsx')
  await mkdir(path.dirname(file), { recursive: true })
  const plugin = createReactPlugin({
    configService: {
      cwd,
      relativeOutputPath: (file: string) => path.relative(path.join(cwd, 'src'), file).replaceAll('\\', '/'),
      weappViteConfig: { react: { renderMode } },
    },
  } as unknown as CompilerContext)[0]!
  const context = { warn: vi.fn() }
  await plugin.transform!.call(context as never, baseline, file)
  return {
    warn: context.warn,
    async apply(hook: 'transform' | 'watchChange', source: string) {
      if (hook === 'transform') {
        return await plugin.transform!.call(context as never, source, file)
      }
      await writeFile(file, source)
      return await plugin.watchChange!.call(context as never, file, { event: 'update' })
    },
    emitted() {
      const assets = new Map<string, string | Uint8Array>()
      plugin.generateBundle!.call({
        emitFile(asset: { fileName: string, source: string | Uint8Array }) {
          assets.set(asset.fileName, asset.source)
        },
      } as never, {} as never, {})
      return assets
    },
  }
}

describe.each(['transform', 'watchChange'] as const)('React %s error boundaries', (hook) => {
  it('preserves an unexpected compiler error and the last complete template', async () => {
    const fixture = await createFixture()
    const failure = new Error('unexpected static compiler failure')
    vi.spyOn(compiler, 'compileStaticReactPage').mockImplementation(() => {
      throw failure
    })
    await expect(fixture.apply(hook, baseline)).rejects.toBe(failure)
    expect(fixture.warn).not.toHaveBeenCalled()
    expect(fixture.emitted().get('pages/home/index.wxml')).toBe('<view>baseline</view>')
  })

  it('preserves a syntax error without replacing the last complete template', async () => {
    const fixture = await createFixture()
    await expect(fixture.apply(hook, 'export function View() { return <view>')).rejects.toThrow(SyntaxError)
    expect(fixture.warn).not.toHaveBeenCalled()
    expect(fixture.emitted().get('pages/home/index.wxml')).toBe('<view>baseline</view>')
  })

  it.each(unsupportedSources)('retains auto dynamic fallback for valid %s', async (_name, source) => {
    const fixture = await createFixture()
    await fixture.apply(hook, source)
    expect(fixture.warn).toHaveBeenCalledOnce()
    const emitted = fixture.emitted()
    expect(emitted.get('pages/home/index.wxml')).toContain('is="react_root"')
    expect(emitted.has('runtime/base.wxml')).toBe(true)
  })

  it('keeps explicit static mode strict for otherwise valid unsupported JSX', async () => {
    const fixture = await createFixture('static')
    await expect(fixture.apply(hook, unsupportedSources[0][1])).rejects.toThrow(ReactStaticTemplateUnsupportedError)
    expect(fixture.warn).not.toHaveBeenCalled()
    expect(fixture.emitted().get('pages/home/index.wxml')).toBe('<view>baseline</view>')
  })

  it('preserves invalid native bridge declarations', async () => {
    const fixture = await createFixture()
    const source = 'import { createNativeComponent } from "@weapp-vite/react"; const Native = createNativeComponent(tag); export function View() { return <Native /> }'
    await expect(fixture.apply(hook, source)).rejects.toThrow('tagName 必须是非空字符串字面量')
    expect(fixture.warn).not.toHaveBeenCalled()
    expect(fixture.emitted().get('pages/home/index.wxml')).toBe('<view>baseline</view>')
  })

  it('keeps unsupported native bridge structure as a hard compilation error', async () => {
    const fixture = await createFixture()
    const source = 'import { createNativeComponent } from "@weapp-vite/react"; const Native = createNativeComponent("native-card"); export function View({ items }) { return <Native>{items.map(item => <view>{item}</view>)}</Native> }'
    await expect(fixture.apply(hook, source)).rejects.toThrow(compiler.ReactNativeBridgeStaticError)
    expect(fixture.warn).not.toHaveBeenCalled()
    expect(fixture.emitted().get('pages/home/index.wxml')).toBe('<view>baseline</view>')
  })
})
