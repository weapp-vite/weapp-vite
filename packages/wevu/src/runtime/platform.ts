type MiniProgramGlobal = Record<string, any>

function getGlobalRuntime() {
  if (typeof globalThis === 'undefined') {
    return undefined
  }
  return globalThis as MiniProgramGlobal
}

export function getMiniProgramGlobalObject(): MiniProgramGlobal | undefined {
  const globalRuntime = getGlobalRuntime()

  // 优先命中编译期平台分支，便于构建阶段做 dead-code elimination。
  if (import.meta.env.PLATFORM === 'tt') {
    return globalRuntime?.tt as MiniProgramGlobal | undefined
  }
  if (import.meta.env.PLATFORM === 'alipay' || import.meta.env.PLATFORM === 'my') {
    return globalRuntime?.my as MiniProgramGlobal | undefined
  }
  if (import.meta.env.PLATFORM === 'weapp' || import.meta.env.PLATFORM === 'wx') {
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
