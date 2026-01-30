import { describe, expect, it } from 'vitest'
import { buildWeappVueStyleRequest, parseWeappVueStyleRequest } from '../../src/plugins/vue/transform/styleRequest'

describe('weapp-vite vue style request', () => {
  it('round-trips windows path without query in filename', () => {
    const winPath = 'C:\\Users\\foo\\proj\\src\\pages\\index.vue'
    const id = buildWeappVueStyleRequest(winPath, { lang: 'css' } as any, 0)
    const parsed = parseWeappVueStyleRequest(id)

    expect(parsed).toBeTruthy()
    expect(parsed?.index).toBe(0)
    expect(parsed?.filename.includes('?')).toBe(false)
    expect(parsed?.filename).toBe('C:/Users/foo/proj/src/pages/index.vue')
  })

  it('round-trips posix path without query in filename', () => {
    const posixPath = '/Users/foo/proj/src/pages/index.vue'
    const id = buildWeappVueStyleRequest(posixPath, { lang: 'css' } as any, 1)
    const parsed = parseWeappVueStyleRequest(id)

    expect(parsed).toBeTruthy()
    expect(parsed?.index).toBe(1)
    expect(parsed?.filename.includes('?')).toBe(false)
    expect(parsed?.filename).toBe(posixPath)
  })
})
