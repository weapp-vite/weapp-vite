import type { RuntimeRendererContext } from './types'
import { resolvePluginRequest } from '../../project/plugins'
import { resolveMiniProgramComponent } from '../componentResolution'
import { LEADING_SLASH_RE } from './shared'

interface ComponentRegistrySnapshot {
  configs: Map<string, Record<string, any>>
  usingComponents: Map<string, Map<string, Map<string, string | undefined>>>
}

const snapshots = new WeakMap<RuntimeRendererContext, ComponentRegistrySnapshot>()

/** 同一次同步渲染的挂载重试共享配置与路径解析，下一轮重新读取产物。 */
export function withComponentRegistrySnapshot<T>(context: RuntimeRendererContext, render: () => T): T {
  if (snapshots.has(context)) {
    return render()
  }
  snapshots.set(context, { configs: new Map(), usingComponents: new Map() })
  try {
    return render()
  }
  finally {
    snapshots.delete(context)
  }
}

export function readComponentConfig(context: RuntimeRendererContext, jsonPath: string) {
  const configs = snapshots.get(context)?.configs
  if (configs?.has(jsonPath)) {
    return configs.get(jsonPath)!
  }
  let config: Record<string, any>
  try {
    const source = context.artifactSource.readText(jsonPath)
    config = source ? JSON.parse(source) as Record<string, any> : {}
  }
  catch {
    config = {}
  }
  configs?.set(jsonPath, config)
  return config
}

function resolveOwnerComponent(context: RuntimeRendererContext, ownerJsonPath: string, ownerFilePath: string, alias: string) {
  try {
    const parsed = readComponentConfig(context, ownerJsonPath)
    const usingComponents = parsed.usingComponents
    if (!usingComponents || typeof usingComponents !== 'object' || Array.isArray(usingComponents)) {
      return undefined
    }

    const rawPath = usingComponents[alias]
    if (typeof rawPath !== 'string') {
      return undefined
    }
    const pluginRequest = resolvePluginRequest(context.project.plugins, rawPath, 'publicComponent')
    const basePath = pluginRequest?.resourcePath ?? resolveMiniProgramComponent(
      ownerFilePath,
      rawPath,
      context.project.miniprogramRootPath,
      candidate => context.artifactSource.has(candidate),
    )
    return basePath.replace(LEADING_SLASH_RE, '')
  }
  catch {
    return undefined
  }
}

export function resolveUsingComponent(context: RuntimeRendererContext, ownerJsonPath: string, ownerFilePath: string, alias: string) {
  const snapshot = snapshots.get(context)
  const ownerFiles = snapshot?.usingComponents.get(ownerJsonPath)
  const cached = ownerFiles?.get(ownerFilePath)
  if (cached?.has(alias)) {
    return cached.get(alias)
  }
  const resolved = resolveOwnerComponent(context, ownerJsonPath, ownerFilePath, alias)
  if (snapshot) {
    const entries = ownerFiles ?? new Map<string, Map<string, string | undefined>>()
    const aliases = cached ?? new Map<string, string | undefined>()
    aliases.set(alias, resolved)
    entries.set(ownerFilePath, aliases)
    snapshot.usingComponents.set(ownerJsonPath, entries)
  }
  return resolved
}
