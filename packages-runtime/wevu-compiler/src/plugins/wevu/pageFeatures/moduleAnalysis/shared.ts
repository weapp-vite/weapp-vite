import type { AstEngineName } from '../../../../ast/types'
import type { FunctionLike, ModuleAnalysis } from './types'
import * as t from '@weapp-vite/ast/babelTypes'
import { LRUCache } from 'lru-cache'

export function createEmptyModuleAnalysis(id: string, engine: AstEngineName): ModuleAnalysis {
  return {
    id,
    engine,
    wevuNamedHookLocals: new Map(),
    wevuNamespaceLocals: new Set(),
    importedBindings: new Map(),
    localFunctions: new Map(),
    exports: new Map(),
  }
}

export const externalModuleAnalysisCache = new LRUCache<
  string,
  { code: string, analysis: ModuleAnalysis }
>({
  max: 256,
})

export const moduleAnalysisCache = new LRUCache<
  string,
  { code: string, analysis: ModuleAnalysis }
>({
  max: 512,
})

export function createExternalModuleAnalysisCacheKey(moduleId: string, astEngine?: AstEngineName) {
  return `${astEngine ?? 'babel'}::${moduleId}`
}

export function createModuleAnalysisCacheKey(moduleId: string, astEngine?: AstEngineName) {
  return `${astEngine ?? 'babel'}::${moduleId}`
}

export function getFunctionLikeFromExpression(node: t.Expression | null | undefined): FunctionLike | null {
  if (!node) {
    return null
  }
  if (t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) {
    return node
  }
  return null
}

export function isOxcFunctionLike(node: any): node is FunctionLike {
  return node?.type === 'FunctionDeclaration'
    || node?.type === 'FunctionExpression'
    || node?.type === 'ArrowFunctionExpression'
}

export function getImportedSpecifierName(node: any) {
  if (node?.type === 'Identifier') {
    return node.name as string
  }
  if (
    (node?.type === 'StringLiteral' || node?.type === 'Literal')
    && typeof node.value === 'string'
  ) {
    return node.value as string
  }
  return undefined
}
