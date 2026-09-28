import type { CatalogSpec } from '../types'
import { z } from 'zod'
import { defineRendererCatalog, standardComponents } from '../catalog'

export const catalog = defineRendererCatalog({
  components: {
    ...standardComponents,
    Gauge: { props: z.object({ value: z.number() }).strict(), events: ['change'] },
  },
  actions: { increment: z.object({ delta: z.number() }).strict() },
})

export const initial = { filters: { query: '' }, count: 1, enabled: true }
export function fixture(): CatalogSpec<typeof catalog> {
  return {
    root: 'root',
    elements: {
      root: { type: 'Stack', props: {}, children: ['search', 'gauge', 'button'] },
      search: { type: 'Input', props: { label: '搜索', placeholder: '输入关键字', value: { $bindState: '/filters/query' } } },
      gauge: { type: 'Gauge', props: { value: { $state: '/count' } }, visible: { $state: '/enabled' } },
      button: { type: 'Button', props: { label: '增加' }, on: { press: { action: 'increment', params: { delta: 2 } } } },
    },
  }
}
