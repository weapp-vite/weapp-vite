import type { BindingAnalysis, BindingInput, BindingSyntaxSummary } from './source'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 使用独立进程验证生产模块 loader，避免污染 Vitest 模块缓存。
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'

const sourceUrl = new URL('./source.ts', import.meta.url).href
const replayUrl = new URL('./replay.ts', import.meta.url).href
const cwd = fileURLToPath(new URL('../../', import.meta.url))

function runDiagnostic(source: string) {
  return execa(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', source], {
    cwd,
    env: { WEAPP_VITE_NATIVE: '0' },
    timeout: 15_000,
  })
}

function input(expression: string, locals: string[] = [], safeCallNames: string[] = []): BindingInput {
  return { expression, locals, safeCallNames }
}

describe('binding syntax summary from the production analyzer', () => {
  it('matches production types, lexical scope, dependency order and fallback before manifest projection', async () => {
    const requests = [
      input('format(value)'),
      input('format(value)', [], ['format']),
      input('format(value)', ['format', 'value']),
      input('format(value)', ['format', 'value'], ['format']),
      input('format(other(value))', [], ['format']),
      input('format(other(value))', [], ['format', 'other']),
      input('format?.(value)', [], ['format']),
      input('service.format(value)', [], ['format']),
      input('(0, format)(value)', [], ['format']),
      input('new Format(value)', [], ['Format']),
      input('[...items]'),
      input('(format as Handler)(value)', [], ['format']),
      input('(format satisfies Handler)(value)', [], ['format']),
      input('handler<Input>(value)', [], ['handler']),
      input('(profile as Profile).name + profile!.age + (<Profile>profile).id'),
      input('table[key].value + profile.name + table[key].value + profile.age'),
      input('table[key].value + profile.name + table[key].value + profile.age', ['key', 'profile']),
      input('items.map((item, index) => item.name + suffix + index)'),
      input('items.map((item, index) => item.name + suffix + index)', ['suffix']),
      input('({ value: local = initial, ...rest }: Input) => local + rest.name + external'),
      input('(() => { before; var before; return outside })'),
      input('(() => { try { throw source } catch (error) { return error.message + fallback } })'),
      input('(() => { label: for (const item of items) { if (item) break label } return total })'),
      input('value satisfies { method(parameter: Input): Output }'),
      input('value satisfies [label: Item, ...rest: More[]]'),
      input('undefined + Math + toString + constructor + state'),
      input('this.profile.name'),
      input('value +'),
      input('42'),
      input('() => 1'),
      input('Math.random()'),
    ]
    const { stdout } = await runDiagnostic(`
      const { loadProductionBindingAnalysis } = await import(${JSON.stringify(sourceUrl)})
      const { replayWithJsSummary } = await import(${JSON.stringify(replayUrl)})
      const source = await loadProductionBindingAnalysis()
      try {
        const requests = ${JSON.stringify(requests)}
        const expected = requests.map(input => source.analyze(input))
        const actual = replayWithJsSummary(requests, source.summarize)
        const summary = source.summarize('format(other(value))')
        const frozen = Object.isFrozen(summary)
          && Object.isFrozen(summary.dependencies)
          && summary.dependencies.every(Object.isFrozen)
          && Object.isFrozen(summary.directCallNames)
        console.log(JSON.stringify({ expected, actual, summary, frozen }))
      }
      finally {
        source.dispose()
      }
    `)
    const result = JSON.parse(stdout) as {
      expected: Array<BindingAnalysis | null>
      actual: Array<BindingAnalysis | null>
      summary: BindingSyntaxSummary
      frozen: boolean
    }
    expect(result.actual).toHaveLength(requests.length)
    for (const [index, request] of requests.entries()) {
      expect(result.actual[index], JSON.stringify(request)).toEqual(result.expected[index])
    }
    expect(result.actual[2]).toEqual({ dependencies: [], snapshotFallback: true })
    expect(result.actual[3]).toEqual({ dependencies: [], snapshotFallback: false })
    expect(result.summary.directCallNames).toEqual(['format', 'other'])
    expect(result.summary.unconditionalSnapshotFallback).toBe(false)
    expect(result.frozen).toBe(true)
  }, 20_000)

  it('rejects summary collection when the loader preserves contextual normalization for capture', async () => {
    const { stdout } = await runDiagnostic(`
      import assert from 'node:assert/strict'
      const { loadProductionBindingAnalysis } = await import(${JSON.stringify(sourceUrl)})
      const source = await loadProductionBindingAnalysis({ capture: true })
      try {
        assert.throws(() => source.summarize('value'), /require replay mode/)
        console.log('capture mode rejected')
      }
      finally {
        source.dispose()
      }
    `)
    expect(stdout).toBe('capture mode rejected')
  }, 20_000)
})
