import type { CompilerContext } from '../../../../../context'
import type { VueStaticConfigFacts } from '../../../../../utils/file/vueConfig'
import type { ScriptSetupAnalyzer } from '../scriptSetupAnalysis'
import { LRUCache } from 'lru-cache'
import { getHmrRuntimeSession } from '../../../../../runtime/hmrRuntimeSession'
import { createScriptSetupAnalyzer } from '../scriptSetupAnalysis'

interface EntryAnalysisFacts {
  scriptSetupAnalyzer: ScriptSetupAnalyzer
  staticVueConfigCache: LRUCache<string, VueStaticConfigFacts>
}

function createEntryAnalysisFacts(): EntryAnalysisFacts {
  return {
    scriptSetupAnalyzer: createScriptSetupAnalyzer(),
    staticVueConfigCache: new LRUCache<string, VueStaticConfigFacts>({
      max: 512,
      maxSize: 16 * 1024 * 1024,
      sizeCalculation: (facts, filename) => Math.max(1, (
        filename.length + facts.source.length + JSON.stringify(facts.config ?? null).length
      ) * 2),
    }),
  }
}

const sessionFacts = new WeakMap<object, WeakMap<object, LRUCache<string, EntryAnalysisFacts>>>()

/** 独立快照共享内容事实，每配置最多保留八个项目/平台范围，不保留编译上下文或钩子。 */
export function getEntryAnalysisFacts(ctx: CompilerContext): EntryAnalysisFacts {
  const session = getHmrRuntimeSession(ctx)
  let configurations = sessionFacts.get(session)
  if (!configurations) {
    configurations = new WeakMap()
    sessionFacts.set(session, configurations)
  }
  const config = ctx.configService
  const identity = config.options?.sourceConfig ?? config
  let roots = configurations.get(identity)
  if (!roots) {
    roots = new LRUCache({ max: 8 })
    configurations.set(identity, roots)
  }
  const key = JSON.stringify([config.cwd, config.absoluteSrcRoot, config.platform, config.isDev])
  let facts = roots.get(key)
  if (!facts) {
    facts = createEntryAnalysisFacts()
    roots.set(key, facts)
  }
  return facts
}
