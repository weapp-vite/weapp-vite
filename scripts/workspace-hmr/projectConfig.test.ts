import type { Plugin, ResolvedConfig } from 'vite'
import path from 'node:path'
import process from 'node:process'
import { afterEach, expect, it, vi } from 'vitest'
import { createWorkspaceHmrProjectConfig } from './projectConfig'
import { readWorkspaceHmrProjectTarget } from './projectTarget'

afterEach(() => vi.restoreAllMocks())

it('observes only the main native build and emits one receipt across repeated configuration hooks', () => {
  const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  const config = createWorkspaceHmrProjectConfig({ weapp: { platform: 'tt' } }, { id: 'current', sourceRoot: 'src', profilePath: 'profile.jsonl' })
  const observer = (config.plugins as Plugin[]).find(plugin => plugin.name === 'workspace-hmr:project-target')!
  const apply = observer.apply as (config: unknown, environment: { command: string }) => boolean
  expect(apply({ build: { write: true } }, { command: 'serve' })).toBe(false)
  expect(apply({ build: { write: false } }, { command: 'build' })).toBe(false)
  expect(apply({ build: { write: true } }, { command: 'build' })).toBe(true)
  const resolved = { root: path.resolve('project'), build: { outDir: 'output/native' }, plugins: [] } as unknown as ResolvedConfig
  const hook = observer.configResolved as (config: ResolvedConfig) => void
  hook({ ...resolved, plugins: [{ name: 'weapp-vite:workers' }], build: { ...resolved.build, outDir: 'workers' } })
  expect(write).not.toHaveBeenCalled()
  hook(resolved)
  hook(resolved)
  expect(write).toHaveBeenCalledOnce()
  expect(readWorkspaceHmrProjectTarget(String(write.mock.calls[0]![0]), { id: 'current', pid: process.pid })).toEqual({ platform: 'tt', distRoot: path.resolve('project/output/native') })
  expect(() => hook({ ...resolved, build: { ...resolved.build, outDir: 'other-output' } })).toThrow('output root changed')
})
