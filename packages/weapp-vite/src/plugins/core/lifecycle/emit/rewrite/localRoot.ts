import type { OutputBundle, OutputChunk } from 'rolldown'
import path from 'pathe'
import { mayContainStaticRequireLiteral } from '../../../../../ast'
import { toPosixPath } from '../../../../../utils'
import { generate, parseJsLike, traverse } from '../../../../../utils/babel'
import {
  getRequireImportLiteral,
  normalizeWeappLocalNpmImport,
  setRequireImportLiteral,
} from './literals'
import { matchesSubPackageDependency } from './platform'

function isRelativeMiniprogramNpmImport(importee: string) {
  return importee === 'miniprogram_npm'
    || importee.startsWith('./miniprogram_npm/')
    || importee.startsWith('../miniprogram_npm/')
    || importee.includes('/miniprogram_npm/')
}

function isToEsmCall(node: any) {
  const callee = node?.callee
  if (!callee) {
    return false
  }

  if (callee.type === 'Identifier') {
    return callee.name === '__toESM'
  }

  return callee.type === 'MemberExpression'
    && !callee.computed
    && callee.property?.type === 'Identifier'
    && callee.property.name === '__toESM'
}

function isNumericOneLiteral(node: any) {
  return (node?.type === 'NumericLiteral' || node?.type === 'Literal') && node.value === 1
}

function getLocalizedBindingNameFromExpression(node: any, localizedRequireBindings: Set<string>) {
  if (!node) {
    return
  }

  if (node.type === 'Identifier' && localizedRequireBindings.has(node.name)) {
    return node.name
  }

  if (
    node.type === 'CallExpression'
    && node.callee?.type === 'Identifier'
    && node.callee.name === 'require'
  ) {
    const importee = getRequireImportLiteral(node.arguments?.[0])
    if (typeof importee === 'string' && isRelativeMiniprogramNpmImport(importee)) {
      return importee
    }
  }
}

export function toRelativeRuntimeNpmImport(fileName: string, root: string, importee: string, basedir?: string) {
  const normalized = normalizeWeappLocalNpmImport(importee, basedir)
  const target = root
    ? `${root}/miniprogram_npm/${normalized}`
    : `miniprogram_npm/${normalized}`
  const relative = toPosixPath(path.relative(path.dirname(fileName), target))
  return relative.startsWith('.') ? relative : `./${relative}`
}

export function rewriteChunkNpmImportsToLocalRoot(
  chunk: OutputChunk,
  root: string,
  dependencyPatterns: (string | RegExp)[] | undefined,
  dependencies: Record<string, string> | undefined,
  options?: {
    basedir?: string
    astEngine?: 'babel' | 'oxc'
  },
) {
  if (!mayContainStaticRequireLiteral(chunk.code, { engine: options?.astEngine })) {
    return
  }

  try {
    const ast = parseJsLike(chunk.code)
    let mutated = false
    const localizedRequireBindings = new Set<string>()

    traverse(ast as any, {
      VariableDeclarator(path: any) {
        const id = path.node?.id
        const init = path.node?.init
        if (!id || id.type !== 'Identifier') {
          return
        }
        if (!init || (init.type !== 'CallExpression' && init.type !== 'Identifier')) {
          return
        }

        if (path.scope?.hasBinding?.('require')) {
          return
        }

        if (getLocalizedBindingNameFromExpression(init, localizedRequireBindings)) {
          localizedRequireBindings.add(id.name)
        }
      },

      AssignmentExpression(path: any) {
        const left = path.node?.left
        const right = path.node?.right
        if (!left || left.type !== 'Identifier') {
          return
        }
        if (!right || (right.type !== 'CallExpression' && right.type !== 'Identifier')) {
          return
        }
        if (path.scope?.hasBinding?.('require')) {
          return
        }

        if (getLocalizedBindingNameFromExpression(right, localizedRequireBindings)) {
          localizedRequireBindings.add(left.name)
        }
      },

      CallExpression(path: any) {
        const callee = path.node?.callee
        if (callee?.type === 'Identifier' && callee.name === 'require') {
          if (path.scope?.hasBinding?.('require')) {
            return
          }

          const args = path.node.arguments
          if (!Array.isArray(args) || args.length === 0) {
            return
          }

          const firstArg = args[0]
          const currentValue = getRequireImportLiteral(firstArg)
          if (typeof currentValue !== 'string' || !matchesSubPackageDependency(dependencyPatterns, currentValue, dependencies)) {
            return
          }

          const nextValue = toRelativeRuntimeNpmImport(chunk.fileName, root, currentValue, options?.basedir)
          if (nextValue === currentValue) {
            return
          }

          setRequireImportLiteral(firstArg, nextValue)
          if (isRelativeMiniprogramNpmImport(nextValue) && path.parentPath?.node?.type === 'VariableDeclarator' && path.parentPath.node.id?.type === 'Identifier') {
            localizedRequireBindings.add(path.parentPath.node.id.name)
          }
          if (isRelativeMiniprogramNpmImport(nextValue) && path.parentPath?.node?.type === 'AssignmentExpression' && path.parentPath.node.left?.type === 'Identifier') {
            localizedRequireBindings.add(path.parentPath.node.left.name)
          }
          mutated = true
          return
        }

        if (!isToEsmCall(path.node)) {
          return
        }

        const args = path.node.arguments
        if (!Array.isArray(args) || args.length < 2 || !isNumericOneLiteral(args[1])) {
          return
        }

        const firstArg = args[0]
        const shouldDropNodeInterop = Boolean(getLocalizedBindingNameFromExpression(firstArg, localizedRequireBindings))

        if (!shouldDropNodeInterop) {
          return
        }

        path.node.arguments = [firstArg]
        mutated = true
      },
    })

    if (mutated) {
      chunk.code = generate(ast as any).code
    }
  }
  catch {
  }
}

export function rewriteJsonNpmImportsToLocalRoot(
  bundle: OutputBundle,
  root: string,
  dependencyPatterns: (string | RegExp)[] | undefined,
  dependencies: Record<string, string> | undefined,
  basedir?: string,
  options?: {
    excludeRoots?: string[]
  },
) {
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'asset' || typeof output.fileName !== 'string' || !output.fileName.endsWith('.json')) {
      continue
    }
    if (options?.excludeRoots?.some(excludeRoot => output.fileName === excludeRoot || output.fileName.startsWith(`${excludeRoot}/`))) {
      continue
    }
    if (root && (output.fileName === `${root}.json` || !output.fileName.startsWith(`${root}/`))) {
      continue
    }

    const source = typeof output.source === 'string' ? output.source : output.source?.toString()
    if (!source) {
      continue
    }

    try {
      const parsed = JSON.parse(source)
      if (!parsed || typeof parsed !== 'object' || !parsed.usingComponents || typeof parsed.usingComponents !== 'object' || Array.isArray(parsed.usingComponents)) {
        continue
      }

      let mutated = false
      for (const [componentName, importee] of Object.entries(parsed.usingComponents as Record<string, string>)) {
        if (typeof importee !== 'string' || !matchesSubPackageDependency(dependencyPatterns, importee, dependencies)) {
          continue
        }
        parsed.usingComponents[componentName] = toRelativeRuntimeNpmImport(output.fileName, root, importee, basedir)
        mutated = true
      }

      if (mutated) {
        output.source = `${JSON.stringify(parsed, null, 2)}\n`
      }
    }
    catch {
    }
  }
}
