import { pathToFileURL } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 通过独立 Node 进程选择 Solid 的 browser export。
import { execa } from 'execa'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { compileSolidTemplate } from '../../../../apps/runtime-bench-solid/solidTemplatePlugin'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..')
const RUNTIME_PATH = pathToFileURL(path.join(REPO_ROOT, 'apps/runtime-bench-solid/src/runtime.ts')).href

describe('Solid-style JSX runtime POC', () => {
  it('compiles reactive list bindings to native WXML', async () => {
    const result = await compileSolidTemplate(`
      declare const cards: Array<{ id: string, title: string }>
      export default {
        render() {
          return <view>{cards.map(card => <text key={card.id}>{card.title}</text>)}</view>
        },
      }
    `, '/project/src/pages/update/template.tsx')

    expect(result.warnings).toEqual([])
    expect(result.template).toContain('wx:for="{{cards}}"')
    expect(result.template).toContain('wx:key="card.id"')
    expect(result.template).toContain('{{card.title}}')
  })

  it('coalesces synchronous signal changes into one setData commit', async () => {
    const script = `
      globalThis.queueMicrotask = undefined
      const { createSignal } = await import('solid-js')
      const { createSolidMiniProgramRoot } = await import(${JSON.stringify(RUNTIME_PATH)})

      const payloads = []
      const root = createSolidMiniProgramRoot({
        setData(payload, callback) {
          payloads.push(payload)
          callback?.()
        },
      })
      const [cards, setCards] = createSignal(['one'])
      const [summary, setSummary] = createSignal('one')
      root.mount({ cards, summary })
      setCards(['two'])
      setSummary('two')
      await root.flush()
      root.dispose()
      setCards(['three'])
      await root.flush()
      process.stdout.write(JSON.stringify(payloads))
    `
    const { stdout } = await execa('node', [
      '--conditions=browser',
      '--import',
      'tsx',
      '--input-type=module',
      '--eval',
      script,
    ], { cwd: REPO_ROOT })

    expect(JSON.parse(stdout)).toEqual([
      { cards: ['one'], summary: 'one' },
      { cards: ['two'], summary: 'two' },
    ])
  })
})
