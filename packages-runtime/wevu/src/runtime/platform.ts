import {
  getMiniProgramPlatformByRuntimeGlobalKey,
  getMiniProgramRuntimeGlobalKey,
  getMiniProgramRuntimeGlobalKeys,
  resolveMiniProgramPlatform,
} from '@weapp-core/shared'

type MiniProgramGlobal = Record<string, any>
type ImportMetaWithEnv = ImportMeta & {
  env?: {
    PLATFORM?: string
  }
}

function getGlobalRuntime() {
  if (typeof globalThis === 'undefined') {
    return undefined
  }
  return globalThis as MiniProgramGlobal
}

export function resolveCurrentMiniProgramPlatform() {
  const globalRuntime = getGlobalRuntime()
  const compiledPlatform = (import.meta as ImportMetaWithEnv).env?.PLATFORM

  // 优先命中编译期平台分支，便于构建阶段做 dead-code elimination。
  const resolvedCompiledPlatform = resolveMiniProgramPlatform(compiledPlatform)
  if (resolvedCompiledPlatform) {
    return resolvedCompiledPlatform
  }

  for (const globalKey of getMiniProgramRuntimeGlobalKeys()) {
    if (globalRuntime?.[globalKey]) {
      return getMiniProgramPlatformByRuntimeGlobalKey(globalKey)
    }
  }

  return undefined
}

export function getMiniProgramGlobalObject(platformInput?: string): MiniProgramGlobal | undefined {
  const globalRuntime = getGlobalRuntime()
  const compiledPlatform = platformInput ?? (import.meta as ImportMetaWithEnv).env?.PLATFORM
  const resolvedCompiledPlatform = resolveMiniProgramPlatform(compiledPlatform)

  if (resolvedCompiledPlatform) {
    const globalKey = getMiniProgramRuntimeGlobalKey(resolvedCompiledPlatform)
    return globalRuntime?.[globalKey] as MiniProgramGlobal | undefined
  }

  for (const globalKey of getMiniProgramRuntimeGlobalKeys()) {
    const candidate = globalRuntime?.[globalKey]
    if (candidate) {
      return candidate as MiniProgramGlobal
    }
  }
  return undefined
}

export function getScopedSlotHostGlobalObject(): MiniProgramGlobal | undefined {
  return getMiniProgramGlobalObject() ?? getGlobalRuntime()
}
