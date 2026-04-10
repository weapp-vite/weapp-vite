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

export function toRelativeRuntimeNpmImport(fileName: string, root: string, importee: string) {
  const normalized = normalizeWeappLocalNpmImport(importee)
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
    astEngine?: 'babel' | 'oxc'
  },
) {
  if (!mayContainStaticRequireLiteral(chunk.code, { engine: options?.astEngine })) {
    return
  }

  try {
    const ast = parseJsLike(chunk.code)
    let mutated = false

    traverse(ast as any, {
      CallExpression(path: any) {
        const callee = path.node?.callee
        if (!callee || callee.type !== 'Identifier' || callee.name !== 'require') {
          return
        }
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

        const nextValue = toRelativeRuntimeNpmImport(chunk.fileName, root, currentValue)
        if (nextValue === currentValue) {
          return
        }

        setRequireImportLiteral(firstArg, nextValue)
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
) {
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'asset' || typeof output.fileName !== 'string' || !output.fileName.endsWith('.json')) {
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
        parsed.usingComponents[componentName] = toRelativeRuntimeNpmImport(output.fileName, root, importee)
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
