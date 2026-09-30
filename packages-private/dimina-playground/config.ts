import path from 'node:path'

export const upstreamCommit = 'fa34f11e02f480df715d374e11a3f531f63b7a60'
export const root = import.meta.dirname
export const repositoryRoot = path.resolve(root, '../..')
export const cacheRoot = path.join(repositoryRoot, '.cache/dimina')
export const upstreamRoot = path.join(cacheRoot, 'source')
export const appId = 'wxb3d842a4a7e3440d'
export const examples = ['native', 'wevu', 'react'] as const
export type Example = typeof examples[number]
