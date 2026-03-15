import { describe, expect, it } from 'vitest'
import { parseJsLikeWithEngine } from '@/ast'

describe('parseJsLikeWithEngine', () => {
  it('uses babel engine by default', () => {
    const ast = parseJsLikeWithEngine('export const value = 1')
    expect(ast).toMatchObject({
      type: 'File',
    })
  })

  it('uses oxc engine when configured', () => {
    const ast = parseJsLikeWithEngine('export const value = 1', {
      engine: 'oxc',
    })
    expect(ast).toMatchObject({
      type: 'Program',
    })
  })
})
