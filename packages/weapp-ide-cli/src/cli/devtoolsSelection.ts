import type { WechatDevtoolsSelectionOptions } from '../devtoolsTarget'
import { validateWechatDevtoolsSelection, withWechatDevtoolsSelection } from '../devtoolsTarget'

const selectionOptions = new Map([
  ['--cli-path', 'cliPath'],
  ['--devtools-channel', 'devtoolsChannel'],
  ['--devtools-version', 'devtoolsVersion'],
] as const)
const valueOptions = new Set(['--project', '-p', '--desc', '-d', '--version', '-v', '--uv', '--appid', '--ext-appid', '--info-output', '-i', '--result-output', '-r', '--qr-output', '--qr-format', '--qr-size', '--port', '--timeout', '-t', '--session-id', '--output', '-o', '--page', '--lang', '--platform', '--runtime-url', '--login-retry', '--login-retry-timeout', '--config', '-c', '--mode', '-m', '--filter', '-f', '--base', '--logLevel', '-l', '--project-config', '--logPath', '--ticket', '--account', '--test-ticket', '--compile-condition', '--compile-type', '--clean', '--auto-port', '--auto-account', '--replay-config-path', '--key-store', '--key-alias', '--key-pass', '--store-pass', '--use-aab', '--resourceBundleVersion', '--resourceBundleDesc', '--isDistribute', '--isRemoteBuild', '--profilePath', '--certificateName', '--p12Path', '--p12Password', '--tpnsProfilePath', '--isUploadBeta', '--versionName', '--versionCode', '--versionDesc'])

/** 包装参数不会透传官方 CLI，选项值和双横线后的内容保持原样。 */
export function splitWechatDevtoolsSelectionArgs(argv: readonly string[]) {
  const selection: WechatDevtoolsSelectionOptions = {}
  const args: string[] = []
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index]!
    if (token === '--') {
      args.push(...argv.slice(index))
      break
    }
    const equals = token.indexOf('=')
    const name = equals < 0 ? token : token.slice(0, equals)
    const key = selectionOptions.get(name as '--cli-path' | '--devtools-channel' | '--devtools-version')
    if (key) {
      const value = equals < 0 ? argv[++index] : token.slice(equals + 1)
      if (!value?.trim() || value.startsWith('-')) {
        throw new Error(`${name} requires a value.`)
      }
      if (selection[key] !== undefined && selection[key] !== value.trim()) {
        throw new Error(`Conflicting ${name} values in the same command.`)
      }
      Object.assign(selection, { [key]: value.trim() })
    }
    else if (name === '--require-official-latest') {
      const value = equals < 0 ? 'true' : token.slice(equals + 1)
      if (!['true', 'false', '1', '0'].includes(value)) {
        throw new Error('--require-official-latest requires a boolean.')
      }
      const enabled = value === 'true' || value === '1'
      if (selection.requireOfficialLatest !== undefined && selection.requireOfficialLatest !== enabled) {
        throw new Error('Conflicting --require-official-latest values in the same command.')
      }
      selection.requireOfficialLatest = enabled
    }
    else {
      args.push(token)
      if (equals < 0 && valueOptions.has(name) && argv[index + 1] !== undefined) {
        args.push(argv[++index]!)
      }
    }
  }
  validateWechatDevtoolsSelection(selection)
  return { args, selection }
}

/** 显式选择在任何 helper 或 CLI 回退之前固定，避免入口间选版漂移。 */
export async function withWechatDevtoolsSelectionArgs<T>(argv: readonly string[], runner: (args: string[]) => Promise<T>): Promise<T> {
  const { args, selection } = splitWechatDevtoolsSelectionArgs(argv)
  return Object.keys(selection).length
    ? await withWechatDevtoolsSelection(selection, () => runner(args))
    : await runner(args)
}
