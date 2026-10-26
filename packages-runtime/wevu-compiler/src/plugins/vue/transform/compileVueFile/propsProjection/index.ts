import type { File } from '@weapp-vite/ast/babelTypes'
import type { ResolveSfcBlockSrcOptions } from '../../../../utils/vueSfc'
import * as t from '@weapp-vite/ast/babelTypes'
import { createAnalysisSourceReader, normalizeSourceId } from '../sourceReader'
import { createModuleFacts, createPropsModuleResolver } from './modules'
import { excludePropsObjectAliases, findCompiledOption } from './options'
import { createPropsShapeAnalyzer } from './shape'

interface PropsProjectionAnalysis {
  conflicts?: string[]
  dependencies: string[]
}

/** 可证明完整且稳定时只投影真实冲突；未知声明继续隔离全部候选绑定。 */
export async function resolveSetupPropConflicts(options: {
  script: string
  bindings: Record<string, unknown> | undefined
  getScriptAst: () => File
  filename: string
  source?: ResolveSfcBlockSrcOptions
}): Promise<PropsProjectionAnalysis> {
  const dependencies = new Set<string>()
  if (!/\bprops\b/.test(options.script)) {
    return { dependencies: [] }
  }
  let setupKeys = Object.entries(options.bindings ?? {})
    .filter(([, kind]) => typeof kind === 'string' && (kind.startsWith('setup-') || kind === 'literal-const'))
    .map(([key]) => key)
  if (!setupKeys.length) {
    return { dependencies: [] }
  }
  const root = createModuleFacts(normalizeSourceId(options.filename), options.getScriptAst())
  const exported = root.ast.program.body.find(statement => t.isExportDefaultDeclaration(statement))
  if (!exported || !t.isExportDefaultDeclaration(exported)) {
    return { conflicts: setupKeys, dependencies: [] }
  }
  const props = findCompiledOption(exported.declaration, 'props', root)
  const setup = findCompiledOption(exported.declaration, 'setup', root)
  const setupNode = setup.kind === 'value' ? setup.node : undefined
  setupKeys = excludePropsObjectAliases(setupKeys, setupNode)
  if (props.kind !== 'value') {
    return { conflicts: props.kind === 'unknown' ? setupKeys : undefined, dependencies: [] }
  }
  const reader = createAnalysisSourceReader({ source: options.source, trackLogicalPaths: true }, dependencies)
  const modules = createPropsModuleResolver(reader, root)
  const analyzer = createPropsShapeAnalyzer(modules, { props: props.node, setup: setupNode })
  const shape = await analyzer.analyze(props.node, root)
  dependencies.delete(root.id)
  return {
    conflicts: shape ? setupKeys.filter(key => shape.names.has(key)) : setupKeys,
    dependencies: [...dependencies],
  }
}
