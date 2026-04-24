import { describe, expect, it } from 'vitest'
import { buildWeappVueStyleRequest, buildWeappVueStyleRequests, parseWeappVueStyleRequest } from './styleRequest'

describe('styleRequest', () => {
  it('builds and parses a single vue style request', () => {
    const request = buildWeappVueStyleRequest('/project/src/pages/home/index.vue', {
      lang: 'scss',
      scoped: true,
      module: 'styles',
    } as any, 1)

    expect(request).toContain('weapp-vite-vue&type=style&index=1')
    expect(request).toContain('&scoped=true')
    expect(request).toContain('&module=styles')
    expect(request).toContain('&lang.scss')
    expect(parseWeappVueStyleRequest(request)).toEqual({
      filename: '/project/src/pages/home/index.vue',
      index: 1,
    })
  })

  it('builds multiple vue style requests with one shared filename encoding pass', () => {
    expect(buildWeappVueStyleRequests('/project/src/pages/home/index.vue', [
      { lang: 'css' },
      { lang: 'scss', scoped: true, module: true },
    ] as any)).toEqual([
      '\0weapp-vite:vue-style:%2Fproject%2Fsrc%2Fpages%2Fhome%2Findex.vue?weapp-vite-vue&type=style&index=0&lang.css',
      '\0weapp-vite:vue-style:%2Fproject%2Fsrc%2Fpages%2Fhome%2Findex.vue?weapp-vite-vue&type=style&index=1&scoped=true&module=true&lang.scss',
    ])
  })
})
