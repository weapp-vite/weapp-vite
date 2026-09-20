import type { CompilerContext } from '../../context'
import type { Entry } from '../../types/entry'
import { describe, expect, it, vi } from 'vitest'
import { createReactPlugin } from './index'

const fileName = 'pages/home/index.json'
const registered = { usingComponents: { 'native-card': '/components/native-card/index' } }

async function createFixture(json: object = registered) {
  const entries = new Map<string, Entry>([['pages/home/index', {
    type: 'page',
    path: '/project/src/pages/home/index.tsx',
    templatePath: '/project/src/pages/home/index.wxml',
    json,
  }]])
  const plugin = createReactPlugin({
    configService: { cwd: '/project', weappViteConfig: { react: true } },
    runtimeState: { build: { hmr: { entriesMap: entries } } },
    jsonService: { resolve: (entry: Entry) => JSON.stringify(entry.json) },
  } as unknown as CompilerContext)[0]!
  await plugin.transform!.call({ warn: vi.fn() } as never, `
    import { createNativeComponent } from '@weapp-vite/react'
    const NativeCard = createNativeComponent('native-card')
    export function View() { return <NativeCard label="ready" /> }
  `, '/project/src/pages/home/view.tsx')
  const emitFile = vi.fn()
  const render = (source?: string) => {
    plugin.generateBundle!.call({ emitFile } as never, {} as never, source === undefined
      ? {}
      : { [fileName]: { type: 'asset', fileName, source } } as never)
  }
  return { emitFile, entries, render }
}

describe('React native bridge incremental configuration', () => {
  it('reuses the current entry configuration when an unrelated script patch omits unchanged JSON', async () => {
    const { emitFile, render } = await createFixture()
    render(JSON.stringify(registered))
    emitFile.mockClear()
    render()
    expect(emitFile).toHaveBeenCalledWith(expect.objectContaining({
      fileName: 'pages/home/index.wxml',
      source: '<native-card label="ready" />',
    }))
    expect(emitFile).not.toHaveBeenCalledWith(expect.objectContaining({ fileName }))
  })

  it('validates a current JSON asset ahead of retained entry metadata', async () => {
    const { render } = await createFixture()
    expect(() => render('{"usingComponents":{}}')).toThrow('未在 pages/home/index.json 的 usingComponents 注册：native-card')
    expect(() => render('{')).toThrow('无法解析原生组件配置 pages/home/index.json')
  })

  it('rejects registration removal from current metadata after an earlier successful emit', async () => {
    const { entries, render } = await createFixture()
    render(JSON.stringify(registered))
    entries.get('pages/home/index')!.json = { usingComponents: {} }
    expect(() => render()).toThrow('未在 pages/home/index.json 的 usingComponents 注册：native-card')
  })

  it('rejects a missing entry instead of accepting previously emitted configuration', async () => {
    const { entries, render } = await createFixture()
    render(JSON.stringify(registered))
    entries.clear()
    expect(() => render()).toThrow('缺少对应配置 pages/home/index.json')
  })

  it('rejects an unresolved entry with no configuration', async () => {
    const { entries, render } = await createFixture()
    delete entries.get('pages/home/index')!.json
    expect(() => render()).toThrow('缺少对应配置 pages/home/index.json')
  })
})
