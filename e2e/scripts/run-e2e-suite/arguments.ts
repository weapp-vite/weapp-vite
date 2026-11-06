import process from 'node:process'
import { splitWechatDevtoolsSelectionArgs } from 'weapp-ide-cli'

const valueOptions = new Set([
  'filter',
  'from',
  'roll-from',
  'shard-index',
  'shard-total',
  'topology',
  'plan',
  'expected-plan-hash',
  'cli-path',
  'devtools-channel',
  'devtools-version',
])
const selectionOptions = new Set(['cli-path', 'devtools-channel', 'devtools-version', 'require-official-latest'])
const booleanOptions = new Set(['allow-failures', 'require-official-latest'])

/** 先完整验证参数再读取任务；显式空值或拼错的筛选不能回退成完整套件。 */
export function parseE2ESuiteArguments(args: readonly string[], env: NodeJS.ProcessEnv = process.env) {
  let mode: string | undefined
  const values = new Map<string, string>()
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]!
    // pnpm 转发参数时可能保留分隔符，suite 本身没有额外的透传参数。
    if (token === '--') {
      continue
    }
    if (!token.startsWith('-')) {
      if (!token.trim() || mode !== undefined) {
        throw new Error(`Unexpected e2e suite argument: ${token || '<empty>'}`)
      }
      mode = token
      continue
    }
    const equals = token.indexOf('=')
    const name = token.slice(2, equals < 0 ? undefined : equals)
    if (!token.startsWith('--') || (!valueOptions.has(name) && !booleanOptions.has(name))) {
      throw new Error(`Unknown e2e suite option: ${equals < 0 ? token : token.slice(0, equals)}`)
    }
    let value = equals < 0 ? undefined : token.slice(equals + 1)
    if (booleanOptions.has(name)) {
      if (value === undefined && ['true', 'false', '1', '0'].includes(args[index + 1] ?? '')) {
        value = args[++index]!
      }
      value ??= 'true'
      if (!['true', 'false', '1', '0'].includes(value)) {
        throw new Error(`--${name} requires a boolean.`)
      }
      value = value === 'true' || value === '1' ? 'true' : 'false'
    }
    else {
      if (value === undefined) {
        value = args[++index]
      }
      if (!value?.trim() || value.startsWith('--')) {
        throw new Error(`--${name} requires a value.`)
      }
    }
    if (values.has(name) && values.get(name) !== value) {
      throw new Error(`Conflicting --${name} values in the same command.`)
    }
    values.set(name, value)
  }
  const selectionArgs = [...values].filter(([name]) => selectionOptions.has(name)).map(([name, value]) => `--${name}=${value}`)
  const { selection } = splitWechatDevtoolsSelectionArgs(selectionArgs)
  return {
    mode: mode ?? 'full',
    selection,
    allowFailures: values.get('allow-failures') === 'true',
    filter: values.get('filter') ?? env.WEAPP_VITE_E2E_TASK_FILTER ?? '',
    from: values.get('from') ?? env.WEAPP_VITE_E2E_TASK_FROM ?? '',
    rollFrom: values.get('roll-from') ?? env.WEAPP_VITE_E2E_TASK_ROLL_FROM ?? '',
    shardIndex: values.get('shard-index') ?? env.WEAPP_VITE_E2E_SHARD_INDEX ?? '',
    shardTotal: values.get('shard-total') ?? env.WEAPP_VITE_E2E_SHARD_TOTAL ?? '',
    topology: values.get('topology'),
    planFile: values.get('plan'),
    expectedPlanHash: values.get('expected-plan-hash'),
  }
}
