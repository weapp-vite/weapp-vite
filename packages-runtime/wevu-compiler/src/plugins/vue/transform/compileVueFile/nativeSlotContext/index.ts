import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { ComponentSourceInfo } from '../componentSources'
import type { CompileVueFileOptions } from '../types'
import type { ScriptFacts } from './script'
import { prepareSfcScriptCompile } from '../../../../../pageDeclaration'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse } from '../../../../../utils/babel'
import { resolveSfcBlockSrc } from '../../../../utils/vueSfc'
import { collectComponentSourceInfo } from '../componentSources'
import { analyzeScript } from './script'
import { createSourceReader, normalizeSourceId } from './source'
import { analyzeTemplate } from './template'

export type { NativeSlotContextAnalysisCache } from './source'

type Descriptor = Pick<SFCDescriptor, 'script' | 'scriptSetup' | 'template'>

interface ParticipationNode {
  required: boolean
  edges: Set<string>
}

/** 从当前输入重建依赖图，再将上下文需求沿组件拥有关系向上传播。 */
export async function analyzeNativeSlotContext({ descriptor, filename, options, components }: {
  descriptor: Descriptor
  filename: string
  options: CompileVueFileOptions | undefined
  components: ComponentSourceInfo
}): Promise<{ required: boolean, tags: Set<string>, dependencies: string[] }> {
  const rootId = normalizeSourceId(filename)
  const rootTemplate = analyzeTemplate(descriptor.template?.content ?? '', options?.template)
  const dependencies = new Set<string>()
  const sources = createSourceReader(options, dependencies)
  const graph = new Map<string, ParticipationNode>()
  // 导出值依赖当前整张图，只在本轮持有；共享缓存仅保存源文件及其 AST。
  const modules = new Map<string, ScriptFacts>()
  const analyzingModules = new Set<string>()
  const loadModule = async (source: string, importer: string): Promise<ScriptFacts | undefined> => {
    const id = await sources.resolve(source, importer)
    if (!id || id.endsWith('.vue')) {
      return undefined
    }
    const cached = modules.get(id)
    if (cached) {
      return cached
    }
    if (analyzingModules.has(id)) {
      return { required: true, imports: new Set(), exports: new Map() }
    }
    const input = await sources.load(id)
    if (!input) {
      return undefined
    }
    try {
      input.ast ??= parse(input.source, BABEL_TS_MODULE_PARSER_OPTIONS)
    }
    catch {
      const result: ScriptFacts = { required: true, imports: new Set(), exports: new Map() }
      modules.set(id, result)
      return result
    }
    analyzingModules.add(id)
    const result = await analyzeScript(input.ast, false, undefined, undefined, source => loadModule(source, id))
    analyzingModules.delete(id)
    modules.set(id, result)
    return result
  }
  const pending: string[] = []
  const enqueue = (input: string) => {
    const id = normalizeSourceId(input)
    dependencies.add(id)
    if (!graph.has(id)) {
      graph.set(id, { required: false, edges: new Set() })
      pending.push(id)
    }
    return id
  }
  const addImports = async (node: ParticipationNode, imports: Set<string>, importer: string) => {
    for (const source of imports) {
      const id = await sources.resolve(source, importer)
      if (id) {
        node.edges.add(enqueue(id))
      }
      else {
        node.required = true
      }
    }
  }
  const addComponent = async (node: ParticipationNode, current: Descriptor, id: string, info: ComponentSourceInfo) => {
    const template = id === rootId ? rootTemplate : analyzeTemplate(current.template?.content ?? '', options?.template)
    node.required ||= template.required || Boolean(current.template?.lang && current.template.lang !== 'html')
    for (const tag of template.tags) {
      if (!info.wevuComponentTags.has(tag)) {
        node.required = true
      }
      const source = info.resolvedComponentIds.get(tag)
      if (source) {
        node.edges.add(enqueue(source))
      }
      else {
        node.required = true
      }
    }
    const script = await analyzeScript(current.script?.content ?? '', true, current.scriptSetup?.content, template.expressions, source => loadModule(source, id))
    node.required ||= script.required
    await addImports(node, script.imports, id)
  }

  enqueue(rootId)
  for (const id of pending) {
    const node = graph.get(id)!
    if (id === rootId) {
      node.required ||= Boolean(options?.pageLayout || options?.appShell)
      // 当前 descriptor 是调用者的权威输入，不能被磁盘或旧缓存覆盖。
      for (const block of [descriptor.template, descriptor.script, descriptor.scriptSetup]) {
        if (!block?.src) {
          continue
        }
        const sourceId = await sources.resolve(block.src, id)
        if (sourceId) {
          dependencies.add(sourceId)
        }
        else {
          node.required = true
        }
        if (!options?.sfcSrc) {
          node.required = true
        }
      }
      await addComponent(node, descriptor, id, components)
      continue
    }
    const facts = await sources.load(id)
    if (!facts || facts.invalid) {
      node.required = true
      continue
    }
    if (!facts.descriptor) {
      const script = modules.get(id) ?? await loadModule(id, id)
      node.required ||= !script || script.required
      if (script) {
        await addImports(node, script.imports, id)
      }
      continue
    }
    let current = facts.descriptor
    try {
      const resolved = await resolveSfcBlockSrc({ ...current, styles: [] }, id, {
        ...options?.sfcSrc,
        resolveId: (source, importer) => sources.resolve(source, importer ?? id),
        readFile: async (sourceId) => {
          const source = await sources.load(sourceId)
          if (!source) {
            throw new Error(`Unavailable source: ${sourceId}`)
          }
          return source.source
        },
      })
      current = resolved.descriptor
      for (const dependency of resolved.deps) {
        dependencies.add(normalizeSourceId(dependency))
      }
      if (resolved.scriptResolvedId || resolved.scriptSetupResolvedId) {
        current = prepareSfcScriptCompile(facts.source, id, current, false, resolved, false)?.descriptor ?? current
      }
    }
    catch {
      node.required = true
      for (const block of [current.template, current.script, current.scriptSetup]) {
        if (block?.src) {
          await sources.resolve(block.src, id)
        }
      }
    }
    try {
      const info = await collectComponentSourceInfo({
        descriptor: current,
        descriptorForCompile: current,
        filename: id,
        compileOptions: options,
        autoUsingComponents: options?.autoUsingComponents,
        autoImportTags: options?.autoImportTags,
      })
      await addComponent(node, current, id, info)
    }
    catch {
      node.required = true
    }
  }

  const classifications = new Map<string, boolean>()
  const visiting = new Set<string>()
  const required = (id: string): boolean => {
    if (visiting.has(id)) {
      return true
    }
    const cached = classifications.get(id)
    if (cached !== undefined) {
      return cached
    }
    const node = graph.get(id)
    if (!node) {
      return true
    }
    visiting.add(id)
    let result = node.required
    for (const dependency of node.edges) {
      // 不短路：同一轮仍须分类其余分支和循环，且不把闭包写入共享缓存。
      result = required(dependency) || result
    }
    visiting.delete(id)
    classifications.set(id, result)
    return result
  }
  const rootRequired = required(rootId)
  const tags = new Set<string>()
  for (const tag of rootTemplate.tags) {
    if (!components.wevuComponentTags.has(tag)) {
      continue
    }
    const source = components.resolvedComponentIds.get(tag)
    if (!source || required(normalizeSourceId(source))) {
      tags.add(tag)
    }
  }
  dependencies.delete(rootId)
  return { required: rootRequired, tags, dependencies: [...dependencies] }
}
