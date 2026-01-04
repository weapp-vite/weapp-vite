import type { ParserOptions, ParserPlugin } from '@babel/parser'
import type * as t from '@babel/types'
import { createRequire } from 'node:module'
import { parse } from '@babel/parser'

export const BABEL_TS_MODULE_PLUGINS: ParserPlugin[] = [
  'typescript',
  'decorators-legacy',
  'classProperties',
  'classPrivateProperties',
  'classPrivateMethods',
  'jsx',
]

export const BABEL_TS_MODULE_PARSER_OPTIONS: ParserOptions = {
  sourceType: 'module',
  plugins: BABEL_TS_MODULE_PLUGINS,
}

const nodeRequire = createRequire(import.meta.url)

type BabelTraverse = typeof import('@babel/traverse').default
type BabelGenerate = typeof import('@babel/generator').default

let cachedTraverse: BabelTraverse | undefined
let cachedGenerate: BabelGenerate | undefined

type AnyFn = (...args: any[]) => any

function requireCallableDefault<T extends AnyFn>(id: string): T {
  const mod = nodeRequire(id) as unknown
  if (typeof mod === 'function') {
    return mod as T
  }
  if (
    mod
    && (typeof mod === 'object' || typeof mod === 'function')
    && 'default' in mod
  ) {
    const candidate = (mod as { default?: unknown }).default
    if (typeof candidate === 'function') {
      return candidate as T
    }
  }
  throw new TypeError(`Invalid module shape for ${id}`)
}

function getTraverse(): BabelTraverse {
  if (!cachedTraverse) {
    cachedTraverse = requireCallableDefault<BabelTraverse>('@babel/traverse')
  }
  return cachedTraverse
}

function getGenerate(): BabelGenerate {
  if (!cachedGenerate) {
    cachedGenerate = requireCallableDefault<BabelGenerate>('@babel/generator')
  }
  return cachedGenerate
}

type TraverseFn = (...args: Parameters<BabelTraverse>) => ReturnType<BabelTraverse>
type GenerateFn = (...args: Parameters<BabelGenerate>) => ReturnType<BabelGenerate>

export const traverse: TraverseFn = (...args) => {
  return getTraverse()(...args)
}

export const generate: GenerateFn = (...args) => {
  return getGenerate()(...args)
}

export { parse }

export function getVisitorKeys(): typeof import('@babel/types').VISITOR_KEYS {
  // avoid loading @babel/types until needed
  return (nodeRequire('@babel/types') as typeof import('@babel/types')).VISITOR_KEYS
}

export function parseJsLike(source: string): t.File {
  return parse(source, {
    sourceType: 'module',
    plugins: [
      ...BABEL_TS_MODULE_PLUGINS,
      'dynamicImport',
      'optionalChaining',
      'nullishCoalescingOperator',
    ],
  }) as unknown as t.File
}
