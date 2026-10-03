import type { AstEngineName } from '../../../../../ast'
import { LRUCache } from 'lru-cache'
import { collectScriptSetupImportsFromCode } from '../../../../../ast'
import { normalizeFsResolvedId } from '../../../../../utils/resolvedId'
import { collectVueTemplateTags, isAutoImportCandidateTag, VUE_COMPONENT_TAG_RE } from '../../../../../utils/vueTemplateTags'
import { collectComponentTagInfo } from './componentTags'

type ScriptSetupImport = Readonly<ReturnType<typeof collectScriptSetupImportsFromCode>[number]>

interface TemplateFacts {
  readonly source: string
  readonly autoImportTags: readonly string[]
  readonly componentNames: readonly string[]
  readonly tagsByComponentName: Readonly<Record<string, readonly string[]>>
}

interface ImportFacts {
  readonly source: string
  readonly engine: AstEngineName
  readonly names: readonly string[]
  readonly imports: readonly ScriptSetupImport[]
}

interface AnalysisRecord {
  readonly template: TemplateFacts
  readonly script?: ImportFacts
}

interface AnalysisInput {
  readonly filename: string
  readonly template: string
  readonly scriptSetup?: string
  readonly astEngine: AstEngineName
}

export interface ScriptSetupAnalysis {
  readonly autoImportTags: readonly string[]
  readonly imports: readonly (ScriptSetupImport & { readonly templateTags: readonly string[] })[]
}

function collectTemplateFacts(source: string, filename: string) {
  let failed = false
  const tags = collectVueTemplateTags(source, {
    filename,
    warnLabel: '自动 usingComponents',
    // 原调用未提供日志回调；这里只识别 partial result，不新增或吞掉外层告警。
    warn: () => { failed = true },
    shouldCollect: tag => VUE_COMPONENT_TAG_RE.test(tag) || isAutoImportCandidateTag(tag),
  })
  const { componentNames, tagsByComponentName } = collectComponentTagInfo(tags)
  const facts: TemplateFacts = Object.freeze({
    source,
    autoImportTags: Object.freeze([...tags].filter(isAutoImportCandidateTag)),
    componentNames: Object.freeze([...componentNames]),
    tagsByComponentName: Object.freeze(Object.fromEntries(
      [...tagsByComponentName].map(([name, matchedTags]) => [name, Object.freeze([...matchedTags])]),
    )),
  })
  return { facts, failed }
}

function hasSameNames(previous: readonly string[], current: readonly string[]) {
  if (previous.length !== current.length) {
    return false
  }
  const names = new Set(previous)
  return current.every(name => names.has(name))
}

function estimateRetainedBytes(record: AnalysisRecord, filename: string) {
  const { template, script } = record
  let characters = filename.length + template.source.length
    + template.autoImportTags.join('').length + template.componentNames.join('').length
  for (const [name, tags] of Object.entries(template.tagsByComponentName)) {
    characters += name.length + tags.join('').length
  }
  if (script) {
    characters += script.source.length + script.engine.length + script.names.join('').length
    for (const item of script.imports) {
      characters += item.localName.length + item.importSource.length + (item.importedName?.length ?? 0) + item.kind.length
    }
  }
  return Math.max(1, characters * 2)
}

/**
 * 每个入口加载器独占纯分析缓存；每个物理源码仅保留最后一版，不保存 AST 或解析路径。
 * 上限为 512 个源码、16 MiB 保留字符串与 facts 的 UTF-16 文本估算，并非精确堆内存计量。
 * 超大条目不缓存，失败或 partial result 仍在下一轮重新分析。
 */
export function createScriptSetupAnalyzer() {
  const cache = new LRUCache<string, AnalysisRecord>({
    max: 512,
    maxSize: 16 * 1024 * 1024,
    sizeCalculation: estimateRetainedBytes,
  })

  return {
    discard(filename: string) {
      cache.delete(normalizeFsResolvedId(filename))
    },
    clear() {
      cache.clear()
    },
    analyze(input: AnalysisInput): ScriptSetupAnalysis {
      const filename = normalizeFsResolvedId(input.filename)
      const previous = cache.get(filename)
      const { facts: template, failed } = previous?.template.source === input.template
        ? { facts: previous.template, failed: false }
        : collectTemplateFacts(input.template, filename)
      let script: ImportFacts | undefined
      if (input.scriptSetup !== undefined && template.componentNames.length) {
        const priorScript = previous?.script
        if (!failed && priorScript?.source === input.scriptSetup && priorScript.engine === input.astEngine
          && hasSameNames(priorScript.names, template.componentNames)) {
          script = priorScript
        }
        else {
          const imports = collectScriptSetupImportsFromCode(input.scriptSetup, new Set(template.componentNames), {
            astEngine: input.astEngine,
          })
          // AST 收集器用空数组表示无导入或解析失败，无法证明成功时不缓存该结果。
          if (imports.length) {
            script = Object.freeze({
              source: input.scriptSetup,
              engine: input.astEngine,
              names: template.componentNames,
              imports: Object.freeze(imports.map(item => Object.freeze({ ...item }))),
            })
          }
        }
      }
      if (failed) {
        cache.delete(filename)
      }
      else {
        cache.set(filename, { template, script })
      }
      return Object.freeze({
        autoImportTags: template.autoImportTags,
        imports: Object.freeze((script?.imports ?? []).map(item => Object.freeze({
          ...item,
          templateTags: template.tagsByComponentName[item.localName] ?? Object.freeze([item.localName]),
        }))),
      })
    },
  }
}

export type ScriptSetupAnalyzer = ReturnType<typeof createScriptSetupAnalyzer>
