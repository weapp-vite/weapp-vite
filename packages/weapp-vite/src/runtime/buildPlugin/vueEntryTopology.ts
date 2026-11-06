import type { CompilerContext } from '../../context'
import { createHash } from 'node:crypto'
import { parse as parseJson } from 'comment-json'
import { LRUCache } from 'lru-cache'
import { parse } from 'vue/compiler-sfc'
import { collectVueTemplateComponentNames } from '../../plugins/hooks/useLoadEntry/loadEntry/template'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { entryTopologySignature } from './entryTopologySignature'
import { collectVueScriptTopology } from './vueEntryTopology/script'

interface TopologyRecord {
  signature: string
  externalBlocks: boolean
  externalSources: readonly string[]
}

interface CachedTopology extends TopologyRecord {
  source: string
}

const owners = new WeakMap<CompilerContext['configService'], {
  records: Map<string, TopologyRecord>
  sources: LRUCache<string, CachedTopology>
}>()

function stateFor(configService: CompilerContext['configService']) {
  let state = owners.get(configService)
  if (!state) {
    state = {
      records: new Map(),
      sources: new LRUCache<string, CachedTopology>({ max: 512, maxSize: 16 * 1024 * 1024, sizeCalculation: (value, key) => Math.max(1, (value.source.length + value.signature.length + key.length) * 2) }),
    }
    owners.set(configService, state)
  }
  return state
}

function dynamicComponents(ast: unknown, expressions: string[], names: Set<string>) {
  if (!ast || typeof ast !== 'object') {
    return
  }
  const node = ast as { tag?: string, children?: unknown[], props?: Array<{ name: string, arg?: { content?: string }, exp?: { content?: string }, value?: { content: string } }> }
  if (node.tag?.includes('.')) {
    names.add(node.tag)
  }
  if (node.tag === 'component') {
    for (const prop of node.props ?? []) {
      if (prop.name === 'is' && prop.value) {
        expressions.push(JSON.stringify(prop.value.content))
        names.add(prop.value.content)
      }
      else if (prop.name === 'bind' && prop.arg?.content === 'is' && prop.exp?.content) {
        expressions.push(prop.exp.content)
      }
    }
  }
  for (const child of node.children ?? []) {
    dynamicComponents(child, expressions, names)
  }
}

/** 输入已完成平台条件预处理；仅分析当前 SFC，不读取磁盘、解析闭包或执行宏。 */
export function resolveVueEntryTopologySignature(configService: CompilerContext['configService'], filename: string, preparedSource: string): string {
  const file = normalizeFsResolvedId(filename)
  const state = stateFor(configService)
  const cached = state.sources.get(file)
  if (cached?.source === preparedSource) {
    return cached.signature
  }
  let externalBlocks = false
  let externalSources: readonly string[] = []
  let signature: string
  try {
    // Vue 自身按源码和解析选项缓存 descriptor，同一输入的编译与扫描可复用它。
    const { descriptor, errors } = parse(preparedSource, { filename: file, templateParseOptions: { prefixIdentifiers: false } })
    const sources = [descriptor.template?.src, descriptor.script?.src, descriptor.scriptSetup?.src, ...descriptor.customBlocks.filter(block => block.type === 'json').map(block => block.src)]
    externalSources = sources.slice(0, 3).filter((source): source is string => typeof source === 'string' && Boolean(source))
    externalBlocks = sources.some(Boolean)
    if (errors.length) {
      throw errors[0]
    }
    const template = descriptor.template?.content ?? ''
    const names = collectVueTemplateComponentNames(template, file)
    const expressions: string[] = []
    dynamicComponents(descriptor.template?.ast, expressions, names)
    const scripts = [descriptor.script?.content ?? '', descriptor.scriptSetup?.content ?? '']
    const script = collectVueScriptTopology(scripts, names, expressions)
    const configuration = descriptor.customBlocks.filter(block => block.type === 'json').map(block => entryTopologySignature(parseJson(block.content, undefined, true)))
    const projection = JSON.stringify({ components: [...names].sort(), sources, configuration, ...script })
    signature = `topology:${createHash('sha256').update(projection).digest('hex')}`
  }
  catch {
    // 检测器不接管编译诊断；无法证明结构稳定时保守升级扫描，原编译器仍负责报错。
    signature = `unresolved:${createHash('sha256').update(preparedSource).digest('hex')}`
  }
  state.records.set(file, { signature, externalBlocks, externalSources })
  state.sources.set(file, { source: preparedSource, signature, externalBlocks, externalSources })
  return signature
}

/** 完整扫描仅读取已记录的短签名，不重新解析全部已解析入口。 */
export function getRecordedVueEntryTopologySignature(configService: CompilerContext['configService'], filename: string) {
  return owners.get(configService)?.records.get(normalizeFsResolvedId(filename))?.signature
}

/** 外部块的内容失效由现有 owner 图派发，父 SFC 的 src 切换仍由签名识别。 */
export function hasRecordedVueEntryExternalBlocks(configService: CompilerContext['configService'], filename: string) {
  return owners.get(configService)?.records.get(normalizeFsResolvedId(filename))?.externalBlocks ?? false
}

/** 不解析外部闭包；图所有者按此已记录来源核对 script/template 内容变更。 */
export function getRecordedVueEntryExternalBlockSources(configService: CompilerContext['configService'], filename: string): readonly string[] {
  return owners.get(configService)?.records.get(normalizeFsResolvedId(filename))?.externalSources ?? []
}
