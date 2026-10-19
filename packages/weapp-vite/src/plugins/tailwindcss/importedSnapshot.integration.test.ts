import type { OutputAsset } from 'rolldown'
import type { InlineConfig } from 'vite'
import { rm, writeFile } from 'node:fs/promises'
import path from 'pathe'
import { expect, it } from 'vitest'
import { parseSidecarSourceMetadata } from '../../moduleGraph/protocol'
import { CompilerHmrResyncError } from '../compilerPlugin/hmr'
import { fixture, observations } from './snapshotGeneration/fixture'

const observed = observations()

it('delivers imported CSS through the real snapshot pipeline while retaining the active compiler', async () => {
  const app = await fixture(false, true)
  const dependency = path.join(app.root, 'src/tokens.css')
  const code = '.author { color: #654321; }'
  await writeFile(dependency, code)
  await app.change(dependency)
  const compiled = await app.compile(await app.capture('imported-css'))
  const css = compiled.snapshot!.output.filter(output => output.type === 'asset' && output.fileName.endsWith('.wxss')).map(output => String(output.source)).join('\n')
  expect(css).toContain('#654321')
  expect(css).not.toContain('#123456')
  expect(css).toContain('.imported-author')
  expect(observed.instances[0]!.disposed).toBe(false)
  expect(observed.instances[1]!.disposed).toBe(true)
  await compiled.dispose()
})

it('matches the effective prepared owner CSS after a normal file change', async () => {
  const app = await fixture(false, true)
  const owner = path.join(app.root, 'src/owner.css')
  await writeFile(owner, '@import "./app.css"; .imported-author { height: 29px; }')
  await app.change(owner)
  const compiled = await app.compile(await app.capture('imported-owner-css'))
  const css = compiled.snapshot!.output.filter(output => output.type === 'asset' && output.fileName.endsWith('.wxss')).map(output => String(output.source)).join('\n')
  expect(css).toContain('29px')
  expect(css).not.toContain('19px')
})

it('delivers frozen scoped SFC CSS through native URL emission and user PostCSS', async () => {
  const app = await fixture(false, true, true)
  const captured = await app.capture('frozen-scoped-css')
  const configure = (options: InlineConfig): InlineConfig => ({
    ...options,
    css: { ...options.css, postcss: { plugins: [{ postcssPlugin: 'frozen-scoped-author', Declaration(declaration) {
      if (declaration.prop === 'color' && declaration.value === 'red') {
        declaration.value = 'blue'
      }
    } }] } },
    build: { ...options.build, assetsInlineLimit: 0, cssMinify: false },
  })
  const compiled = await app.compile(captured, configure)
  const output = compiled.snapshot!.output
  const css = output.filter(item => item.type === 'asset' && item.fileName.endsWith('.wxss')).map(item => String(item.source)).join('\n')
  const template = output.find(item => item.type === 'asset' && item.fileName === 'pages/index/index.wxml') as OutputAsset
  const scope = /data-v-[a-z\d]+/.exec(String(template.source))?.[0]
  const image = output.find(item => item.type === 'asset' && item.fileName.endsWith('.png'))
  expect(scope).toBeDefined()
  expect(css).toContain(scope)
  expect(css).toMatch(/color:\s*blue/)
  expect(css).not.toMatch(/color:\s*red/)
  expect(image).toBeDefined()
  expect(css).toContain(image!.fileName)
  expect(css).not.toContain('../../icon.png')
  expect(observed.instances[1]!.requests.filter(request => request.scanSources)).toEqual([])
})

it('rejects a candidate consumed by the native snapshot and removed before the final input scan', async () => {
  const app = await fixture(false, true)
  const source = path.join(app.root, 'src/pages/index/added.ts')
  const page = path.join(app.root, 'src/pages/index/index.ts')
  const code = 'import { utility } from "./added"; Page({ data: { utility } })'
  await writeFile(page, code)
  app.host.capture(page, code)
  const captured = await app.capture('imported-transient-source')
  expect(captured.input.sources.has(source)).toBe(false)
  let consumed = false
  const ownerReady = Promise.withResolvers<void>()
  // 在 owner 完成扫描后才引入模块，消费后立即删除，专门锁定收尾消费记录。
  const configure = (options: InlineConfig): InlineConfig => ({
    ...options,
    plugins: [...options.plugins ?? [], {
      name: 'imported-snapshot-add-transient-source',
      enforce: 'post',
      async resolveId(id, importer) {
        if (id === './added' && importer?.split('?')[0] === page) {
          await ownerReady.promise
          await writeFile(source, 'export const utility = "w-[61px]"')
          return source
        }
      },
      transform: { order: 'post', async handler(_code, id) {
        const file = parseSidecarSourceMetadata(id)?.sourceId ?? id.split('?')[0]
        if (file === path.join(app.root, 'src/owner.css')) {
          ownerReady.resolve()
        }
        if (file === source) {
          consumed = true
          await rm(source)
        }
      } },
    }],
  })
  const failure = await app.compile(captured, configure).catch(error => error)
  expect(consumed).toBe(true)
  expect(failure).toBeInstanceOf(CompilerHmrResyncError)
  expect(String(failure)).toContain('unfrozen source')
  await writeFile(source, 'export const utility = "w-[61px]"')
  const restored = await app.snapshot()
  const css = restored.output.find(output => output.type === 'asset' && output.fileName === 'app.wxss') as OutputAsset
  expect(String(css.source)).toContain('61px')
})

it('rejects a scanner-only candidate created during the snapshot and removed before final validation', async () => {
  const app = await fixture(false, true)
  const source = path.join(app.root, 'src/pages/index/unused.ts')
  const captured = await app.capture('imported-transient-scanner')
  let consumedAsModule = false
  const configure = (options: InlineConfig): InlineConfig => ({ ...options, plugins: [...options.plugins ?? [], {
    name: 'imported-snapshot-transient-scanner-source',
    enforce: 'pre',
    async buildStart() {
      await writeFile(source, 'export const utility = "w-[61px]"')
    },
    generateBundle: { order: 'post', async handler() {
      consumedAsModule = [...this.getModuleIds()].includes(source)
      await rm(source)
    } },
  }] })
  await expect(app.compile(captured, configure)).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect(consumedAsModule).toBe(false)
})

it('delivers frozen CSS without rescanning transient candidates inside core generation', async () => {
  const app = await fixture(false, true)
  const source = path.join(app.root, 'src/pages/index/unused.ts')
  const captured = await app.capture('imported-transient-core-scanner')
  let diskScans = 0
  observed.duringGenerate = async (request, generate) => {
    if (!request.scanSources) {
      return generate()
    }
    diskScans++
    await writeFile(source, 'export const utility = "w-[61px]"')
    try {
      return await generate()
    }
    finally {
      await rm(source)
    }
  }
  const compiled = await app.compile(captured)
  const css = compiled.snapshot!.output.filter(output => output.type === 'asset' && output.fileName.endsWith('.wxss')).map(output => String(output.source)).join('\n')
  expect(css).toContain('37px')
  expect(css).not.toContain('61px')
  expect(diskScans).toBe(0)
})
