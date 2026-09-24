import type { CompilerContext } from '../../context'
import path from 'pathe'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

const deferredCommits = new WeakMap<CompilerContext, () => void>()

/** 转换阶段登记的依赖只在本轮输出成功后提交。 */
export function deferWxmlDependencyCommit(ctx: CompilerContext, commit?: () => void) {
  if (commit) {
    deferredCommits.set(ctx, commit)
  }
  else {
    deferredCommits.delete(ctx)
  }
}

export function commitWxmlDependencies(ctx: CompilerContext) {
  deferredCommits.get(ctx)?.()
  deferredCommits.delete(ctx)
}

const borrowedRegistries = new WeakSet<CompilerContext['runtimeState']>()

/** 隔离快照和独立分包借用开发会话的依赖集合，由拥有者统一释放。 */
export function shareWxmlDependencies(owner: Pick<CompilerContext, 'runtimeState'>, child: Pick<CompilerContext, 'runtimeState'>) {
  child.runtimeState.wxmlProcessing = owner.runtimeState.wxmlProcessing
  borrowedRegistries.add(child.runtimeState)
}

export function clearWxmlDependencies(ctx: Pick<CompilerContext, 'runtimeState'>) {
  if (borrowedRegistries.has(ctx.runtimeState)) {
    return
  }
  ctx.runtimeState.wxmlProcessing?.dependencies.clear()
  ctx.runtimeState.wxmlProcessing?.pending.clear()
  ctx.runtimeState.wxmlProcessing?.listeners.clear()
}

export function getWxmlWatchFiles(ctx: Pick<CompilerContext, 'runtimeState'>): string[] {
  const state = ctx.runtimeState?.wxmlProcessing
  if (!state) {
    return []
  }
  const files = new Set<string>()
  for (const templates of [...state.dependencies.values(), ...[...state.pending.values()].map(build => build.templates)]) {
    for (const dependencies of templates.values()) {
      for (const file of dependencies) {
        files.add(file)
      }
    }
  }
  return [...files]
}

export function isWxmlDependency(ctx: Pick<CompilerContext, 'runtimeState'>, file: string) {
  return getWxmlWatchFiles(ctx).includes(normalizeFsResolvedId(file))
}

export function observeWxmlDependencies(ctx: Pick<CompilerContext, 'runtimeState'>, listener: (files: string[]) => void) {
  const state = ctx.runtimeState.wxmlProcessing
  if (!state) {
    return () => {}
  }
  state.listeners.add(listener)
  listener(getWxmlWatchFiles(ctx))
  return () => {
    state.listeners.delete(listener)
  }
}

/** 注册立即生效以支持失败恢复，成功后再提交本轮各模板的依赖集合。 */
export function beginWxmlDependencies(ctx: CompilerContext, scope: string, partial: boolean, stage: 'transform' | 'validate' = 'transform') {
  const state = ctx.runtimeState?.wxmlProcessing
  const pending = new Map<string, Set<string>>()
  const key = `${stage}:${scope}`
  const token = Symbol(key)
  const previous = [...state?.pending ?? []].filter(([, build]) => build.scope === scope && build.stage === stage).map(([key]) => key)
  state?.pending.set(token, { scope, stage, templates: pending })
  return {
    template(fileName: string) {
      const files = new Set<string>()
      pending.set(fileName, files)
      return (file: string) => {
        if (typeof file !== 'string' || !file.trim()) {
          throw new TypeError('addWatchFile expects a nonempty file path.')
        }
        const resolved = normalizeFsResolvedId(path.resolve(ctx.configService.cwd, file))
        const output = normalizeFsResolvedId(ctx.configService.outDir)
        if (resolved === output || resolved.startsWith(`${output}/`)) {
          throw new Error('addWatchFile cannot watch generated output.')
        }
        const known = isWxmlDependency(ctx, resolved)
        files.add(resolved)
        if (!known) {
          for (const listener of state?.listeners ?? []) {
            listener(getWxmlWatchFiles(ctx))
          }
        }
        return resolved
      }
    },
    commit() {
      if (!state) {
        return
      }
      const next = partial ? new Map(state.dependencies.get(key)) : new Map<string, Set<string>>()
      for (const [file, dependencies] of pending) {
        next.set(file, dependencies)
      }
      state.dependencies.set(key, next)
      if (scope === 'main' && !partial && ctx.scanService?.independentSubPackageMap) {
        const activeScopes = new Set([...ctx.scanService.independentSubPackageMap.keys()].map(root => `independent:${root}`))
        for (const registered of state.dependencies.keys()) {
          const registeredScope = registered.slice(registered.indexOf(':') + 1)
          if (registeredScope.startsWith('independent:') && !activeScopes.has(registeredScope)) {
            state.dependencies.delete(registered)
          }
        }
        for (const [key, build] of state.pending) {
          if (build.scope.startsWith('independent:') && !activeScopes.has(build.scope)) {
            state.pending.delete(key)
          }
        }
      }
      state.pending.delete(token)
      for (const key of previous) {
        state.pending.delete(key)
      }
    },
  }
}
