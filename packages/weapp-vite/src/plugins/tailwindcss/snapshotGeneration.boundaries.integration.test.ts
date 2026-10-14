import type { InlineConfig } from 'vite'
import { rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, it } from 'vitest'
import { CompilerHmrResyncError } from '../compilerPlugin/hmr'
import { fixture, observations } from './snapshotGeneration/fixture'

const observed = observations()

function finalHook(run: () => Promise<void>): (options: InlineConfig) => InlineConfig {
  return options => ({
    ...options,
    plugins: [...options.plugins ?? [], {
      name: 'tailwind-generation-input-boundary',
      enforce: 'post',
      generateBundle: { order: 'post', handler: run },
    }],
  })
}

it.each(['before', 'after'] as const)('rejects a new matching source discovered %s reuse admission', async (timing) => {
  const app = await fixture()
  const captured = await app.capture('updated')
  const source = path.join(app.root, 'src/pages/index/added.ts')
  const add = () => writeFile(source, 'export const utility = "w-[61px]"')
  if (timing === 'before') {
    await add()
  }
  await expect(app.compile(captured, timing === 'after' ? finalHook(add) : undefined)).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect(observed.instances[1]!.requests).toHaveLength(0)
  expect(observed.instances[1]!.disposed).toBe(true)
  // 前次失败的 ctx/view 已解除，普通编译仍读取新输入并独立生成。
  const current = await app.snapshot()
  const css = current.output.find(output => output.fileName === 'app.wxss')
  expect(css?.type === 'asset' ? String(css.source) : undefined).toContain('61px')
  expect(observed.instances[2]!.requests).toHaveLength(1)
})

it.each(['before', 'after'] as const)('rejects an external CSS dependency changed %s reuse admission', async (timing) => {
  const app = await fixture()
  const captured = await app.capture('updated')
  const dependency = path.join(app.root, 'src/tokens.css')
  const change = () => writeFile(dependency, '.author { color: #654321; }')
  if (timing === 'before') {
    await change()
  }
  await expect(app.compile(captured, timing === 'after' ? finalHook(change) : undefined)).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect(observed.instances[1]!.requests).toHaveLength(0)
  expect(observed.instances[1]!.disposed).toBe(true)
  const current = await app.snapshot()
  const css = current.output.find(output => output.fileName === 'app.wxss')
  expect(css?.type === 'asset' ? String(css.source) : undefined).toContain('#654321')
})

it('keeps a failed build independent from the next generation and the active compiler', async () => {
  const app = await fixture()
  const captured = await app.capture('updated')
  await expect(app.compile(captured, finalHook(async () => {
    throw new Error('snapshot-generation-failure')
  }))).rejects.toThrow('snapshot-generation-failure')
  expect(observed.instances[0]!.disposed).toBe(false)
  expect(observed.instances[1]!.disposed).toBe(true)
  const next = await app.prepare('recovered')
  expect(observed.instances[2]!.requests).toHaveLength(0)
  expect(next.snapshot!.output.some(output => output.fileName === 'app.json' && output.type === 'asset' && String(output.source).includes('recovered'))).toBe(true)
})

it('rejects an unsealed module consumed by the build even when it is removed before reuse admission', async () => {
  const app = await fixture()
  const source = path.join(app.root, 'src/pages/index/added.ts')
  const page = path.join(app.root, 'src/pages/index/index.ts')
  const code = 'import { utility } from "./added"; Page({ data: { utility } })'
  await writeFile(page, code)
  app.host.capture(page, code)
  const captured = await app.capture('updated')
  await writeFile(source, 'export const utility = "w-[61px]"')
  let consumed = false
  const result = await app.compile(captured, options => ({
    ...options,
    plugins: [...options.plugins ?? [], {
      name: 'tailwind-generation-consumed-source-removal',
      enforce: 'pre',
      generateBundle: {
        order: 'pre',
        async handler() {
          consumed = [...this.getModuleIds()].includes(source)
          await rm(source)
        },
      },
    }],
  })).then(() => undefined, error => error)
  expect(consumed).toBe(true)
  expect(result).toBeInstanceOf(CompilerHmrResyncError)
  expect(observed.instances[1]!.requests).toHaveLength(0)
  expect(observed.instances[1]!.disposed).toBe(true)
  await writeFile(source, 'export const utility = "w-[61px]"')
  const restored = await app.snapshot()
  const css = restored.output.find(output => output.fileName === 'app.wxss')
  expect(css?.type === 'asset' ? String(css.source) : undefined).toContain('61px')
  expect(observed.instances[2]!.requests).toHaveLength(1)
})

it('rejects an unsealed native WXML asset consumed by the build even when it is removed before reuse admission', async () => {
  const app = await fixture()
  const source = path.join(app.root, 'src/pages/index/added.wxml')
  const page = '<view class="w-[37px]">initial</view><include src="./added.wxml" />'
  await writeFile(app.page, page)
  app.host.capture(app.page, page)
  const captured = await app.capture('updated')
  expect(captured.input.sources.has(source)).toBe(false)
  await writeFile(source, '<view class="w-[61px]">unsealed-native-asset</view>')
  let consumedAsset: string | undefined
  let consumedAsModule = false
  const result = await app.compile(captured, options => ({
    ...options,
    plugins: [...options.plugins ?? [], {
      name: 'tailwind-generation-consumed-native-asset-removal',
      enforce: 'pre',
      generateBundle: {
        order: 'pre',
        async handler(_options, bundle) {
          const asset = bundle['pages/index/added.wxml']
          consumedAsset = asset?.type === 'asset' ? String(asset.source) : undefined
          consumedAsModule = [...this.getModuleIds()].some(file => file.replace(/\?.*$/, '') === source)
          await rm(source)
        },
      },
    }],
  })).then(() => undefined, error => error)
  expect(consumedAsset).toContain('unsealed-native-asset')
  expect(consumedAsset).toContain('61px')
  expect(consumedAsModule).toBe(true)
  expect(result).toBeInstanceOf(CompilerHmrResyncError)
  expect(String(result)).toContain('added.wxml')
  expect(observed.instances[1]!.requests).toHaveLength(0)
  expect(observed.instances[1]!.disposed).toBe(true)
  await writeFile(source, '<view class="w-[61px]">unsealed-native-asset</view>')
  const restored = await app.snapshot()
  const css = restored.output.find(output => output.fileName === 'app.wxss')
  expect(css?.type === 'asset' ? String(css.source) : undefined).toContain('61px')
  expect(observed.instances[2]!.requests).toHaveLength(1)
})
