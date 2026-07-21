import type { LogicalEntryRequest, SidecarModuleKind } from './protocol'
import { createSidecarModuleId, createSidecarSourceSpecifier } from './protocol'

export interface LogicalEntryDependency {
  kind: SidecarModuleKind
  sourceId: string
}

export function createLogicalEntryModuleCode(
  entry: LogicalEntryRequest,
  dependencies: Iterable<LogicalEntryDependency>,
) {
  const source = JSON.stringify(entry.sourceId)
  const forwardsDefault = entry.type !== 'app' && /\.(?:vue|jsx|tsx)$/.test(entry.sourceId)
  const imports = [forwardsDefault
    ? `export { default } from ${source};`
    : `import ${source};`]
  const seen = new Set<string>()
  for (const dependency of dependencies) {
    const dependencyId = createSidecarModuleId(entry.sourceId, dependency.sourceId, dependency.kind)
    if (seen.has(dependencyId)) {
      continue
    }
    seen.add(dependencyId)
    imports.push(`import ${JSON.stringify(dependencyId)};`)
  }
  imports.push(`export * from ${source};`)
  return `${imports.join('\n')}\n`
}

export function createSidecarModuleCode(ownerId: string, sourceId: string, kind: SidecarModuleKind) {
  const sourceRequest = createSidecarSourceSpecifier(ownerId, sourceId, kind)
  return `import ${JSON.stringify(sourceRequest)};\nexport default ${JSON.stringify(sourceId)};\n`
}
