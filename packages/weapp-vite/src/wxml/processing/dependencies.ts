import type { CompilerContext } from '../../context'
import type { ProcessingStage } from './registry'
import path from 'pathe'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { releaseCoveredDependencies, releaseDependencies, retainDependency } from './registry'

export type WxmlDependencyCommit = (() => void) & { fail: () => void }

const deferredCommits = new WeakMap<CompilerContext, WxmlDependencyCommit>()

/** 转换阶段登记的依赖只在本轮输出成功后提交。 */
export function deferWxmlDependencyCommit(ctx: CompilerContext, commit?: WxmlDependencyCommit) {
  deferredCommits.get(ctx)?.fail()
  if (commit) {
    deferredCommits.set(ctx, commit)
  }
  else {
    deferredCommits.delete(ctx)
  }
}

export function failWxmlDependencies(ctx: CompilerContext) {
  deferredCommits.get(ctx)?.fail()
  deferredCommits.delete(ctx)
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
  ctx.runtimeState.wxmlProcessing?.failed.clear()
  ctx.runtimeState.wxmlProcessing?.references.clear()
  deferredCommits.delete(ctx as CompilerContext)
  ctx.runtimeState.wxmlProcessing?.listeners.clear()
}

export function getWxmlWatchFiles(ctx: Pick<CompilerContext, 'runtimeState'>): string[] {
  return [...ctx.runtimeState?.wxmlProcessing?.references.keys() ?? []]
}

export function isWxmlDependency(ctx: Pick<CompilerContext, 'runtimeState'>, file: string) {
  return ctx.runtimeState?.wxmlProcessing?.references.has(normalizeFsResolvedId(file)) ?? false
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
export function beginWxmlDependencies(ctx: CompilerContext, scope: string, partial: boolean, stage: ProcessingStage = 'transform') {
  const state = ctx.runtimeState?.wxmlProcessing
  const pending = new Map<string, Set<string>>()
  const key = `${stage}:${scope}`
  const token = Symbol(key)
  let completed = false
  const root = ctx.configService.cwd
  let output: string | undefined
  state?.pending.set(token, { scope, stage, templates: pending })
  const fail = () => {
    if (!state || completed || !state.pending.has(token)) {
      return
    }
    completed = true
    const recovery = state.failed.get(key) ?? new Map<string, Set<string>>()
    for (const [name, files] of pending) {
      if (!files.size) {
        continue
      }
      const retained = recovery.get(name) ?? new Set<string>()
      recovery.set(name, retained)
      for (const file of files) {
        retainDependency(state, retained, file)
      }
    }
    if (recovery.size) {
      state.failed.set(key, recovery)
    }
    releaseDependencies(state, pending)
    state.pending.delete(token)
  }
  const commit = () => {
    if (!state || completed || !state.pending.has(token)) {
      return
    }
    completed = true
    const next = state.dependencies.get(key) ?? new Map<string, Set<string>>()
    releaseCoveredDependencies(state, next, partial ? pending : undefined)
    for (const [name, files] of pending) {
      if (files.size) {
        next.set(name, files)
      }
    }
    if (next.size) {
      state.dependencies.set(key, next)
    }
    else {
      state.dependencies.delete(key)
    }
    const recovery = state.failed.get(key)
    if (recovery) {
      releaseCoveredDependencies(state, recovery, partial ? pending : undefined)
      if (!recovery.size) {
        state.failed.delete(key)
      }
    }
    state.pending.delete(token)
    if (scope === 'main' && !partial && ctx.scanService?.independentSubPackageMap) {
      const activeScopes = new Set([...ctx.scanService.independentSubPackageMap.keys()].map(root => `independent:${root}`))
      for (const groups of [state.dependencies, state.failed]) {
        for (const [registered, templates] of groups) {
          const registeredScope = registered.slice(registered.indexOf(':') + 1)
          if (registeredScope.startsWith('independent:') && !activeScopes.has(registeredScope)) {
            releaseDependencies(state, templates)
            groups.delete(registered)
          }
        }
      }
    }
  }
  return {
    fail,
    commit,
    publish: Object.assign(commit, { fail }),
    template(fileName: string) {
      const files = pending.get(fileName) ?? new Set<string>()
      pending.set(fileName, files)
      return (file: string) => {
        if (completed || (state && !state.pending.has(token))) {
          throw new Error('The template dependency transaction has already completed.')
        }
        if (typeof file !== 'string' || !file.trim()) {
          throw new TypeError('addWatchFile expects a nonempty file path.')
        }
        output ??= normalizeFsResolvedId(ctx.configService.outDir)
        const resolved = normalizeFsResolvedId(path.resolve(root, file))
        if (resolved === output || resolved.startsWith(`${output}/`)) {
          throw new Error('addWatchFile cannot watch generated output.')
        }
        if (state) {
          retainDependency(state, files, resolved)
        }
        return resolved
      }
    },
  }
}
