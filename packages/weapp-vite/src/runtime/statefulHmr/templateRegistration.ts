import type { VueSfcBlockSignatures } from 'wevu/compiler'
import type { HmrRuntimeFallbackReason } from '../hmrRuntimeCapabilities'
import type { StatefulHmrSnapshot } from './globalStyles'
import { createHash } from 'node:crypto'
import { compileTemplate, parse } from 'vue/compiler-sfc'
import { resolveVueSfcHmrSignatures } from 'wevu/compiler'
import { compilerSourceId } from '../../plugins/compilerPlugin/hmr'

interface NativeVueTemplateBaseline {
  blocks?: VueSfcBlockSignatures
  templateContext?: string
}

/** Vue 会以 TypeScript 解析模板表达式；JS 脚本不能据此提前接受 TS 语法。 */
function hasTypeScriptSyntax(value: unknown, visited = new WeakSet<object>()): boolean {
  if (value === null || typeof value !== 'object') {
    return false
  }
  if (visited.has(value)) {
    return false
  }
  visited.add(value)
  if (Array.isArray(value)) {
    return value.some(item => hasTypeScriptSyntax(item, visited))
  }
  const node = value as Record<string, unknown>
  return (typeof node.type === 'string' && node.type.startsWith('TS'))
    || Object.values(node).some(item => hasTypeScriptSyntax(item, visited))
}

function resolveNativeVueTemplateBaseline(source: string, file: string, validateTemplate = false): NativeVueTemplateBaseline {
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
    const context = [
      { ...serializeBlock(template), content: undefined },
      descriptor.customBlocks.filter(block => block.type !== 'json' && block.type !== 'config').map(serializeBlock),
    ]
    const isTypeScript = descriptor.script?.lang === 'ts'
      || descriptor.script?.lang === 'tsx'
      || descriptor.scriptSetup?.lang === 'ts'
      || descriptor.scriptSetup?.lang === 'tsx'
    if (validateTemplate && !isTypeScript && hasTypeScriptSyntax(template.ast)) {
      return { blocks }
    }
    // 仅使用内置 Vue 编译器校验 inline HTML；不执行用户插件、预处理器或读取外部依赖。
    // 错误仍交给正式编译路径报告，不能把语法错误转换成能力回退。
    if (validateTemplate && compileTemplate({
      source: template.content,
      filename: file,
      id: 'weapp-vite-hmr-capability',
      compilerOptions: { expressionPlugins: isTypeScript ? ['typescript'] : [] },
    }).errors.length) {
      return { blocks }
    }
    return { blocks, templateContext: createHash('sha256').update(JSON.stringify(context)).digest('hex') }
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
      if (!previous?.blocks || !previous.templateContext || typeof source !== 'string') {
        return false
      }
      const blocks = resolveVueSfcHmrSignatures(source, file).blockSignatures
      if (!blocks || previous.blocks.template === blocks.template
        || previous.blocks.script !== blocks.script
        || previous.blocks.style !== blocks.style
        || previous.blocks.config !== blocks.config) {
        return false
      }
      const current = resolveNativeVueTemplateBaseline(source, file, true)
      // 注册签名包含原始模板字节；语法有效且编译上下文不变的纯模板编辑必然需要重新注册。
      return previous.templateContext === current.templateContext
    })
    if (changed.length) {
      return {
        code: 'native-registration',
        message: '固定源码的有效模板已改变原生注册签名，需要 classic 重新建立模板、计算绑定与事件注册。',
        files: changed,
      }
    }
  }
}

/** 模板注册与冻结编译输入共用真实源码身份，避免 Windows 短路径或 junction 产生别名。 */
export function normalizeTemplateRegistrationSignatures(signatures: StatefulHmrSnapshot['templateRegistrationSignatures']) {
  return signatures && new Map(Array.from(signatures, ([file, signature]) => [compilerSourceId(file), signature]))
}

/** 只比较编译完成的冻结快照；原生 WXML 由宿主独立更新，不参与编译模板注册。 */
export function resolveTemplateRegistrationFallback(
  previous: StatefulHmrSnapshot['templateRegistrationSignatures'],
  snapshot: Pick<StatefulHmrSnapshot, 'templateRegistrationSignatures' | 'entryIds'>,
): HmrRuntimeFallbackReason | undefined {
  previous = normalizeTemplateRegistrationSignatures(previous)
  const current = normalizeTemplateRegistrationSignatures(snapshot.templateRegistrationSignatures)
  const owners = new Set([
    ...(previous?.keys() ?? []),
    ...(current?.keys() ?? []),
    ...(snapshot.entryIds ?? []).filter(id => /\.(?:vue|jsx|tsx)$/.test(id)).map(compilerSourceId),
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
