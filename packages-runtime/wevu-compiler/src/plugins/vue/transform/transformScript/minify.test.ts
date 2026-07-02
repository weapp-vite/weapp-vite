import { describe, expect, it } from 'vitest'
import { transformScript } from './index'

describe('transformScript minify option', () => {
  const source = `
export default {
  data() {
    return {
      count: 1,
    }
  },
}
  `.trim()

  it('keeps readable output by default', () => {
    const result = transformScript(source)
    expect(result.code).toContain('data()')
    expect(result.code).toContain('count: 1')
    expect(result.code).toContain('\n')
  })

  it('emits compact output when minify is enabled', () => {
    const result = transformScript(source, { minify: true })
    expect(result.code).toContain('count:1')
    expect(result.code).not.toContain('count: 1')
  })

  it('can skip sourcemap generation', () => {
    const result = transformScript(source, { sourceMap: false })
    expect(result.transformed).toBe(true)
    expect(result.code).toContain('createWevuComponent')
    expect(result.map).toBeNull()
  })
})
