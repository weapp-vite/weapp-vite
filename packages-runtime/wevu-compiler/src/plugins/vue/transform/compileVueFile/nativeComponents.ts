import type { NativeCompilerScriptAnalysis } from '@weapp-vite/ast'

/** 只消费 native 已证明的静态注册；复杂 Options API 继续由原 Babel 语义处理。 */
export function collectNativeComponentRegistrations(
  analysis: NativeCompilerScriptAnalysis | undefined,
  templateNames: Set<string>,
  templateTags: Map<string, Set<string>> | undefined,
) {
  if (!analysis?.registeredComponents) {
    return undefined
  }
  const pending: Array<{
    localName: string
    importSource: string
    importedName?: string
    kind: 'default' | 'named'
    templateTags: string[]
  }> = []
  const imports = new Map(analysis.imports.filter(item => !item.typeOnly && item.kind !== 'namespace').map(item => [item.local, item]))
  for (const registration of analysis.registeredComponents) {
    const imported = imports.get(registration.local)
    if (!registration.name || !imported || imported.kind === 'namespace' || !templateNames.has(registration.name)) {
      continue
    }
    pending.push({
      localName: registration.local,
      importSource: imported.source,
      importedName: imported.imported,
      kind: imported.kind,
      templateTags: [...(templateTags?.get(registration.name) ?? [registration.name])],
    })
  }
  return pending
}
