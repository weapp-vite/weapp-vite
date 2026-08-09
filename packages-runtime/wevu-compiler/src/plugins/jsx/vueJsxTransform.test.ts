import { describe, expect, it } from 'vitest'
import { transformVueJsxScript } from './vueJsxTransform'

describe('transformVueJsxScript', () => {
  it('transforms JSX through @vue/babel-plugin-jsx', () => {
    const result = transformVueJsxScript(
      'export const fragment = <view class="card">hello</view>',
      '/project/src/shared.tsx',
      false,
    )

    expect(result.code).not.toContain('<view')
    expect(result.code).toContain('createVNode')
    expect(result.code).toContain('createTextVNode')
  })
})
