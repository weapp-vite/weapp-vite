import type { OutputBundle } from 'rolldown'
import type { CompilerContext } from '../../context'

const owners = new WeakMap<CompilerContext, ReadonlyMap<string, string>>()

/** 保存 CSS 阶段实际产生的、尚未注入 Tailwind 结果的样式模板。 */
export function rememberTailwindStyleOwners(ctx: CompilerContext, bundle: OutputBundle, extension: string) {
  const next = new Map(owners.get(ctx))
  for (const output of Object.values(bundle)) {
    if (output.type === 'asset' && output.fileName.endsWith(`.${extension}`)) {
      next.set(output.fileName, typeof output.source === 'string' ? output.source : new TextDecoder().decode(output.source))
    }
  }
  owners.set(ctx, next)
}

/** 快照与 DevEngine 使用独立上下文，通过不可变版本交接真实样式归属。 */
export function getTailwindStyleOwners(ctx: CompilerContext): ReadonlyMap<string, string> {
  return owners.get(ctx) ?? new Map()
}

/** 只在快照提交后替换归属，避免未发布的快照污染后续增量批次。 */
export function setTailwindStyleOwners(ctx: CompilerContext, value: ReadonlyMap<string, string> | undefined) {
  if (value) {
    owners.set(ctx, new Map(value))
  }
}
