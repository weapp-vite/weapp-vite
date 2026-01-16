import { describe, expect, it } from 'vitest'
import { transformScript } from './transformScript'

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
})
