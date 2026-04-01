import { describe, expect, it } from 'vitest'
import { transformScript } from 'wevu/compiler'

describe('transformScript', () => {
  it('strips optional markers from runtime output', () => {
    const result = transformScript(`
function resolveTone(delta?: number, options?: { tone?: string }) {
  return { delta, options }
}

class Dashboard {
  status?: string
  refresh?(): void {}
}
`)

    expect(result.code).not.toContain('resolveTone(delta?')
    expect(result.code).not.toContain('options?')
    expect(result.code).not.toContain('status?')
    expect(result.code).not.toContain('refresh?')
  })

  it('strips satisfies expressions from runtime output', () => {
    const result = transformScript(`
const config = { foo: 1 } satisfies Record<string, number>
`)

    expect(result.code).not.toContain('satisfies')
  })

  it('strips type assertions from runtime output', () => {
    const result = transformScript(`
const foo = { a: 1 } as const
const bar = foo as { a: number }
const qux = foo!.a
`)

    expect(result.code).not.toContain('as const')
    expect(result.code).not.toContain('as {')
    expect(result.code).not.toContain('!.')
  })

  it('strips definePageMeta macro calls from runtime output', () => {
    const result = transformScript(`
definePageMeta({
  layout: 'default',
})

export default {}
`)

    expect(result.code).not.toContain('definePageMeta')
  })

  it('strips definePageMeta when it is compiled inside setup body', () => {
    const result = transformScript(`
export default {
  setup() {
    definePageMeta({
      layout: {
        name: 'panel',
        props: {
          title: titleRef.value,
        },
      },
    })
    return {
      titleRef,
    }
  },
}
`)

    expect(result.code).not.toContain('definePageMeta')
  })

  it('keeps stripping type parameters when definePageMeta is present', () => {
    const result = transformScript(`
definePageMeta({
  layout: 'admin',
})

const count = ref<number>(0)

export default {}
`)

    expect(result.code).not.toContain('definePageMeta')
    expect(result.code).not.toContain('ref<number>')
  })

  it('injects defineAppSetup runtime import for bare macro usage', () => {
    const result = transformScript(`
const install = () => {}

defineAppSetup((app) => {
  app.use(install)
})

export default {}
`)

    expect(result.code).toContain('defineAppSetup')
    expect(result.code).toContain('from "wevu";')
    expect(result.code).toContain('defineAppSetup((app) => {')
  })
})
