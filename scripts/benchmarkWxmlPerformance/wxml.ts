import type { Case } from './measure'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import path from 'node:path'

/** 新 API 仅比较 PR 前后版本；不能把 main 缺失的功能记作零成本。 */
export async function wxmlCases(load: (file: string) => Promise<any>, root: string): Promise<Case[]> {
  const { editWxml } = await load('packages/weapp-vite/src/wxml/transform/editor.ts')
  const { createWxmlRemover } = await load('packages/weapp-vite/src/wxml/remove/index.ts')
  const { resolveWxmlRemoveOptions } = await load('packages/weapp-vite/src/wxml/options.ts')
  const { transformWxml } = await load('packages/weapp-vite/src/wxml/transform/index.ts')
  const { validateWxmlBundle } = await load('packages/weapp-vite/src/wxml/validate/index.ts')
  const { createRuntimeState } = await load('packages/weapp-vite/src/runtime/runtimeState.ts')
  const { beginWxmlDependencies, clearWxmlDependencies, getWxmlWatchFiles } = await load('packages/weapp-vite/src/wxml/processing/dependencies.ts')
  const context = (wxml = {}) => ({
    runtimeState: createRuntimeState(),
    configService: { cwd: root, outDir: path.join(root, 'dist'), platform: 'weapp', mode: 'production', isDev: false, weappViteConfig: { wxml } },
  })
  const cases: Case[] = []
  const file = 'pages/bench.wxml'
  for (const count of [100, 1000, 5000]) {
    const source = `<root>${'<view data-testid="x" a="{{value}}"><text>中文</text></view>'.repeat(count)}</root>`
    const same = (result: string) => assert.equal(result, source)
    const add = (name: string, run: Case['run'], verify: Case['verify'] = same) => cases.push({ name: `wxml/${name}/${count}`, bytes: Buffer.byteLength(source), run, verify })
    const removeConfigs = {
      default: undefined,
      off: { remove: false },
      comments: { remove: { comment: true } },
      precise: { remove: { attr: [{ tag: 'view', name: 'data-testid' }] } },
      wildcard: { remove: { attr: ['data-*'] } },
    }
    for (const [name, config] of Object.entries(removeConfigs)) {
      const remove = createWxmlRemover(resolveWxmlRemoveOptions(config))
      add(`remove-${name}`, () => remove(source, file), result => assert.equal(result, name === 'precise' || name === 'wildcard' ? source.replaceAll('data-testid="x"', '') : source))
    }
    const comments = source.replaceAll('<text>', '<!-- debug --><text>')
    const commentRemover = createWxmlRemover({ comment: true })
    add('remove-comments-present', () => commentRemover(comments, file))
    const debug = `<root>${`<debug-panel>${source}</debug-panel>`}</root>`
    const removeTags = createWxmlRemover({ tag: ['debug-*'] })
    add('remove-subtree', () => removeTags(debug, file), result => assert.equal(result, '<root></root>'))
    add('edit-noop', () => editWxml(source, file, 'legacy', () => {}))
    add('edit-skip', () => editWxml(source, file, 'legacy', (node: any) => node.skipChildren()))
    add('edit-sync', () => editWxml(source, file, 'legacy', (node: any) => {
      if (node.tagName === 'view') {
        node.removeAttribute('data-testid')
      }
    }), result => assert.equal(result, source.replaceAll('data-testid="x"', '')))
    add('edit-async', () => editWxml(source, file, 'legacy', async (node: any) => {
      await Promise.resolve()
      if (node.tagName === 'view') {
        node.removeAttribute('data-testid')
      }
    }), result => assert.equal(result, source.replaceAll('data-testid="x"', '')))
    add('edit-xml', () => editWxml(source, file, 'xml', (node: any) => {
      if (node.tagName === 'view') {
        node.setAttribute('title', 'a&"')
      }
    }), result => assert.equal(result.match(/title="a&amp;&quot;"/g)?.length, count))
    add('edit-manual-walk', () => editWxml(source, file, 'legacy', async (node: any) => {
      await node.walk(() => {})
      node.skipChildren()
    }))
    for (const enabled of [false, true]) {
      const ctx = context(enabled ? { transform: (code: string) => code.replaceAll('data-testid', 'data-track') } : {})
      add(`transform-${enabled ? 'string' : 'off'}`, () => transformWxml(ctx, source, file, 'legacy', () => {}, () => {}), result => assert.equal(result, enabled ? source.replaceAll('data-testid', 'data-track') : source))
    }
    const arrayContext = context({ transform: [
      (code: string) => code.replaceAll('data-testid', 'data-track'),
      async (code: string) => code.replaceAll('data-track', 'data-analytics'),
      (code: string) => code.replaceAll('data-analytics', 'data-testid'),
    ] })
    add('transform-array', () => transformWxml(arrayContext, source, file, 'legacy', () => {}, () => {}))
    for (const hooks of [0, 1, 3]) {
      let visits = 0
      const walk = async (_: string, ctx: any) => ctx.walk(() => {
        visits++
      })
      const ctx = context({ validate: hooks ? Array.from({ length: hooks }).fill(walk) : () => {} })
      add(`validate-${hooks ? `${hooks}-walk` : 'source'}`, async () => {
        visits = 0
        const commit = await validateWxmlBundle(ctx, { [file]: { type: 'asset', fileName: file, source } }, { warn() {}, addWatchFile() {}, partial: false })
        commit?.()
        return visits
      }, result => assert.equal(result, (count * 2 + 1) * hooks))
    }
    let visits = 0
    const ctx = context({
      transform: (code: string, ctx: any) => ctx.edit(code, (node: any) => {
        if (node.tagName === 'view') {
          node.renameAttribute('data-testid', 'data-track')
        }
      }),
      validate: async (_: string, ctx: any) => ctx.walk(() => {
        visits++
      }),
    })
    const remove = createWxmlRemover({ attr: ['data-track'] })
    add('combined', async () => {
      visits = 0
      const transformed = await transformWxml(ctx, source, file, 'legacy', () => {}, () => {})
      const cleaned = remove(transformed, file)
      const commit = await validateWxmlBundle(ctx, { [file]: { type: 'asset', fileName: file, source: cleaned } }, { warn() {}, addWatchFile() {}, partial: false })
      commit?.()
      return { cleaned, visits }
    }, (result) => {
      assert.equal(result.cleaned, source.replaceAll('data-testid="x"', ''))
      assert.equal(result.visits, count * 2 + 1)
    })
    const deep = `${'<view>'.repeat(count)}deep${'</view>'.repeat(count)}`
    cases.push({ name: `wxml/deep-skip/${count}`, bytes: Buffer.byteLength(deep), run: () => editWxml(deep, file, 'legacy', (node: any) => node.skipChildren()), verify: result => assert.equal(result, deep) })
    cases.push({ name: `wxml/deep-noop/${count}`, bytes: Buffer.byteLength(deep), run: () => editWxml(deep, file, 'legacy', () => {}), verify: result => assert.equal(result, deep) })
  }
  for (const count of [1000, 4000, 8000]) {
    for (const shared of [true, false]) {
      cases.push({
        name: `dependencies/${shared ? 'shared' : 'unique'}/${count}`,
        run: () => {
          const ctx = context()
          const build = beginWxmlDependencies(ctx, 'main', false)
          for (let index = 0; index < count; index++) {
            build.template(`${index}.wxml`)(shared ? 'shared.json' : `${index}.json`)
          }
          build.commit()
          const size = getWxmlWatchFiles(ctx).length
          clearWxmlDependencies(ctx)
          return { size, remaining: getWxmlWatchFiles(ctx).length }
        },
        verify: result => assert.deepEqual(result, { size: shared ? 1 : count, remaining: 0 }),
        evidence: result => result,
      })
    }
  }
  cases.push({
    name: 'dependencies/failure-recovery/50',
    run: () => {
      const ctx = context()
      for (let round = 0; round < 50; round++) {
        const failed = beginWxmlDependencies(ctx, 'main', false)
        for (let index = 0; index < 100; index++) {
          failed.template(`${index}.wxml`)('missing.json')
        }
        failed.fail?.()
      }
      const watched = getWxmlWatchFiles(ctx).length
      const pending = ctx.runtimeState.wxmlProcessing.pending.size
      beginWxmlDependencies(ctx, 'main', false).commit()
      const recovered = getWxmlWatchFiles(ctx).length
      clearWxmlDependencies(ctx)
      return { watched, pending, recovered, closed: getWxmlWatchFiles(ctx).length }
    },
    verify: (result) => {
      assert.equal(result.watched, 1)
      assert.equal(result.recovered, 0)
      assert.equal(result.closed, 0)
    },
    evidence: result => result,
  })
  return cases
}
