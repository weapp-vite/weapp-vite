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

function mayContainFeatureFlagHints<TFeature extends string>(
  code: string,
  moduleId: string,
  hookToFeature: Record<string, TFeature>,
) {
  if (!code.includes(moduleId)) {
    return false
  }
  return Object.keys(hookToFeature).some(hookName => code.includes(hookName))
}

function collectWithBabel<TFeature extends string>(
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
        const matched = hookToFeature[specifier.imported.name]
        if (matched) {
          namedHookLocals.set(specifier.local.name, matched)
        }
      }
      else if (t.isImportNamespaceSpecifier(specifier)) {
        namespaceLocals.add(specifier.local.name)
      }
    }
  }

  if (namedHookLocals.size === 0 && namespaceLocals.size === 0) {
    return new Set<TFeature>()
  }

  const enabled = new Set<TFeature>()

  function consumeHookCallByName(name: string) {
    const matched = namedHookLocals.get(name)
    if (matched) {
      enabled.add(matched)
    }
  }

  function consumeNamespaceHookCall(namespace: string, hookName: string) {
    if (!namespaceLocals.has(namespace)) {
      return
    }
    const matched = hookToFeature[hookName]
    if (matched) {
      enabled.add(matched)
    }
  }

  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee
      if (t.isIdentifier(callee)) {
        consumeHookCallByName(callee.name)
        return
      }
      if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object)) {
        const property = callee.property
        if (t.isIdentifier(property)) {
          consumeNamespaceHookCall(callee.object.name, property.name)
        }
      }
    },
    OptionalCallExpression(path) {
      const callee = path.node.callee
      if (t.isIdentifier(callee)) {
        consumeHookCallByName(callee.name)
        return
      }
      if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object)) {
        const property = callee.property
        if (t.isIdentifier(property)) {
          consumeNamespaceHookCall(callee.object.name, property.name)
        }
      }
    },
  })

  return enabled
}

function collectWithOxc<TFeature extends string>(
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
        const matched = hookToFeature[specifier.imported.name]
        if (matched && specifier.local?.type === 'Identifier') {
          namedHookLocals.set(specifier.local.name, matched)
        }
      }
      else if (specifier.type === 'ImportNamespaceSpecifier' && specifier.local?.type === 'Identifier') {
        namespaceLocals.add(specifier.local.name)
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
        const matched = namedHookLocals.get(callee.name)
        if (matched) {
          enabled.add(matched)
        }
        return
      }

      if (
        callee?.type === 'MemberExpression'
        && callee.object?.type === 'Identifier'
        && callee.property?.type === 'Identifier'
        && namespaceLocals.has(callee.object.name)
      ) {
        const matched = hookToFeature[callee.property.name]
        if (matched) {
          enabled.add(matched)
        }
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
      ? collectWithOxc(code, options.moduleId, options.hookToFeature)
      : collectWithBabel(code, options.moduleId, options.hookToFeature)
  }
  catch {
    return new Set<TFeature>()
  }
}
