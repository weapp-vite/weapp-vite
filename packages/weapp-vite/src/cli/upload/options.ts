import type { CAC } from 'cac'
import type { GlobalCLIOptions } from '../types'
import { parseArgs } from 'node:util'

export interface UploadCLIOptions extends GlobalCLIOptions {
  uv?: string
  desc?: string
  bump?: string
  gitDesc?: boolean
  dryRun?: boolean
  json?: boolean
  timeout?: string | number
}

export interface BuildUploadCLIOptions extends UploadCLIOptions {
  upload?: boolean
}

export function readUploadMetadata(cli: CAC) {
  for (const name of ['uv', 'desc', 'bump']) {
    const value: unknown = cli.options[name]
    if (typeof value === 'boolean' || (Array.isArray(value) && value.some(item => typeof item === 'boolean'))) {
      throw new Error(`--${name} 需要指定字符串参数。`)
    }
  }
  // CAC 会把数字形态与空白参数转成 number；从原始参数保留版本和说明的字符串语义。
  const { values } = parseArgs({
    args: cli.rawArgs.slice(2),
    allowPositionals: true,
    strict: false,
    options: {
      uv: { type: 'string' },
      desc: { type: 'string' },
      bump: { type: 'string' },
    },
  })
  return {
    uv: typeof values.uv === 'string' ? values.uv : undefined,
    desc: typeof values.desc === 'string' ? values.desc : undefined,
    bump: typeof values.bump === 'string' ? values.bump : undefined,
  }
}

/** 超时只约束单个平台的 SDK 进程，不含构建；未指定时不改变原有等待行为。 */
export function resolveUploadTimeout(value: UploadCLIOptions['timeout']): number | undefined {
  if (value === undefined) {
    return undefined
  }
  const seconds = typeof value === 'number' ? value : Number(value)
  const milliseconds = Math.round(seconds * 1000)
  if ((typeof value !== 'string' && typeof value !== 'number')
    || !Number.isFinite(milliseconds) || milliseconds / 1000 !== seconds
    || milliseconds <= 0 || milliseconds > 2147483647) {
    throw new Error('--timeout 必须为正数秒，精度不超过毫秒且不能超过 2147483.647 秒。')
  }
  return milliseconds
}

/** 普通构建不读取上传元数据；上传必须是显式的一次性构建操作。 */
export function resolveBuildUploadOptions(cli: CAC, options: BuildUploadCLIOptions): UploadCLIOptions | undefined {
  if (options.upload !== true) {
    if (options.uv !== undefined || options.desc !== undefined || options.bump !== undefined || options.gitDesc !== undefined || options.dryRun !== undefined) {
      throw new Error('--uv、--desc、--bump、--git-desc 和 --dry-run 仅能与 --upload 一起使用。')
    }
    return undefined
  }
  if (options.watch) {
    throw new Error('--upload 不能与 --watch 一起使用，请执行一次性构建。')
  }
  return { ...options, ...readUploadMetadata(cli) }
}
