import type { LogicalEntryRequest, SidecarModuleKind } from './protocol'
import { WEAPP_VITE_RUNTIME_VIRTUAL_ID } from '@weapp-core/constants'
import { withRealpathScope } from '../utils/realpathScope'
import { createSidecarModuleId, createSidecarSourceSpecifier } from './protocol'

export interface LogicalEntryDependency {
  kind: SidecarModuleKind
  sourceId: string
}

export function createLogicalEntryModuleCode(
  entry: LogicalEntryRequest,
  dependencies: Iterable<LogicalEntryDependency>,
  options: { includeStatefulHmrAccept?: boolean } = {},
) {
  const source = JSON.stringify(entry.sourceId)
  const isVueLikeEntry = /\.(?:vue|jsx|tsx)$/.test(entry.sourceId)
  const delegatesComponentRegistration = entry.type === 'component' && isVueLikeEntry
  const forwardsDefault = entry.type !== 'app' && isVueLikeEntry
  const imports = delegatesComponentRegistration
    ? [
        `import { createWevuComponent as __weappViteCreateWevuComponent } from ${JSON.stringify(WEAPP_VITE_RUNTIME_VIRTUAL_ID)};`,
        `import __weappViteComponentOptions from ${source};`,
        `__weappViteCreateWevuComponent(__weappViteComponentOptions);`,
        `export default __weappViteComponentOptions;`,
      ]
    : [forwardsDefault
        ? `export { default } from ${source};`
        : `import ${source};`]
  const dependencyIds = new Set<string>()
  withRealpathScope(() => {
    for (const dependency of dependencies) {
      dependencyIds.add(createSidecarModuleId(entry.sourceId, dependency.sourceId, dependency.kind))
    }
  })
  // 依赖集合不携带执行顺序；首次发现与图恢复可能枚举不同顺序。
  // 保持包装模块内容稳定，避免脚本更新额外失效不执行注册的逻辑入口。
  for (const dependencyId of [...dependencyIds].sort()) {
    imports.push(`import ${JSON.stringify(dependencyId)};`)
  }
  imports.push(`export * from ${source};`)
  if (options.includeStatefulHmrAccept && entry.type !== 'component') {
    imports.push('if (import.meta.hot) import.meta.hot.accept();')
  }
  return `${imports.join('\n')}\n`
}

export function createSidecarModuleCode(ownerId: string, sourceId: string, kind: SidecarModuleKind) {
  // 图依赖只负责失效传播；真实入口和 SFC 样式请求拥有 CSS，不能从依赖边再次内联。
  const sourceRequest = createSidecarSourceSpecifier(ownerId, sourceId, kind, kind === 'style')
  return `import ${JSON.stringify(sourceRequest)};\nexport default ${JSON.stringify(sourceId)};\n`
}
