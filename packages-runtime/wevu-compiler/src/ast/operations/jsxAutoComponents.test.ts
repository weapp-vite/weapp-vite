import { describe, expect, it } from 'vitest'
import { collectJsxAutoComponentsFromCode } from './jsxAutoComponents'

describe('collectJsxAutoComponentsFromCode', () => {
  it('keeps babel and oxc results aligned for common jsx auto-component analysis', () => {
    const source = `
import { defineComponent as defineWevuComponent } from 'wevu'
import TButton from '@/components/TButton'
import { CardItem as TCard } from '@/components/TCard'

const page = defineWevuComponent({
  render() {
    return <view>
      <TButton />
      {ok ? <TCard /> : <text />}
    </view>
  },
})

export default page
    `

    const babelResult = collectJsxAutoComponentsFromCode(source, { astEngine: 'babel' })
    const oxcResult = collectJsxAutoComponentsFromCode(source, { astEngine: 'oxc' })

    expect(babelResult).toEqual(oxcResult)
    expect([...oxcResult.templateTags]).toEqual(['TButton', 'TCard'])
    expect(oxcResult.importedComponents).toEqual([
      {
        localName: 'defineWevuComponent',
        importSource: 'wevu',
        importedName: 'defineComponent',
        kind: 'named',
      },
      {
        localName: 'TButton',
        importSource: '@/components/TButton',
        importedName: 'default',
        kind: 'default',
      },
      {
        localName: 'TCard',
        importSource: '@/components/TCard',
        importedName: 'CardItem',
        kind: 'named',
      },
    ])
  })
})
