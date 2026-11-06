import { describe, expect, it } from 'vitest'
import { parseE2ESuiteArguments } from './arguments'

describe('E2E suite arguments', () => {
  it.each(['equals', 'separate'] as const)('consumes all option values before selecting the suite: %s', (format) => {
    const option = (name: string, value: string) => format === 'equals' ? [`--${name}=${value}`] : [`--${name}`, value]
    expect(parseE2ESuiteArguments([
      ...option('filter', 'native-property-delivery.runtime.test.ts'),
      'ide-full',
      ...option('from', '2'),
      ...option('roll-from', '3'),
      ...option('shard-index', '1'),
      ...option('shard-total', '2'),
      ...option('topology', 'legacy-v1'),
      ...option('plan', 'fixture-plan.json'),
      ...option('expected-plan-hash', 'fixture-hash'),
      ...option('cli-path', 'fixture-cli'),
      ...option('devtools-channel', 'stable'),
      ...option('devtools-version', '2.02.2609240'),
      ...option('require-official-latest', 'false'),
      '--allow-failures',
    ], {})).toEqual({
      mode: 'ide-full',
      filter: 'native-property-delivery.runtime.test.ts',
      from: '2',
      rollFrom: '3',
      shardIndex: '1',
      shardTotal: '2',
      topology: 'legacy-v1',
      planFile: 'fixture-plan.json',
      expectedPlanHash: 'fixture-hash',
      selection: { cliPath: 'fixture-cli', devtoolsChannel: 'stable', devtoolsVersion: '2.02.2609240', requireOfficialLatest: false },
      allowFailures: true,
    })
  })

  it('uses inherited task selectors only when the CLI does not set them', () => {
    const env = {
      WEAPP_VITE_E2E_TASK_FILTER: 'inherited-filter',
      WEAPP_VITE_E2E_TASK_FROM: 'inherited-from',
      WEAPP_VITE_E2E_TASK_ROLL_FROM: 'inherited-roll',
      WEAPP_VITE_E2E_SHARD_INDEX: '2',
      WEAPP_VITE_E2E_SHARD_TOTAL: '4',
    }
    expect(parseE2ESuiteArguments([], env)).toMatchObject({
      mode: 'full',
      filter: 'inherited-filter',
      from: 'inherited-from',
      rollFrom: 'inherited-roll',
      shardIndex: '2',
      shardTotal: '4',
    })
    expect(parseE2ESuiteArguments(['--filter', 'explicit', '--from=1', '--roll-from', '2', '--shard-index=1', '--shard-total', '3'], env))
      .toMatchObject({ filter: 'explicit', from: '1', rollFrom: '2', shardIndex: '1', shardTotal: '3' })
  })

  it.each(['filter', 'from', 'roll-from', 'shard-index', 'shard-total', 'topology', 'plan', 'expected-plan-hash', 'cli-path', 'devtools-channel', 'devtools-version'])(
    'rejects missing and empty --%s instead of inheriting a broader selection',
    (name) => {
      for (const args of [[`--${name}`], [`--${name}=`], [`--${name}= `], [`--${name}`, '--allow-failures']]) {
        expect(() => parseE2ESuiteArguments(['ide-full', ...args], { WEAPP_VITE_E2E_TASK_FILTER: 'inherited' })).toThrow(`--${name} requires a value.`)
      }
    },
  )

  it.each([
    ['--fitler=runtime'],
    ['--filter-name', 'runtime'],
    ['-f', 'runtime'],
    ['ide-full', 'unexpected'],
    [''],
  ])('rejects unknown options and extra positional arguments: %j', (...args) => {
    expect(() => parseE2ESuiteArguments(args, {})).toThrow(/Unknown e2e suite option|Unexpected e2e suite argument/)
  })

  it('accepts a pnpm forwarding separator and does not treat an option value as the suite', () => {
    expect(parseE2ESuiteArguments(['--', '--filter', 'runtime'], {})).toMatchObject({ mode: 'full', filter: 'runtime' })
  })

  it('rejects conflicting duplicate selectors and validates DevTools selection without discovery', () => {
    expect(() => parseE2ESuiteArguments(['--filter=first', '--filter', 'second'], {})).toThrow('Conflicting --filter values')
    expect(parseE2ESuiteArguments(['--filter=first', '--filter', 'first'], {})).toMatchObject({ filter: 'first' })
    expect(() => parseE2ESuiteArguments(['--devtools-channel', 'unknown'], {})).toThrow('devtoolsChannel must be stable, rc or nightly')
    expect(() => parseE2ESuiteArguments(['--devtools-version', '2.02'], {})).toThrow('devtoolsVersion must be a complete')
  })

  it('keeps boolean flags explicit and rejects invalid or conflicting values', () => {
    expect(parseE2ESuiteArguments(['--require-official-latest', '--allow-failures=false'], {})).toMatchObject({
      selection: { requireOfficialLatest: true },
      allowFailures: false,
    })
    expect(() => parseE2ESuiteArguments(['--allow-failures=maybe'], {})).toThrow('requires a boolean')
    expect(() => parseE2ESuiteArguments(['--require-official-latest=true', '--require-official-latest', '0'], {})).toThrow('Conflicting --require-official-latest values')
  })
})
