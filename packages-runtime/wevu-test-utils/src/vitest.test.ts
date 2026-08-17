import {
  WEAPP_VITE_RUNTIME_REACTIVITY_VIRTUAL_ID,
  WEAPP_VITE_RUNTIME_TEMPLATE_VIRTUAL_ID,
  WEAPP_VITE_RUNTIME_VIRTUAL_ID,
} from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { wevuSfc } from './vitest'

describe('wevuSfc()', () => {
  it('compiles only SFC script and preserves source maps', async () => {
    const plugin = wevuSfc()
    const transform = plugin.transform as any
    const result = await transform.call({}, '<script setup>import { ref } from \'wevu\'; const count = ref(1)</script>', '/virtual/Counter.vue')

    expect(result.code).toContain('export default')
    expect(result.code).toContain('virtual:weapp-vite/runtime')
    expect(result.map).toBeTruthy()
  })

  it('maps all Wevu virtual runtime entrypoints', async () => {
    const plugin = wevuSfc()
    const resolveId = plugin.resolveId as any
    const resolve = async (source: string) => ({ id: `/resolved/${source}` })
    expect(await resolveId.call({ resolve }, WEAPP_VITE_RUNTIME_VIRTUAL_ID)).toEqual('/resolved/wevu/internal-runtime')
    expect(await resolveId.call({ resolve }, WEAPP_VITE_RUNTIME_REACTIVITY_VIRTUAL_ID)).toEqual('/resolved/wevu/internal-reactivity')
    expect(await resolveId.call({ resolve }, WEAPP_VITE_RUNTIME_TEMPLATE_VIRTUAL_ID)).toEqual('/resolved/wevu/internal-template')
  })

  it('rejects app and page files with the mpcore boundary', async () => {
    const plugin = wevuSfc()
    const transform = plugin.transform as any
    await expect(transform.call({}, '', '/virtual/app.vue')).rejects.toThrow('@mpcore/test')
    await expect(transform.call({}, '', '/virtual/pages/index.vue')).rejects.toThrow('@mpcore/test')
  })
})
