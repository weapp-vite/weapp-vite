type MiniProgramGlobal = Record<string, any>
type ImportMetaWithEnv = ImportMeta & {
  env: {
    PLATFORM?: string
  }
}

function getGlobalRuntime() {
  if (typeof globalThis === 'undefined') {
    return undefined
  }
  return globalThis as MiniProgramGlobal
}

export function getMiniProgramGlobalObject(): MiniProgramGlobal | undefined {
  const globalRuntime = getGlobalRuntime()
  const compiledPlatform = (import.meta as ImportMetaWithEnv).env.PLATFORM

  // 优先命中编译期平台分支，便于构建阶段做 dead-code elimination。
  if (compiledPlatform === 'tt') {
    return globalRuntime?.tt as MiniProgramGlobal | undefined
  }
  if (compiledPlatform === 'alipay' || compiledPlatform === 'my') {
    return globalRuntime?.my as MiniProgramGlobal | undefined
  }
  if (compiledPlatform === 'weapp' || compiledPlatform === 'wx') {
    return globalRuntime?.wx as MiniProgramGlobal | undefined
  }

  if (typeof wx !== 'undefined') {
    return wx as unknown as MiniProgramGlobal
  }
  if (globalRuntime?.my) {
    return globalRuntime.my as MiniProgramGlobal
  }
  if (globalRuntime?.tt) {
    return globalRuntime.tt as MiniProgramGlobal
  }
  return undefined
}

export function getScopedSlotHostGlobalObject(): MiniProgramGlobal | undefined {
  return getMiniProgramGlobalObject() ?? getGlobalRuntime()
}
