import type { CompilerContext } from '../../../context'
import { mkdtemp, realpath, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { createRuntimeState } from '../../../runtime/runtimeState'
import { createReadAndParseSfcOptions, readAndParseSfc } from '../../utils/vueSfc'
import { collectVueStyleScriptChanges } from './vueStyleDependency'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-css-bindings-')))
  roots.push(root)
  const page = path.join(root, 'page.vue')
  const style = path.join(root, 'page.css')
  const alternate = path.join(root, 'alternate.css')
  const source = '<script setup>const themeColor = "red"; const accentColor = "orange"</script><template><view class="page" /></template><style src="./page.css" />'
  await Promise.all([
    writeFile(page, source),
    writeFile(style, '.page { color: v-bind(themeColor) }'),
    writeFile(alternate, '.page { color: v-bind(themeColor); background: pink }'),
  ])
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: { isDev: true },
    moduleGraphService: {},
  } as unknown as CompilerContext
  const publishBindings = async () => {
    const { descriptor } = await readAndParseSfc(page, createReadAndParseSfcOptions(ctx.moduleGraphService, ctx.configService))
    ctx.runtimeState.build.hmr.vueEntryStyleBindings.set(page, {
      sources: descriptor.styles.flatMap(block => block.src ? [path.resolve(root, block.src)] : []),
      expressions: descriptor.cssVars,
    })
  }
  const changed = (file: string) => collectVueStyleScriptChanges(ctx, file, ctx.configService)
  await publishBindings()
  return { page, style, alternate, source, publishBindings, changed }
}

describe('external Vue style binding admission', () => {
  it('detects variable replacement, removal and restoration from actual external CSS', async () => {
    const f = await fixture()
    for (const css of [
      '.page { color: v-bind(accentColor) }',
      '.page { color: black }',
      '.page { color: v-bind(themeColor) }',
    ]) {
      await writeFile(f.style, css)
      expect(await f.changed(f.style)).toEqual(new Set([f.page]))
      await f.publishBindings()
      expect(await f.changed(f.style)).toEqual(new Set())
    }
  })

  it('tracks the active src stylesheet before the next binding-changing save', async () => {
    const f = await fixture()
    await writeFile(f.page, f.source.replace('./page.css', './alternate.css'))
    await f.publishBindings()
    await writeFile(f.style, '.page { color: v-bind(unusedColor) }')
    expect(await f.changed(f.style)).toEqual(new Set())
    expect(await f.changed(f.alternate)).toEqual(new Set())

    await writeFile(f.alternate, '.page { color: v-bind(accentColor) }')

    expect(await f.changed(f.alternate)).toEqual(new Set([f.page]))
  })

  it('keeps ordinary style changes stateful when their variable bindings match', async () => {
    const f = await fixture()
    await writeFile(f.style, '.page { background: yellow; color: v-bind(themeColor) }')
    expect(await f.changed(f.style)).toEqual(new Set())
  })

  it('preserves missing external input errors for the original build diagnosis', async () => {
    const f = await fixture()
    await unlink(f.style)
    await expect(f.changed(f.style)).rejects.toThrow('读取')
  })
})
