import { describe, expect, it } from 'vitest'
import { analyzeCaseSource } from './inventoryAnalyzer'

const header = `
  import { describe, it, test as scenario } from 'vitest'
  import { resolveRuntimeProviderName as resolveProvider } from '../utils/runtimeProvider'
  const provider = resolveProvider()
`

describe('static provider case applicability', () => {
  it('retains every declaration while proving aliased provider comparisons and inherited suite conditions', () => {
    const cases = analyzeCaseSource(`${header}
      const isHeadless = provider !== 'devtools'
      describe.runIf(isHeadless)('headless suite', () => {
        scenario.skipIf(provider === 'devtools')('background lifecycle', ctx => createDomAcceptance(ctx, 'fixture', []))
      })
      it('ordinary', ctx => createDomAcceptance(ctx, 'fixture', []))
    `, 'e2e/ide/example.test.ts')
    expect(cases.map(item => item.name)).toEqual(['headless suite > background lifecycle', 'ordinary'])
    expect(cases[0]?.providerApplicability).toMatchObject({
      providers: ['headless'],
      conditions: [
        { modifier: 'skipIf', expression: 'provider === \'devtools\'', source: expect.stringMatching(/^e2e\/ide\/example\.test\.ts:\d+$/) },
        { modifier: 'runIf', expression: 'isHeadless' },
      ],
    })
    expect(cases[1]?.providerApplicability).toBeUndefined()
  })

  it('evaluates only proven boolean combinations without treating string truthiness as applicability', () => {
    const cases = analyzeCaseSource(`${header}
      it.runIf(!(provider === 'devtools') && provider === 'headless')('headless', () => {})
      it.runIf(provider === 'headless' || provider === 'devtools')('both', () => {})
      it.runIf(provider)('truthiness', () => {})
    `, 'e2e/ide/example.test.ts')
    expect(cases.map(item => item.providerApplicability?.providers)).toEqual([['headless'], ['devtools', 'headless'], undefined])
  })

  it.each([
    `it.skip.runIf(provider === 'headless')('case', () => {})`,
    `describe.skip('suite', () => { it.runIf(provider === 'headless')('case', () => {}) })`,
    `it.runIf(provider === 'headless' && unknownFlag)('case', () => {})`,
    `it.runIf(provider === 'headless').skipIf(unknownFlag)('case', () => {})`,
    `it.runIf(provider === 'headless' && false)('case', () => {})`,
    `it.skipIf(provider === 'headless' || true)('case', () => {})`,
    `it.runIf(provider === 'unsupported')('case', () => {})`,
    `describe.runIf(provider === 'headless')('suite', () => { it.runIf(provider === 'devtools')('case', () => {}) })`,
    `it.runIf(provider === 'headless')('case', { skip: true }, () => {})`,
    `it.runIf(provider === 'headless')('case', { todo: true }, () => {})`,
    `it.runIf(provider === 'headless')('case', { skip: unknownFlag }, () => {})`,
    `it.runIf(provider === 'headless')('case', { ...options }, () => {})`,
    `it.runIf(provider === 'headless')('case', options, () => {})`,
    `describe('suite', { skip: true }, () => { it.runIf(provider === 'headless')('case', () => {}) })`,
    `describe('suite', { todo: unknownFlag }, () => { it.runIf(provider === 'headless')('case', () => {}) })`,
    `it.runIf(provider === 'headless')('case', { __proto__: { skip: true } }, () => {})`,
    `const describeSkipped = describe.skip\ndescribeSkipped('suite', () => { it.runIf(provider === 'headless')('case', () => {}) })`,
    `it.runIf(resolveProvider() === 'headless')('case', () => {})`,
    `it('case', context => { if (provider === 'devtools') context.skip() })`,
    `function shadow(provider) {}\nit.runIf(provider === 'headless')('case', () => {})`,
    `provider = 'headless'\nit.runIf(provider === 'headless')('case', () => {})`,
  ])('does not exempt ordinary skip, unknown conditions or mutable/shadowed bindings: %s', (declaration) => {
    const cases = analyzeCaseSource(`${header}\n${declaration}`, 'e2e/ide/example.test.ts')
    expect(cases).toHaveLength(1)
    expect(cases[0]?.providerApplicability).toBeUndefined()
  })

  it('allows explicit false skip/todo options and numeric timeouts without weakening provider conditions', () => {
    const [item] = analyzeCaseSource(`${header}
      describe('suite', { skip: false }, () => {
        it.runIf(provider === 'headless')('case', { skip: false, todo: false }, () => {}, 30_000)
      })
    `, 'e2e/ide/example.test.ts')
    expect(item?.providerApplicability?.providers).toEqual(['headless'])
  })

  it.each([
    header.replace('\'../utils/runtimeProvider\'', '\'../utils/untrustedProvider\''),
    header.replace('const provider', 'let provider'),
    header.replace('const provider = resolveProvider()', 'const provider = \'headless\''),
  ])('does not infer provider scope from an untrusted resolver or a similarly named value', (preamble) => {
    const [item] = analyzeCaseSource(`${preamble}\nit.runIf(provider === 'headless')('case', () => {})`, 'e2e/ide/example.test.ts')
    expect(item?.providerApplicability).toBeUndefined()
  })
})
