import type { CAC } from 'cac'
import type { GlobalCLIOptions } from '../types'
import { parseArgs } from 'node:util'

export interface UploadCLIOptions extends GlobalCLIOptions {
  uv?: string
  desc?: string
  dryRun?: boolean
}

export interface BuildUploadCLIOptions extends UploadCLIOptions {
  upload?: boolean
}

export function readUploadMetadata(cli: CAC) {
  for (const name of ['uv', 'desc']) {
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
    },
  })
  return {
    uv: typeof values.uv === 'string' ? values.uv : undefined,
    desc: typeof values.desc === 'string' ? values.desc : undefined,
  }
}

/** 普通构建不读取上传元数据；上传必须是显式的一次性构建操作。 */
export function resolveBuildUploadOptions(cli: CAC, options: BuildUploadCLIOptions): UploadCLIOptions | undefined {
  if (options.upload !== true) {
    if (options.uv !== undefined || options.desc !== undefined || options.dryRun !== undefined) {
      throw new Error('--uv、--desc 和 --dry-run 仅能与 --upload 一起使用。')
    }
    return undefined
  }
  if (options.watch) {
    throw new Error('--upload 不能与 --watch 一起使用，请执行一次性构建。')
  }
  return { ...options, ...readUploadMetadata(cli) }
}
