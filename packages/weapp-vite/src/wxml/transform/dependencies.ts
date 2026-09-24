import type { CompilerContext } from '../../context'
import path from 'pathe'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

const borrowedRegistries = new WeakSet<CompilerContext['runtimeState']>()

/** 隔离快照和独立分包借用开发会话的依赖集合，由拥有者统一释放。 */
export function shareWxmlTransformDependencies(owner: Pick<CompilerContext, 'runtimeState'>, child: Pick<CompilerContext, 'runtimeState'>) {
  child.runtimeState.wxmlTransform = owner.runtimeState.wxmlTransform
  borrowedRegistries.add(child.runtimeState)
}

export function clearWxmlTransformDependencies(ctx: Pick<CompilerContext, 'runtimeState'>) {
  if (borrowedRegistries.has(ctx.runtimeState)) {
    return
  }
  ctx.runtimeState.wxmlTransform?.dependencies.clear()
  ctx.runtimeState.wxmlTransform?.pending.clear()
  ctx.runtimeState.wxmlTransform?.listeners.clear()
}

export function getWxmlTransformWatchFiles(ctx: Pick<CompilerContext, 'runtimeState'>): string[] {
  const state = ctx.runtimeState?.wxmlTransform
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

export function isWxmlTransformDependency(ctx: Pick<CompilerContext, 'runtimeState'>, file: string) {
  return getWxmlTransformWatchFiles(ctx).includes(normalizeFsResolvedId(file))
}

export function observeWxmlTransformDependencies(ctx: Pick<CompilerContext, 'runtimeState'>, listener: (files: string[]) => void) {
  const state = ctx.runtimeState.wxmlTransform
  if (!state) {
    return () => {}
  }
  state.listeners.add(listener)
  listener(getWxmlTransformWatchFiles(ctx))
  return () => {
    state.listeners.delete(listener)
  }
}

/** 注册立即生效以支持失败恢复，成功后再提交本轮各模板的依赖集合。 */
export function beginWxmlTransformDependencies(ctx: CompilerContext, scope: string, partial: boolean) {
  const state = ctx.runtimeState?.wxmlTransform
  const pending = new Map<string, Set<string>>()
  const token = Symbol(scope)
  const previous = [...state?.pending ?? []].filter(([, build]) => build.scope === scope).map(([key]) => key)
  state?.pending.set(token, { scope, templates: pending })
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
        const known = isWxmlTransformDependency(ctx, resolved)
        files.add(resolved)
        if (!known) {
          for (const listener of state?.listeners ?? []) {
            listener(getWxmlTransformWatchFiles(ctx))
          }
        }
        return resolved
      }
    },
    commit() {
      if (!state) {
        return
      }
      const next = partial ? new Map(state.dependencies.get(scope)) : new Map<string, Set<string>>()
      for (const [file, dependencies] of pending) {
        next.set(file, dependencies)
      }
      state.dependencies.set(scope, next)
      if (scope === 'main' && !partial && ctx.scanService?.independentSubPackageMap) {
        const activeScopes = new Set([...ctx.scanService.independentSubPackageMap.keys()].map(root => `independent:${root}`))
        for (const registered of state.dependencies.keys()) {
          if (registered.startsWith('independent:') && !activeScopes.has(registered)) {
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
