import type {
  WevuBindingDependencyV1,
  WevuBindingKind,
  WevuBindingManifestV1,
  WevuBindingScopeV1,
  WevuBindingUpdateMode,
} from '../../../../types/bindingManifest'
import type { SourceSpan } from '../../../../types/diagnostics'
import type { TransformContext } from './types'
import {
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_SLOT_OWNER_ID_PROP,
  WEVU_SLOT_OWNER_KEY,
  WEVU_SLOT_OWNER_PROXY_KEY,
  WEVU_SLOT_PROPS_DATA_KEY,
  WEVU_SLOT_SCOPE_KEY,
} from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { traverse } from '../../../../utils/babel'
import { INLINE_GLOBALS } from './expression/inlineShared'
import { parseBabelExpressionFile } from './expression/parse'
import { normalizeWxmlExpressionWithContext } from './expression/scopedSlot'

interface BindingDependency {
  root: string
  path?: string
  mode: Exclude<WevuBindingUpdateMode, 'snapshot-fallback'>
}

interface RecordBindingOptions {
  kind: WevuBindingKind
  expression: string
  outputPath?: string
  sourceFile?: string
  sourceLocation?: SourceSpan
  scopes?: WevuBindingScopeV1[]
  scopeDependencies?: Array<{
    expression: string
    locals: string[]
  }>
}

const INTERNAL_GLOBALS: Record<string, true> = {
  undefined: true,
  Infinity: true,
  NaN: true,
  arguments: true,
}

const completeBindingManifests = new WeakSet<WevuBindingManifestV1>()

function cloneSourceSpan(location: SourceSpan | undefined): SourceSpan | undefined {
  if (!location) {
    return undefined
  }
  return {
    start: { ...location.start },
    end: { ...location.end },
  }
}

function getStaticPropertyName(node: t.MemberExpression | t.OptionalMemberExpression): string | null {
  if (!node.computed && t.isIdentifier(node.property)) {
    return node.property.name
  }
  if (node.computed && (t.isStringLiteral(node.property) || t.isNumericLiteral(node.property))) {
    return String(node.property.value)
  }
  return null
}

function resolveMemberDependency(node: t.Expression): BindingDependency | null {
  const segments: string[] = []
  let current = node
  let dynamic = false
  while (t.isMemberExpression(current) || t.isOptionalMemberExpression(current)) {
    const property = getStaticPropertyName(current)
    if (property === null) {
      dynamic = true
    }
    else {
      segments.unshift(property)
    }
    if (!t.isExpression(current.object)) {
      return null
    }
    current = current.object
  }
  if (!t.isIdentifier(current) || INLINE_GLOBALS.has(current.name) || INTERNAL_GLOBALS[current.name]) {
    return null
  }
  if (dynamic) {
    return { root: current.name, mode: 'top-level' }
  }
  const path = [current.name, ...segments].join('.')
  return { root: current.name, path, mode: 'exact-path' }
}

function collectDependencies(
  expression: string,
  context?: TransformContext,
  additionalLocals?: Iterable<string>,
): { dependencies: BindingDependency[], snapshotFallback: boolean } | null {
  const normalized = context
    ? normalizeWxmlExpressionWithContext(expression, context)
    : expression
  const parsed = parseBabelExpressionFile(normalized)
  if (!parsed) {
    return null
  }

  const localNames = new Set<string>()
  for (const scope of context?.scopeStack ?? []) {
    for (const name of scope) {
      localNames.add(name)
    }
  }
  for (const name of additionalLocals ?? []) {
    localNames.add(name)
  }
  const dependencies = new Map<string, BindingDependency>()
  let snapshotFallback = false
  const addDependency = (dependency: BindingDependency) => {
    if (localNames.has(dependency.root) || INLINE_GLOBALS.has(dependency.root) || INTERNAL_GLOBALS[dependency.root]) {
      return
    }
    const key = `${dependency.root}:${dependency.path ?? ''}:${dependency.mode}`
    dependencies.set(key, dependency)
  }

  traverse(parsed.ast, {
    Identifier(path) {
      if (!path.isReferencedIdentifier() || path.scope.hasBinding(path.node.name)) {
        return
      }
      const parent = path.parentPath
      if (
        (parent.isMemberExpression() || parent.isOptionalMemberExpression())
        && parent.node.object === path.node
      ) {
        let outer = parent
        while (
          (outer.parentPath.isMemberExpression() || outer.parentPath.isOptionalMemberExpression())
          && outer.parentPath.node.object === outer.node
        ) {
          outer = outer.parentPath as typeof parent
        }
        const dependency = resolveMemberDependency(outer.node as t.Expression)
        if (dependency) {
          addDependency(dependency)
        }
        return
      }
      if (
        (parent.isMemberExpression() || parent.isOptionalMemberExpression())
        && parent.node.property === path.node
        && !parent.node.computed
      ) {
        return
      }
      addDependency({ root: path.node.name, path: path.node.name, mode: 'exact-path' })
    },
    CallExpression(path) {
      if (
        t.isIdentifier(path.node.callee)
        && context?.templateSafeCallNames.has(path.node.callee.name)
      ) {
        return
      }
      snapshotFallback = true
    },
    OptionalCallExpression() {
      snapshotFallback = true
    },
    NewExpression() {
      snapshotFallback = true
    },
    Function() {
      snapshotFallback = true
    },
    SpreadElement() {
      snapshotFallback = true
    },
  })

  if (localNames.size && context) {
    for (const forInfo of context.forStack) {
      const listExpression = forInfo.rawListExp ?? forInfo.listExp
      if (!listExpression) {
        continue
      }
      const outerAnalysis = collectDependencies(listExpression, {
        ...context,
        scopeStack: [],
        forStack: [],
      })
      for (const dependency of outerAnalysis?.dependencies ?? []) {
        addDependency(dependency)
      }
      snapshotFallback ||= outerAnalysis?.snapshotFallback ?? false
    }
  }

  return {
    dependencies: [...dependencies.values()],
    snapshotFallback,
  }
}

function resolveBindingDependencies(
  dependencies: BindingDependency[],
  snapshotFallback: boolean,
): WevuBindingDependencyV1[] {
  return dependencies.map(dependency => ({
    root: dependency.root,
    ...(dependency.path ? { path: dependency.path } : {}),
    updateMode: snapshotFallback ? 'snapshot-fallback' : dependency.mode,
  }))
}

function resolveBindingUpdateMode(dependencies: WevuBindingDependencyV1[]): WevuBindingUpdateMode {
  if (dependencies.some(dependency => dependency.updateMode === 'snapshot-fallback')) {
    return 'snapshot-fallback'
  }
  if (dependencies.some(dependency => dependency.updateMode === 'top-level')) {
    return 'top-level'
  }
  return 'exact-path'
}

function resolveBindingScopes(
  context: TransformContext | undefined,
  dependencies: BindingDependency[],
  explicitScopes?: WevuBindingScopeV1[],
): WevuBindingScopeV1[] {
  if (explicitScopes) {
    return explicitScopes.map(scope => ({
      ...scope,
      ...(scope.locals ? { locals: [...scope.locals] } : {}),
    }))
  }

  const scopes: WevuBindingScopeV1[] = [{ kind: 'root', depth: 0 }]
  let forDepth = 1
  if (context?.rewriteScopedSlot) {
    const roots = new Set(dependencies.map(dependency => dependency.root))
    if (roots.has(WEVU_SLOT_OWNER_KEY)
      || roots.has(WEVU_SLOT_OWNER_PROXY_KEY)
      || roots.has(WEVU_SLOT_OWNER_ID_KEY)
      || roots.has(WEVU_SLOT_OWNER_ID_PROP)
      || roots.has(WEVU_SLOT_SCOPE_KEY)) {
      scopes.push({ kind: 'slot-owner', depth: 1 })
      forDepth = 2
    }
    if (roots.has(WEVU_SLOT_PROPS_DATA_KEY)) {
      scopes.push({ kind: 'slot-props', depth: 1 })
      forDepth = 2
    }
  }

  for (const [index, forInfo] of (context?.forStack ?? []).entries()) {
    const locals = [
      forInfo.item,
      forInfo.index,
      forInfo.key,
      ...Object.keys(forInfo.itemAliases ?? {}),
    ].filter(Boolean) as string[]
    scopes.push({
      kind: 'for',
      depth: forDepth + index,
      ...(locals.length ? { locals: [...new Set(locals)] } : {}),
    })
  }
  return scopes
}

function mergeBindingScopeDependencies(
  analysis: NonNullable<ReturnType<typeof collectDependencies>>,
  scopeDependencies: Array<{
    expression: string
    locals: string[]
  }>,
) {
  const dependencies = new Map<string, BindingDependency>()
  const addDependency = (dependency: BindingDependency) => {
    const key = `${dependency.root}:${dependency.path ?? ''}:${dependency.mode}`
    dependencies.set(key, dependency)
  }
  analysis.dependencies.forEach(addDependency)
  let snapshotFallback = analysis.snapshotFallback
  for (const scope of scopeDependencies) {
    const scopeAnalysis = collectDependencies(scope.expression, undefined, scope.locals)
    if (!scopeAnalysis) {
      snapshotFallback = true
      continue
    }
    scopeAnalysis.dependencies.forEach(addDependency)
    snapshotFallback ||= scopeAnalysis.snapshotFallback
  }
  return {
    dependencies: [...dependencies.values()],
    snapshotFallback,
  }
}

function recordBindingManifestExpression(
  manifest: WevuBindingManifestV1,
  options: RecordBindingOptions,
  context?: TransformContext,
  additionalLocals?: Iterable<string>,
) {
  const initialAnalysis = collectDependencies(options.expression, context, additionalLocals)
  const analysis = initialAnalysis && options.scopeDependencies?.length
    ? mergeBindingScopeDependencies(initialAnalysis, options.scopeDependencies)
    : initialAnalysis
  const sourceLocation = cloneSourceSpan(options.sourceLocation)
  if (!analysis) {
    manifest.bindings.push({
      id: `b${manifest.bindings.length}`,
      kind: options.kind,
      outputPath: options.outputPath ?? '*',
      ...(options.sourceFile && options.sourceFile !== manifest.sourceFile ? { sourceFile: options.sourceFile } : {}),
      sourceRoots: [],
      dependencies: [],
      scopes: resolveBindingScopes(context, [], options.scopes),
      updateMode: 'snapshot-fallback',
      sourceLocation,
    })
    return
  }
  const { dependencies, snapshotFallback } = analysis
  if (options.outputPath) {
    const sourceRoots = [...new Set(dependencies.map(dependency => dependency.root))]
    const sourcePaths = dependencies.flatMap(dependency => dependency.path ? [dependency.path] : [])
    const bindingDependencies = resolveBindingDependencies(dependencies, snapshotFallback)
    manifest.bindings.push({
      id: `b${manifest.bindings.length}`,
      kind: options.kind,
      outputPath: options.outputPath,
      ...(options.sourceFile && options.sourceFile !== manifest.sourceFile ? { sourceFile: options.sourceFile } : {}),
      sourceRoots,
      sourcePaths: sourcePaths.length ? [...new Set(sourcePaths)] : undefined,
      dependencies: bindingDependencies,
      scopes: resolveBindingScopes(context, dependencies, options.scopes),
      updateMode: resolveBindingUpdateMode(bindingDependencies),
      sourceLocation,
    })
    return
  }
  for (const dependency of dependencies) {
    const [bindingDependency] = resolveBindingDependencies([dependency], snapshotFallback)
    manifest.bindings.push({
      id: `b${manifest.bindings.length}`,
      kind: options.kind,
      outputPath: dependency.mode === 'exact-path' ? dependency.path! : dependency.root,
      ...(options.sourceFile && options.sourceFile !== manifest.sourceFile ? { sourceFile: options.sourceFile } : {}),
      sourceRoots: [dependency.root],
      sourcePaths: dependency.path ? [dependency.path] : undefined,
      dependencies: [bindingDependency],
      scopes: resolveBindingScopes(context, [dependency], options.scopes),
      updateMode: bindingDependency.updateMode,
      sourceLocation,
    })
  }
}

/**
 * 为一次模板编译创建空的版本化绑定清单。
 */
export function createBindingManifest(sourceFile: string): WevuBindingManifestV1 {
  const manifest: WevuBindingManifestV1 = {
    version: 1,
    sourceFile,
    bindings: [],
    features: {},
  }
  completeBindingManifests.add(manifest)
  return manifest
}

/**
 * 判断清单是否由当前编译流程完整采集。
 */
export function isBindingManifestComplete(manifest: WevuBindingManifestV1) {
  return completeBindingManifests.has(manifest)
}

/**
 * 标记清单在降级输出中不再具备自动裁剪权威性。
 */
export function markBindingManifestIncomplete(manifest: WevuBindingManifestV1) {
  completeBindingManifests.delete(manifest)
}

/**
 * 在模板遍历期间记录一个输出绑定。
 */
export function recordBindingExpression(context: TransformContext, options: RecordBindingOptions) {
  recordBindingManifestExpression(context.bindingManifest, options, context)
}

/**
 * 为编译器合成的模板片段记录绑定。
 */
export function recordSyntheticBindingExpression(
  manifest: WevuBindingManifestV1,
  options: RecordBindingOptions,
  localNames?: Iterable<string>,
) {
  recordBindingManifestExpression(manifest, options, undefined, localNames)
}
