import { expect, it } from 'vitest'
import { profileTransformScriptPhases } from './ast-migration-profile'

it('profiles module-scoped macros without leaking page metadata into runtime output', () => {
  const result = profileTransformScriptPhases(`
import { defineComponent } from 'vue'
import { definePageMeta as pageMeta, onLoad } from 'wevu'

export default defineComponent({
  setup() {
    pageMeta({ title: 'profile' })
    onLoad(() => {})
    return { count: 1 }
  },
})
`, { isPage: true })

  expect(result.code).not.toContain('definePageMeta')
  expect(result.code).not.toContain('pageMeta')
  expect(result.code).toContain('onLoad')
  expect(result.code).toContain('count: 1')
  expect(Object.values(result.timings).every(value => Number.isFinite(value) && value >= 0)).toBe(true)
})
