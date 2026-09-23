export type MiniProgramGlobal = Record<string, any>

declare const tt: MiniProgramGlobal | undefined
declare const swan: MiniProgramGlobal | undefined
declare const jd: MiniProgramGlobal | undefined
declare const xhs: MiniProgramGlobal | undefined

export function getGlobalRuntime(): MiniProgramGlobal | undefined {
  return typeof globalThis === 'undefined' ? undefined : globalThis
}

export function getWechatGlobalObject(): MiniProgramGlobal | undefined {
  return getGlobalRuntime()?.wx ?? (typeof wx === 'undefined' ? undefined : wx as MiniProgramGlobal)
}

export function getAlipayGlobalObject(): MiniProgramGlobal | undefined {
  return getGlobalRuntime()?.my ?? (typeof my === 'undefined' ? undefined : my as MiniProgramGlobal)
}

export function getDouyinGlobalObject(): MiniProgramGlobal | undefined {
  return getGlobalRuntime()?.tt ?? (typeof tt === 'undefined' ? undefined : tt as MiniProgramGlobal)
}

export function getBaiduGlobalObject(): MiniProgramGlobal | undefined {
  return getGlobalRuntime()?.swan ?? (typeof swan === 'undefined' ? undefined : swan as MiniProgramGlobal)
}

export function getJdGlobalObject(): MiniProgramGlobal | undefined {
  return getGlobalRuntime()?.jd ?? (typeof jd === 'undefined' ? undefined : jd as MiniProgramGlobal)
}

export function getXhsGlobalObject(): MiniProgramGlobal | undefined {
  return getGlobalRuntime()?.xhs ?? (typeof xhs === 'undefined' ? undefined : xhs as MiniProgramGlobal)
}

export function getDouyinCompatibleGlobalObject(): MiniProgramGlobal | undefined {
  return getDouyinGlobalObject() ?? getWechatGlobalObject()
}
