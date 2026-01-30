import { describe, expect, it } from 'vitest'
import {
  buildWeappVueStyleRequest,
  parseWeappVueStyleRequest,
  WEAPP_VUE_STYLE_VIRTUAL_PREFIX,
} from '../../src/plugins/vue/transform/styleRequest'

describe('weapp-vite vue style request', () => {
  it('round-trips windows path without query in filename', () => {
    const winPath = 'C:\\Users\\foo\\proj\\src\\pages\\index.vue'
    const id = buildWeappVueStyleRequest(winPath, { lang: 'css' } as any, 0)
    const parsed = parseWeappVueStyleRequest(id)

    expect(id.startsWith(WEAPP_VUE_STYLE_VIRTUAL_PREFIX)).toBe(true)
    expect(parsed).toBeTruthy()
    expect(parsed?.index).toBe(0)
    expect(parsed?.filename.includes('?')).toBe(false)
    expect(parsed?.filename).toBe('C:/Users/foo/proj/src/pages/index.vue')
  })

  it('round-trips posix path without query in filename', () => {
    const posixPath = '/Users/foo/proj/src/pages/index.vue'
    const id = buildWeappVueStyleRequest(posixPath, { lang: 'css' } as any, 1)
    const parsed = parseWeappVueStyleRequest(id)

    expect(id.startsWith(WEAPP_VUE_STYLE_VIRTUAL_PREFIX)).toBe(true)
    expect(parsed).toBeTruthy()
    expect(parsed?.index).toBe(1)
    expect(parsed?.filename.includes('?')).toBe(false)
    expect(parsed?.filename).toBe(posixPath)
  })

  it('parses legacy non-virtual style request', () => {
    const winPath = 'C:\\Users\\foo\\proj\\src\\pages\\index.vue'
    const legacyId = `${winPath}?weapp-vite-vue&type=style&index=2&lang.css`
    const parsed = parseWeappVueStyleRequest(legacyId)

    expect(parsed).toBeTruthy()
    expect(parsed?.index).toBe(2)
    expect(parsed?.filename).toBe('C:/Users/foo/proj/src/pages/index.vue')
  })
})
