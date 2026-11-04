import type { CompilerContext } from '../../context'
import type { WxmlDep } from '../../types'
import path from 'pathe'
import { resolveRelativeOutputFileNameWithExtension } from '../utils/outputFileName'

export interface NativeScriptSource {
  id: string
  deps: WxmlDep[]
}

export interface NativeScriptOwner {
  deps: WxmlDep[]
  roots: Array<{ path: string, dep: WxmlDep }>
}

/** 复用模板发射的路径映射；同一产物有多个源码候选时不猜测所有者。 */
export function createNativeScriptSourceResolver(
  config: Pick<CompilerContext['configService'], 'absoluteSrcRoot' | 'relativeOutputPath'>,
  tokens: ReadonlyMap<string, { deps: WxmlDep[] }>,
  extension: string,
) {
  let sources: Map<string, NativeScriptSource | undefined> | undefined
  return (fileName: string): NativeScriptSource | undefined => {
    const id = path.resolve(config.absoluteSrcRoot, fileName)
    const direct = tokens.get(id)
    if (direct) {
      return { id, deps: direct.deps }
    }
    if (!sources) {
      sources = new Map()
      for (const [sourceId, token] of tokens) {
        const output = path.normalize(resolveRelativeOutputFileNameWithExtension(config, sourceId, extension))
        sources.set(output, sources.has(output) ? undefined : { id: sourceId, deps: token.deps })
      }
    }
    return sources.get(path.normalize(fileName))
  }
}

/** 全部脚本分析完成后才绑定模板闭包；发射去重不能提前截断其他模板的依赖。 */
export async function bindNativeScriptOwners(
  service: Pick<CompilerContext['wxmlService'], 'setTokenDeps'>,
  owners: ReadonlyMap<string, NativeScriptOwner>,
  dependencies: ReadonlyMap<string, readonly string[]>,
) {
  await Promise.all([...owners].map(async ([owner, { deps, roots }]) => {
    const closure = new Map(roots.map(root => [root.path, root.dep]))
    for (const [file, dep] of closure) {
      for (const dependency of dependencies.get(file) ?? []) {
        if (!closure.has(dependency)) {
          closure.set(dependency, dep)
        }
      }
    }
    // 脚本循环只留在发射图内；监听层直接关联模板，避免脚本互相 touch 形成更新循环。
    const additional = [...closure].filter(([file]) => !roots.some(root => root.path === file)).map(([file, dep]) => ({ ...dep, value: path.relative(path.dirname(owner), file) }))
    await service.setTokenDeps?.(owner, [...deps, ...additional])
  }))
}
