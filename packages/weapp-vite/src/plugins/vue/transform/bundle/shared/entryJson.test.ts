import type { CompilerContext } from '../../../../../context'
import type { Entry } from '../../../../../types'
import { describe, expect, it } from 'vitest'
import { composeVueEntryJsonConfig } from './entryJson'

function setup() {
  const entry = {
    path: 'pages/index.vue',
    type: 'page',
    declaredJson: { component: false, usingComponents: { manual: '/manual' } },
    json: { component: false, usingComponents: { manual: '/manual', auto: '/auto' } },
  }
  const entriesMap = new Map<string, Entry>([['pages/index', entry as Entry]])
  const ctx = {
    configService: { weappViteConfig: {}, relativeAbsoluteSrcRoot: (id: string) => id },
    runtimeState: { build: { hmr: { entriesMap } } },
  } as unknown as CompilerContext
  return { ctx, entry, entriesMap }
}

describe('current Vue entry JSON composition', () => {
  it('preserves declared and compiler fields while adding only current loader bindings', () => {
    const { ctx, entry } = setup()
    const before = structuredClone(entry)
    const compilerConfig = { component: false, usingComponents: { manual: '/manual', layout: '/layout' }, componentGenerics: { slot: true } }
    expect(JSON.parse(composeVueEntryJsonConfig(ctx, entry.path, JSON.stringify(compilerConfig))!)).toEqual({
      ...compilerConfig,
      usingComponents: { auto: '/auto', manual: '/manual', layout: '/layout' },
    })
    expect(entry).toEqual(before)
  })

  it('removes and restores auto-import and layout bindings using fresh inputs', () => {
    const { ctx, entry } = setup()
    const compiled = (layout: boolean) => JSON.stringify({ component: false, usingComponents: { manual: '/manual', ...(layout ? { layout: '/layout' } : {}) } })
    const read = (layout: boolean) => JSON.parse(composeVueEntryJsonConfig(ctx, entry.path, compiled(layout))!)
    expect(read(true).usingComponents).toEqual({ auto: '/auto', manual: '/manual', layout: '/layout' })
    entry.json = { component: false, usingComponents: { manual: '/manual' } } as typeof entry.json
    expect(read(false).usingComponents).toEqual({ manual: '/manual' })
    entry.json = { component: false, usingComponents: { manual: '/manual', auto: '/auto' } }
    expect(read(true).usingComponents).toEqual({ auto: '/auto', manual: '/manual', layout: '/layout' })
  })

  it('keeps compiler merge-strategy deletions authoritative instead of reviving declarations', () => {
    const { ctx, entry } = setup()
    // replace 或自定义策略已从编译结果移除原始声明；这里只补模板派生的 auto。
    expect(JSON.parse(composeVueEntryJsonConfig(ctx, entry.path, '{"navigationBarTitleText":"selected"}')!)).toEqual({
      navigationBarTitleText: 'selected',
      usingComponents: { auto: '/auto' },
    })
  })

  it('uses the current source configuration when the compiler has no JSON fragment', () => {
    const { ctx, entry } = setup()
    expect(JSON.parse(composeVueEntryJsonConfig(ctx, entry.path, undefined)!)).toEqual(entry.json)
  })

  it('leaves native paired-SFC fallback and unregistered compiler entries to their existing publisher', () => {
    const { ctx, entry, entriesMap } = setup()
    entry.path = 'pages/index.ts'
    expect(composeVueEntryJsonConfig(ctx, 'pages/index.vue', '{}')).toBeUndefined()
    entriesMap.clear()
    expect(composeVueEntryJsonConfig(ctx, 'pages/index.vue', '{}')).toBeUndefined()
  })
})
