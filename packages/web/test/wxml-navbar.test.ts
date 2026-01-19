import { describe, expect, it } from 'vitest'
import { compileWxml } from '../src/compiler/wxml'

const baseOptions = {
  id: '/src/pages/home/index.wxml',
  resolveTemplatePath: () => undefined,
  resolveWxsPath: () => undefined,
}

describe('compileWxml navigation bar injection', () => {
  it('injects navbar and applies page-meta overrides', () => {
    const result = compileWxml({
      ...baseOptions,
      source: `
        <page-meta>
          <navigation-bar title="Home" background-color="#ffffff" />
        </page-meta>
        <view>ok</view>
      `,
      navigationBar: {
        config: {
          title: 'App',
          backgroundColor: '#000000',
          textStyle: 'white',
        },
      },
    })

    expect(result.code).toContain('weapp-navigation-bar')
    expect(result.code).toMatch(/title=\$\{"Home"\}/)
    expect(result.code).toMatch(/background-color=\$\{"#ffffff"\}/)
    expect(result.code).not.toContain('page-meta')
  })

  it('skips navbar when navigationStyle is custom', () => {
    const result = compileWxml({
      ...baseOptions,
      source: `<page-meta><navigation-bar title="Home" /></page-meta><view>ok</view>`,
      navigationBar: {
        config: {
          navigationStyle: 'custom',
          title: 'App',
        },
      },
    })

    expect(result.code).not.toContain('weapp-navigation-bar')
    expect(result.code).not.toContain('page-meta')
  })
})
