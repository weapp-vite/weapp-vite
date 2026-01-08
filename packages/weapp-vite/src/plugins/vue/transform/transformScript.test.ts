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
})
