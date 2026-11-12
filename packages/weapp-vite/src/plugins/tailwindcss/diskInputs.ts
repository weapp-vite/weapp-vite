import type { CompilerGenerateResult } from 'weapp-tailwindcss/core'
import type { CompilerContext } from '../../context'
import path from 'pathe'
import { getHmrRuntimeSession } from '../../runtime/hmrRuntimeSession'
import { CompilerHmrResyncError } from '../compilerPlugin/hmr'
import { readCompilerRawInput } from '../compilerPlugin/rawInputs'
import { notifyCompilerInput } from '../utils/sourceSnapshot'

/** 原生扫描器直接读盘；只确认生成前后版本未变且确属实际扫描范围的待发布来源。 */
export function captureTailwindDiskInputs(ctx: CompilerContext) {
  const config = ctx.configService
  const pending = config.isDev && config.outDir
    ? getHmrRuntimeSession(ctx).sourcePublication.capture(path.resolve(config.outDir))
    : []
  const inputs = pending.map(({ file }) => ({ file, read: readCompilerRawInput(file) }))
  return async (result: CompilerGenerateResult) => {
    if (!inputs.length) {
      return
    }
    const { createTailwindV4SourceEntryMatcher } = await import('@weapp-tailwindcss/engine')
    const matches = createTailwindV4SourceEntryMatcher(result.sources.map(source => ({ ...source })))
    for (const { file, read } of inputs) {
      if (!read || !matches?.(file)) {
        continue
      }
      const current = readCompilerRawInput(file)
      if (!current || current.version !== read.version || current.digest !== read.digest || current.byteLength !== read.byteLength) {
        throw new CompilerHmrResyncError([file], 'Tailwind 扫描期间来源已改变，等待下一次完整发布。')
      }
      notifyCompilerInput(config, file, read.source)
    }
  }
}
