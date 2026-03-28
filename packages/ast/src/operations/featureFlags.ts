import type { AstEngineName } from '../types'
import * as t from '@babel/types'
import { walk } from 'oxc-walker'
import { parseJsLike, traverse } from '../babel'
import { parseJsLikeWithEngine } from '../engine'

export interface FeatureFlagOptions<TFeature extends string> {
  astEngine?: AstEngineName
  moduleId: string
  hookToFeature: Record<string, TFeature>
}

export function mayContainFeatureFlagHints<TFeature extends string>(
  code: string,
  moduleId: string,
  hookToFeature: Record<string, TFeature>,
) {
  if (!code.includes(moduleId)) {
    return false
  }
  return Object.keys(hookToFeature).some(hookName => code.includes(hookName))
}

export function consumeNamedFeatureFlag<TFeature extends string>(
  enabled: Set<TFeature>,
  namedHookLocals: Map<string, TFeature>,
  name: string,
) {
  const matched = namedHookLocals.get(name)
  if (matched) {
    enabled.add(matched)
  }
}

export function consumeNamespaceFeatureFlag<TFeature extends string>(
  enabled: Set<TFeature>,
  namespaceLocals: Set<string>,
  hookToFeature: Record<string, TFeature>,
  namespace: string,
  hookName: string,
) {
  if (!namespaceLocals.has(namespace)) {
    return
  }
  const matched = hookToFeature[hookName]
  if (matched) {
    enabled.add(matched)
  }
}

export function registerNamedFeatureFlagLocal<TFeature extends string>(
  namedHookLocals: Map<string, TFeature>,
  hookToFeature: Record<string, TFeature>,
  importedName: string,
  localName: string,
) {
  const matched = hookToFeature[importedName]
  if (matched) {
    namedHookLocals.set(localName, matched)
  }
}

export function registerNamespaceFeatureFlagLocal(
  namespaceLocals: Set<string>,
  localName: string | undefined,
) {
  if (localName) {
    namespaceLocals.add(localName)
  }
}

export function collectFeatureFlagsWithBabel<TFeature extends string>(
  code: string,
  moduleId: string,
  hookToFeature: Record<string, TFeature>,
) {
  const ast = parseJsLike(code)
  const namedHookLocals = new Map<string, TFeature>()
  const namespaceLocals = new Set<string>()

  for (const stmt of ast.program.body) {
    if (!t.isImportDeclaration(stmt) || stmt.source.value !== moduleId) {
      continue
    }
    for (const specifier of stmt.specifiers) {
      if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported)) {
        registerNamedFeatureFlagLocal(namedHookLocals, hookToFeature, specifier.imported.name, specifier.local.name)
      }
      else if (t.isImportNamespaceSpecifier(specifier)) {
        registerNamespaceFeatureFlagLocal(namespaceLocals, specifier.local.name)
      }
    }
  }

  if (namedHookLocals.size === 0 && namespaceLocals.size === 0) {
    return new Set<TFeature>()
  }

  const enabled = new Set<TFeature>()

  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee
      if (t.isIdentifier(callee)) {
        consumeNamedFeatureFlag(enabled, namedHookLocals, callee.name)
        return
      }
      if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object)) {
        const property = callee.property
        if (t.isIdentifier(property)) {
          consumeNamespaceFeatureFlag(enabled, namespaceLocals, hookToFeature, callee.object.name, property.name)
        }
      }
    },
    OptionalCallExpression(path) {
      const callee = path.node.callee
      if (t.isIdentifier(callee)) {
        consumeNamedFeatureFlag(enabled, namedHookLocals, callee.name)
        return
      }
      if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object)) {
        const property = callee.property
        if (t.isIdentifier(property)) {
          consumeNamespaceFeatureFlag(enabled, namespaceLocals, hookToFeature, callee.object.name, property.name)
        }
      }
    },
  })

  return enabled
}

export function collectFeatureFlagsWithOxc<TFeature extends string>(
  code: string,
  moduleId: string,
  hookToFeature: Record<string, TFeature>,
) {
  const ast = parseJsLikeWithEngine(code, {
    engine: 'oxc',
    filename: 'inline.ts',
  }) as any
  const namedHookLocals = new Map<string, TFeature>()
  const namespaceLocals = new Set<string>()

  for (const statement of ast.body ?? []) {
    if (statement?.type !== 'ImportDeclaration' || statement.source?.value !== moduleId) {
      continue
    }
    for (const specifier of statement.specifiers ?? []) {
      if (specifier.type === 'ImportSpecifier' && specifier.imported?.type === 'Identifier') {
        if (specifier.local?.type === 'Identifier') {
          registerNamedFeatureFlagLocal(namedHookLocals, hookToFeature, specifier.imported.name, specifier.local.name)
        }
      }
      else if (specifier.type === 'ImportNamespaceSpecifier') {
        registerNamespaceFeatureFlagLocal(
          namespaceLocals,
          specifier.local?.type === 'Identifier' ? specifier.local.name : undefined,
        )
      }
    }
  }

  if (namedHookLocals.size === 0 && namespaceLocals.size === 0) {
    return new Set<TFeature>()
  }

  const enabled = new Set<TFeature>()

  walk(ast, {
    enter(node) {
      if (node.type !== 'CallExpression') {
        return
      }

      const callee = node.callee as any
      if (callee?.type === 'Identifier') {
        consumeNamedFeatureFlag(enabled, namedHookLocals, callee.name)
        return
      }

      if (
        callee?.type === 'MemberExpression'
        && callee.object?.type === 'Identifier'
        && callee.property?.type === 'Identifier'
      ) {
        consumeNamespaceFeatureFlag(enabled, namespaceLocals, hookToFeature, callee.object.name, callee.property.name)
      }
    },
  })

  return enabled
}

/**
 * 根据模块 ID 与 hook 映射表，从源码中收集启用的特性标识。
 */
export function collectFeatureFlagsFromCode<TFeature extends string>(
  code: string,
  options: FeatureFlagOptions<TFeature>,
): Set<TFeature> {
  if (!mayContainFeatureFlagHints(code, options.moduleId, options.hookToFeature)) {
    return new Set<TFeature>()
  }

  const engine = options.astEngine ?? 'babel'

  try {
    return engine === 'oxc'
      ? collectFeatureFlagsWithOxc(code, options.moduleId, options.hookToFeature)
      : collectFeatureFlagsWithBabel(code, options.moduleId, options.hookToFeature)
  }
  catch {
    return new Set<TFeature>()
  }
}
