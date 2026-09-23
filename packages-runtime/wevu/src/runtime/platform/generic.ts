import type { MiniProgramRuntimeCapabilities } from '@weapp-core/shared/platforms/runtime'
import type { MiniProgramGlobal } from './globals'

import {
  getMiniProgramPlatformByRuntimeGlobalKey,
  getMiniProgramRuntimeCapabilities,
  getMiniProgramRuntimeGlobalKey,
  getMiniProgramRuntimeGlobalKeys,
  resolveMiniProgramPlatform,
} from '@weapp-core/shared/platforms/runtime'
import { getAlipayGlobalObject, getBaiduGlobalObject, getDouyinGlobalObject, getJdGlobalObject, getWechatGlobalObject, getXhsGlobalObject } from './globals'

type ImportMetaWithEnv = ImportMeta & {
  env?: {
    PLATFORM?: string
  }
}
function resolveRuntimeGlobalObject(globalKey: string): MiniProgramGlobal | undefined {
  switch (globalKey) {
    case 'wx': return getWechatGlobalObject()
    case 'my': return getAlipayGlobalObject()
    case 'tt': return getDouyinGlobalObject()
    case 'swan': return getBaiduGlobalObject()
    case 'jd': return getJdGlobalObject()
    case 'xhs': return getXhsGlobalObject()
  }
  return undefined
}

export function resolveDetectedMiniProgramPlatform() {
  const compiledPlatform = (import.meta as ImportMetaWithEnv).env?.PLATFORM

  // 兼容未声明目标或使用平台别名的独立构建。
  const resolvedCompiledPlatform = resolveMiniProgramPlatform(compiledPlatform)
  if (resolvedCompiledPlatform) {
    return resolvedCompiledPlatform
  }

  for (const globalKey of getMiniProgramRuntimeGlobalKeys()) {
    if (resolveRuntimeGlobalObject(globalKey)) {
      return getMiniProgramPlatformByRuntimeGlobalKey(globalKey)
    }
  }

  return undefined
}

export function getDetectedMiniProgramRuntimeCapabilities(): MiniProgramRuntimeCapabilities {
  return getMiniProgramRuntimeCapabilities(resolveDetectedMiniProgramPlatform())
}

export function getMiniProgramGlobalObject(platformInput?: string): MiniProgramGlobal | undefined {
  const compiledPlatform = platformInput ?? (import.meta as ImportMetaWithEnv).env?.PLATFORM
  const resolvedCompiledPlatform = resolveMiniProgramPlatform(compiledPlatform)

  if (resolvedCompiledPlatform) {
    const globalKey = getMiniProgramRuntimeGlobalKey(resolvedCompiledPlatform)
    return resolveRuntimeGlobalObject(globalKey)
      ?? (resolvedCompiledPlatform === 'tt' ? resolveRuntimeGlobalObject('wx') : undefined)
  }

  for (const globalKey of getMiniProgramRuntimeGlobalKeys()) {
    const candidate = resolveRuntimeGlobalObject(globalKey)
    if (candidate) {
      return candidate as MiniProgramGlobal
    }
  }
  return undefined
}
