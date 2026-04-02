import { describe, expect, it } from 'vitest'
import { compileWxml } from '../src/compiler/wxml'

describe('compileWxml button mapping', () => {
  it('replaces button with weapp-button', () => {
    const result = compileWxml({
      id: '/src/pages/index/index.wxml',
      source: '<button type="primary">OK</button>',
      resolveTemplatePath: () => undefined,
      resolveWxsPath: () => undefined,
    })
    expect(result.code).toContain('weapp-button')
  })
})
