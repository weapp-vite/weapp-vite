import type { RuntimeRendererContext } from './types'
import { resolvePluginRequest } from '../../project/plugins'
import { resolveMiniProgramComponent } from '../componentResolution'
import { LEADING_SLASH_RE } from './shared'

interface ComponentRegistrySnapshot {
  configs: Map<string, Record<string, any>>
  usingComponents: Map<string, Map<string, Map<string, string>>>
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

function resolveOwnerComponents(context: RuntimeRendererContext, ownerJsonPath: string, ownerFilePath: string) {
  try {
    const parsed = readComponentConfig(context, ownerJsonPath)
    const usingComponents = parsed.usingComponents
    if (!usingComponents || typeof usingComponents !== 'object' || Array.isArray(usingComponents)) {
      return new Map<string, string>()
    }

    const resolved = new Map<string, string>()
    for (const [alias, rawPath] of Object.entries(usingComponents)) {
      if (typeof rawPath !== 'string') {
        continue
      }
      const pluginRequest = resolvePluginRequest(context.project.plugins, rawPath, 'publicComponent')
      const basePath = pluginRequest?.resourcePath ?? resolveMiniProgramComponent(
        ownerFilePath,
        rawPath,
        context.project.miniprogramRootPath,
        candidate => context.artifactSource.readText(candidate) !== undefined,
      )
      resolved.set(alias, basePath.replace(LEADING_SLASH_RE, ''))
    }
    return resolved
  }
  catch {
    return new Map<string, string>()
  }
}

export function resolveUsingComponents(context: RuntimeRendererContext, ownerJsonPath: string, ownerFilePath: string) {
  const snapshot = snapshots.get(context)
  const ownerFiles = snapshot?.usingComponents.get(ownerJsonPath)
  const cached = ownerFiles?.get(ownerFilePath)
  if (cached) {
    return cached
  }
  const resolved = resolveOwnerComponents(context, ownerJsonPath, ownerFilePath)
  if (snapshot) {
    const entries = ownerFiles ?? new Map<string, Map<string, string>>()
    entries.set(ownerFilePath, resolved)
    snapshot.usingComponents.set(ownerJsonPath, entries)
  }
  return resolved
}
