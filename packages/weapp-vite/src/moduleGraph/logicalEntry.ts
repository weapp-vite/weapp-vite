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
  const isVueLikeEntry = /\.(?:vue|jsx|tsx)$/.test(entry.sourceId)
  const delegatesComponentRegistration = entry.type === 'component' && isVueLikeEntry
  const forwardsDefault = entry.type !== 'app' && isVueLikeEntry
  const imports = delegatesComponentRegistration
    ? [
        `import { createWevuComponent as __weappViteCreateWevuComponent } from "wevu";`,
        `import __weappViteComponentOptions from ${source};`,
        `__weappViteCreateWevuComponent(__weappViteComponentOptions);`,
        `export default __weappViteComponentOptions;`,
      ]
    : [forwardsDefault
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
