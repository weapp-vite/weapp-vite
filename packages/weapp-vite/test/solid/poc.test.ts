import { createSignal } from 'solid-js/dist/solid.js'
import { describe, expect, it } from 'vitest'
import { compileSolidTemplate } from '../../../../apps/runtime-bench-solid/solidTemplatePlugin'
import { createSolidMiniProgramRoot } from '../../../../apps/runtime-bench-solid/src/runtime'

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
    const payloads: Record<string, unknown>[] = []
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

    expect(payloads).toEqual([
      { cards: ['one'], summary: 'one' },
      { cards: ['two'], summary: 'two' },
    ])
    root.dispose()
  })
})
