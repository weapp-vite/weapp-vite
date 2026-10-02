import type { AnalyzeModuleCategory, AnalyzeModuleOwner } from './types'
import { readFileSync } from 'node:fs'
import path from 'pathe'

/** 每次分析独立缓存包边界，兼容 pnpm、工作区和普通 node_modules。 */
export function createModuleOwnerResolver() {
  const cache = new Map<string, AnalyzeModuleOwner | undefined>()
  const resolveDirectory = (directory: string): AnalyzeModuleOwner | undefined => {
    if (cache.has(directory)) {
      return cache.get(directory)
    }
    let owner: AnalyzeModuleOwner | undefined
    try {
      const value: unknown = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'))
      if (value && typeof value === 'object' && 'name' in value && typeof value.name === 'string') {
        owner = {
          name: value.name,
          version: 'version' in value && typeof value.version === 'string' ? value.version : undefined,
        }
      }
    }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
        throw error
      }
    }
    const parent = path.dirname(directory)
    if (!owner && parent !== directory && path.basename(directory) !== 'node_modules') {
      owner = resolveDirectory(parent)
    }
    cache.set(directory, owner)
    return owner
  }
  return (id: string) => id === '\0rolldown/runtime.js'
    ? { name: 'rolldown' }
    : path.isAbsolute(id) && !id.includes('\0')
      ? resolveDirectory(path.dirname(id.replace(/[?#].*$/, '')))
      : undefined
}

export function classifyOwnedModule(owner: AnalyzeModuleOwner | undefined, application: boolean): AnalyzeModuleCategory {
  if (application) {
    return 'application'
  }
  if (owner?.name === '@vue/reactivity') {
    return 'reactivity'
  }
  if (owner?.name === '@vue/shared' || owner?.name === '@weapp-core/constants' || owner?.name === 'rolldown') {
    return 'helper'
  }
  if (owner && ['weapi', '@wevu/api', '@wevu/web-apis', '@weapp-vite/web', '@weapp-vite/web-apis'].includes(owner.name)) {
    return 'host'
  }
  if (owner && ['wevu', '@weapp-vite/react'].includes(owner.name)) {
    return 'runtime'
  }
  return owner ? 'dependency' : 'unknown'
}

export function isRuntimeCategory(category: AnalyzeModuleCategory) {
  return ['runtime', 'reactivity', 'host', 'helper'].includes(category)
}
