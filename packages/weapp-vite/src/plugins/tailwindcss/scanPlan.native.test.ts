import type { CompilerGenerateRequest } from 'weapp-tailwindcss/core'
import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { createCompiler } from 'weapp-tailwindcss/core'
import { resolveTailwindV4Source } from 'weapp-tailwindcss/generator'
import { createGenerationFixture, declarations } from './generationLifetime/fixture'
import { TailwindScanPlanSession } from './scanPlan'

const require = createRequire(import.meta.url)
const cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) {
    await close()
  }
})

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-native-scan-plan-')))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'src'))
  await mkdir(path.join(root, 'extra'))
  const key = Symbol.for(`tailwind-scan-config:${randomUUID()}`)
  const globals = globalThis as unknown as Record<symbol, { evaluations: number }>
  const probe = globals[key] = { evaluations: 0 }
  cleanup.push(async () => {
    delete globals[key]
  })
  const entry = path.join(root, 'src/app.css')
  const config = path.join(root, 'tailwind.config.cjs')
  const helper = path.join(root, 'content.cjs')
  const source = path.join(root, 'src/page.ts')
  const vue = path.join(root, 'src/component.vue')
  const configCode = `globalThis[Symbol.for(${JSON.stringify(Symbol.keyFor(key))})].evaluations++;
module.exports = { content: require('./content.cjs').paths };`
  const helperCode = 'module.exports = { paths: ["./src/**/*.{ts,vue}"] };'
  const css = `@import ${JSON.stringify(require.resolve('tailwindcss/utilities.css'))} source(none); @config "../tailwind.config.cjs";`
  await writeFile(entry, css)
  await writeFile(config, configCode)
  await writeFile(helper, helperCode)
  await writeFile(source, 'export const classes = "w-[37px]";')
  await writeFile(vue, '<template><view class="h-[29px]" /></template>')
  await writeFile(path.join(root, 'extra/page.ts'), 'export const classes = "w-[83px]";')

  function owner(dependencies: string[] = []) {
    const compiler = createCompiler({ appType: 'weapp-vite', tailwindcssBasedir: root })
    const session = new TailwindScanPlanSession(path.normalize)
    cleanup.push(async () => {
      session.close()
      await compiler.dispose()
    })
    const modes: CompilerGenerateRequest['scanSources'][] = []
    const generate = async (id = 'root') => session.generate({
      id,
      source: { ...await resolveTailwindV4Source({ projectRoot: root, cssEntries: [entry] }), dependencies: [entry, ...dependencies] },
      scanSources: true,
      incrementalCache: false,
      target: 'weapp',
    }, (request) => {
      modes.push(request.scanSources)
      return compiler.generate(request)
    })
    const change = (file: string) => {
      session.invalidate(file)
      compiler.invalidate([file])
    }
    return { generate, change, modes }
  }
  return { root, owner, probe, entry, config, helper, source, vue, css, configCode, helperCode }
}

it('does not reevaluate a real @config during TS/Vue changes, source creation, deletion and restoration', async () => {
  const app = await fixture()
  const owner = app.owner()
  const initial = await owner.generate()
  expect(initial.classSet.has('w-[37px]')).toBe(true)
  expect(initial.classSet.has('h-[29px]')).toBe(true)
  const evaluations = app.probe.evaluations
  expect(evaluations).toBeGreaterThan(0)
  for (const candidate of ['w-[53px]', '', 'w-[37px]']) {
    await writeFile(app.source, `export const classes = ${JSON.stringify(candidate)};`)
    owner.change(app.source)
    const generated = await owner.generate()
    expect(generated.classSet.has('w-[53px]')).toBe(candidate === 'w-[53px]')
    expect(generated.classSet.has('w-[37px]')).toBe(candidate === 'w-[37px]')
    expect(generated.rawCss.includes('53px')).toBe(candidate === 'w-[53px]')
    expect(app.probe.evaluations).toBe(evaluations)
  }
  await writeFile(app.vue, '<template><view class="h-[41px]" /></template>')
  owner.change(app.vue)
  const vue = await owner.generate()
  expect(vue.classSet.has('h-[41px]')).toBe(true)
  expect(vue.classSet.has('h-[29px]')).toBe(false)
  const added = path.join(app.root, 'src/added.ts')
  await writeFile(added, 'export const classes = "w-[61px]";')
  owner.change(added)
  expect((await owner.generate()).classSet.has('w-[61px]')).toBe(true)
  await rm(added)
  owner.change(added)
  expect((await owner.generate()).classSet.has('w-[61px]')).toBe(false)
  expect(app.probe.evaluations).toBe(evaluations)
  expect(owner.modes[0]).toBe(true)
  expect(owner.modes.slice(1).every(Array.isArray)).toBe(true)
  expect(initial.snapshot.classSet.has('w-[53px]')).toBe(false)
})

it('refreshes the real content scope after config, helper and @source updates and restoration', async () => {
  const app = await fixture()
  const owner = app.owner()
  await owner.generate()
  for (const [file, changed, original] of [
    [app.helper, 'module.exports = { paths: ["./extra/**/*.ts"] };', app.helperCode],
    [app.config, app.configCode.replace('require(\'./content.cjs\').paths', '["./extra/**/*.ts"]'), app.configCode],
    [app.entry, `${app.css}\n@source "../extra/**/*.ts";`, app.css],
  ]) {
    const before = app.probe.evaluations
    await writeFile(file!, changed!)
    owner.change(file!)
    const changedResult = await owner.generate()
    expect(changedResult.classSet.has('w-[83px]')).toBe(true)
    expect(app.probe.evaluations).toBeGreaterThan(before)
    expect(owner.modes.at(-1)).toBe(true)
    await writeFile(file!, original!)
    owner.change(file!)
    const restored = await owner.generate()
    expect(restored.classSet.has('w-[37px]')).toBe(true)
    expect(restored.classSet.has('w-[83px]')).toBe(false)
    expect(owner.modes.at(-1)).toBe(true)
  }
  await rm(app.helper)
  owner.change(app.helper)
  await expect(owner.generate()).rejects.toThrow()
  await writeFile(app.helper, app.helperCode)
  owner.change(app.helper)
  expect((await owner.generate()).classSet.has('w-[37px]')).toBe(true)
  expect(owner.modes.at(-1)).toBe(true)
})

it('invalidates a real config helper after several retained-rule generations', async () => {
  const app = await fixture()
  const owner = app.owner()
  await owner.generate()
  for (const width of [53, 61]) {
    await writeFile(app.source, `export const classes = "w-[${width}px]";`)
    owner.change(app.source)
    expect((await owner.generate()).dependencies).toContain(app.helper)
  }
  const evaluations = app.probe.evaluations
  await writeFile(app.helper, 'module.exports = { paths: ["./extra/**/*.ts"] };')
  owner.change(app.helper)
  const changed = await owner.generate()
  expect(changed.classSet.has('w-[83px]')).toBe(true)
  expect(changed.classSet.has('w-[61px]')).toBe(false)
  expect(app.probe.evaluations).toBeGreaterThan(evaluations)
  expect(owner.modes.at(-1)).toBe(true)
})

it('parses rules independently for each root and a new development session', async () => {
  const app = await fixture()
  const owner = app.owner()
  await owner.generate()
  await owner.generate()
  await owner.generate('other-root')
  expect(owner.modes[0]).toBe(true)
  expect(Array.isArray(owner.modes[1])).toBe(true)
  expect(owner.modes[2]).toBe(true)
  const next = app.owner()
  await next.generate()
  expect(next.modes).toEqual([true])
})

it('does not retain scanner-only config rules missing from the core dependency graph', async () => {
  const app = await fixture()
  const dependency = path.join(app.root, 'src/preprocessed.css')
  await writeFile(dependency, '@config "../tailwind.config.cjs";')
  await writeFile(app.entry, app.css.replace('@config "../tailwind.config.cjs";', ''))
  const owner = app.owner([dependency])
  const initial = await owner.generate()
  expect(initial.classSet.has('w-[37px]')).toBe(true)
  expect(initial.dependencies).not.toContain(app.config)
  await owner.generate()
  await writeFile(app.helper, 'module.exports = { paths: ["./extra/**/*.ts"] };')
  await writeFile(app.source, 'export const classes = "w-[53px]";')
  owner.change(app.helper)
  owner.change(app.source)
  const changed = await owner.generate()
  expect(changed.classSet.has('w-[83px]')).toBe(true)
  expect(changed.classSet.has('w-[53px]')).toBe(false)
  expect(owner.modes).toEqual([true, true, true])
})

it('reparses rules when an explicit source path becomes a directory and is restored', async () => {
  const app = await fixture()
  await writeFile(app.entry, `${app.css}\n@source "../generated";`)
  const owner = app.owner()
  await owner.generate()
  const directory = path.join(app.root, 'generated')
  await mkdir(directory)
  await writeFile(path.join(directory, 'page.ts'), 'export const classes = "w-[83px]";')
  owner.change(app.source)
  const added = await owner.generate()
  expect(added.sources).toContainEqual({ base: directory, pattern: '**/*', negated: false })
  expect(added.classSet.has('w-[83px]')).toBe(true)
  await rm(directory, { recursive: true })
  owner.change(app.source)
  const deleted = await owner.generate()
  expect(deleted.classSet.has('w-[83px]')).toBe(false)
  await mkdir(directory)
  await writeFile(path.join(directory, 'page.ts'), 'export const classes = "w-[61px]";')
  owner.change(app.source)
  const restored = await owner.generate()
  expect(restored.sources).toContainEqual({ base: directory, pattern: '**/*', negated: false })
  expect(restored.classSet.has('w-[61px]')).toBe(true)
  expect(owner.modes).toEqual([true, true, true, true])
})

it('uses the retained rules through the native Vite plugin hooks and watches config helpers', async () => {
  const app = await createGenerationFixture()
  const key = Symbol.for(`tailwind-plugin-scan-config:${randomUUID()}`)
  const globals = globalThis as unknown as Record<symbol, { evaluations: number }>
  const probe = globals[key] = { evaluations: 0 }
  cleanup.push(async () => {
    delete globals[key]
  })
  const config = await app.write('tailwind.config.cjs', `globalThis[Symbol.for(${JSON.stringify(Symbol.keyFor(key))})].evaluations++;
module.exports = { content: require('./content.cjs').paths };`)
  const helper = await app.write('content.cjs', 'module.exports = { paths: ["./src/pages/**/*.wxml"] };')
  const entry = 'src/tailwind.css'
  const css = await readFile(path.join(app.root, entry), 'utf8')
  await app.write(entry, `${css}\n@config "../tailwind.config.cjs";`)
  const owner = app.owner('serve')
  expect(declarations((await owner.render()).css, 'width')).toContain('37px')
  const evaluations = probe.evaluations
  expect(evaluations).toBeGreaterThan(0)
  expect(owner.watched).toContain(config)
  expect(owner.watched).toContain(helper)
  for (const width of [53, 37, 61]) {
    const classes = `w-[${width}px] fixture-plugin fixture-utility`
    await app.write('src/pages/index.wxml', `<view class="${classes}" />`)
    await owner.change('src/pages/index.wxml')
    const output = await owner.render(classes)
    expect(declarations(output.css, 'width')).toContain(`${width}px`)
    expect(declarations(output.css, 'width').includes('37px')).toBe(width === 37)
    expect(probe.evaluations).toBe(evaluations)
  }
  await app.write('content.cjs', 'module.exports = { paths: ["./extra/**/*.wxml"] };')
  await app.write('extra/index.wxml', '<view class="w-[83px]" />')
  // 去掉直接 @source 后由 config content 独立决定新范围。
  await app.write(entry, `${css.replace('@source "./pages/**/*.wxml";', '')}\n@config "../tailwind.config.cjs";`)
  await owner.change('content.cjs')
  await owner.change(entry)
  const changed = await owner.render('w-[83px]')
  expect(declarations(changed.css, 'width')).toContain('83px')
  expect(declarations(changed.css, 'width')).not.toContain('61px')
  expect(probe.evaluations).toBeGreaterThan(evaluations)
})
