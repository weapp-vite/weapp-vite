import type { VueSfcBlockSignatures } from 'wevu/compiler'
import type { HmrRuntimeFallbackReason } from '../hmrRuntimeCapabilities'
import type { StatefulHmrSnapshot } from './globalStyles'
import { createHash } from 'node:crypto'
import { parse } from 'vue/compiler-sfc'
import { resolveVueSfcHmrSignatures } from 'wevu/compiler'

interface NativeVueTemplateBaseline {
  blocks?: VueSfcBlockSignatures
  textIndependentShape?: string
}

/** 只省略 Vue TEXT/COMMENT 的文本及节点位置；表达式内容和未知 AST 结构不能省略。 */
function normalizeTemplateAst(value: unknown, textContent = false): unknown {
  if (value === null || typeof value !== 'object') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(item => normalizeTemplateAst(item, textContent))
  }
  if (value instanceof Set && value.size === 0) {
    return []
  }
  const node = value as Record<string, unknown>
  // compiler-sfc 的未转换模板只使用 ROOT 至 DIRECTIVE（0..7）。
  // Babel 表达式、循环分析及其他未知结构保留正式编译路径。
  if (typeof node.type !== 'number' || !Number.isInteger(node.type) || node.type < 0 || node.type > 7) {
    throw new TypeError('Unknown Vue template AST structure')
  }
  return Object.fromEntries(Object.entries(node)
    .filter(([key]) => key !== 'loc'
      && !(node.type === 0 && key === 'source')
      && !(textContent && (node.type === 2 || node.type === 3) && key === 'content'))
    .map(([key, item]) => [key, normalizeTemplateAst(item, (node.type === 0 || node.type === 1) && key === 'children')]))
}

function resolveNativeVueTemplateBaseline(source: string, file: string): NativeVueTemplateBaseline {
  const blocks = resolveVueSfcHmrSignatures(source, file).blockSignatures
  if (!blocks) {
    return {}
  }
  const { descriptor, errors } = parse(source, { filename: file })
  const template = descriptor.template
  if (errors.length || !template?.ast || template.src || (template.lang && template.lang !== 'html')) {
    return { blocks }
  }
  try {
    const serializeBlock = (block: { attrs: Record<string, string | true>, content: string, type: string }) => ({
      attrs: Object.fromEntries(Object.entries(block.attrs).sort(([a], [b]) => a.localeCompare(b))),
      content: block.content,
      type: block.type,
    })
    const shape = [
      { ...serializeBlock(template), content: undefined },
      descriptor.customBlocks.filter(block => block.type !== 'json' && block.type !== 'config').map(serializeBlock),
      normalizeTemplateAst(template.ast),
    ]
    return { blocks, textIndependentShape: createHash('sha256').update(JSON.stringify(shape)).digest('hex') }
  }
  catch {
    return { blocks }
  }
}

/** 只接受成功发布的固定源码，提前识别必然改变原生注册的模板更新。 */
export class NativeVueTemplateBaselines {
  private readonly signatures = new Map<string, NativeVueTemplateBaseline>()

  has(file: string): boolean {
    return this.signatures.has(file)
  }

  clear(): void {
    this.signatures.clear()
  }

  commit(file: string, source: string): void {
    this.signatures.set(file, resolveNativeVueTemplateBaseline(source, file))
  }

  resolveFallback(files: readonly string[], sources: ReadonlyMap<string, string | null>): HmrRuntimeFallbackReason | undefined {
    const changed = files.filter((file) => {
      const previous = this.signatures.get(file)
      const source = sources.get(file)
      if (!previous?.blocks || !previous.textIndependentShape || typeof source !== 'string') {
        return false
      }
      const current = resolveNativeVueTemplateBaseline(source, file)
      // 只有文本/注释变化可由已发布模板证明语法有效；其余编辑保留正式编译错误。
      return current.blocks && previous.textIndependentShape === current.textIndependentShape
        && previous.blocks.template !== current.blocks.template
        && previous.blocks.script === current.blocks.script
        && previous.blocks.style === current.blocks.style
        && previous.blocks.config === current.blocks.config
    })
    if (changed.length) {
      return {
        code: 'native-registration',
        message: '固定源码的模板文本或注释已改变原生注册签名，需要 classic 重新建立模板、计算绑定与事件注册。',
        files: changed,
      }
    }
  }
}

/** 只比较编译完成的冻结快照；原生 WXML 由宿主独立更新，不参与编译模板注册。 */
export function resolveTemplateRegistrationFallback(
  previous: StatefulHmrSnapshot['templateRegistrationSignatures'],
  snapshot: Pick<StatefulHmrSnapshot, 'templateRegistrationSignatures' | 'entryIds'>,
): HmrRuntimeFallbackReason | undefined {
  const current = snapshot.templateRegistrationSignatures
  const owners = new Set([
    ...(previous?.keys() ?? []),
    ...(current?.keys() ?? []),
    ...(snapshot.entryIds ?? []).filter(id => /\.(?:vue|jsx|tsx)$/.test(id)),
  ])
  const changed = [...owners].filter(owner => !previous?.get(owner) || !current?.get(owner) || previous.get(owner) !== current.get(owner))
  if (changed.length) {
    return {
      code: 'native-registration',
      message: '编译模板注册签名发生变化或缺少能力证明，需要 classic 重新建立模板、计算绑定与事件注册。',
      files: changed,
    }
  }
}
