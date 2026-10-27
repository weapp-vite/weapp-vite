import type { RuntimeRendererContext } from './types'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { readComponentConfig, resolveUsingComponent, withComponentRegistrySnapshot } from './registry'

function createContext() {
  const files = new Map<string, string>()
  const readText = vi.fn((file: string) => files.get(file))
  const context = {
    artifactSource: { readText, has: (file: string) => files.has(file) },
    project: { miniprogramRootPath: path.resolve('.'), plugins: [] },
  } as unknown as RuntimeRendererContext
  return { context, files, readText }
}

it('preserves the outer snapshot through same-context nesting and clears it after success or failure', () => {
  const { context, files, readText } = createContext()
  const configPath = path.resolve('page.json')
  files.set(configPath, '{"marker":"A"}')
  withComponentRegistrySnapshot(context, () => {
    expect(readComponentConfig(context, configPath).marker).toBe('A')
    files.set(configPath, '{"marker":"B"}')
    withComponentRegistrySnapshot(context, () => {
      expect(readComponentConfig(context, configPath).marker).toBe('A')
    })
    expect(() => withComponentRegistrySnapshot(context, () => {
      throw new Error('nested render failed')
    })).toThrow('nested render failed')
    expect(readComponentConfig(context, configPath).marker).toBe('A')
  })
  expect(readText).toHaveBeenCalledTimes(1)
  expect(() => withComponentRegistrySnapshot(context, () => {
    expect(readComponentConfig(context, configPath).marker).toBe('B')
    throw new Error('render failed')
  })).toThrow('render failed')
  files.set(configPath, '{"marker":"C"}')
  withComponentRegistrySnapshot(context, () => {
    expect(readComponentConfig(context, configPath).marker).toBe('C')
  })
  expect(readText).toHaveBeenCalledTimes(3)
})

it('keys alias resolution by both owner config and owner file while sharing the parsed config', () => {
  const { context, files, readText } = createContext()
  const configPath = path.resolve('shared.json')
  files.set(configPath, '{"usingComponents":{"panel":"./panel"}}')
  withComponentRegistrySnapshot(context, () => {
    expect(resolveUsingComponent(context, configPath, 'pages/first/index.js', 'panel')).toBe('pages/first/panel')
    expect(resolveUsingComponent(context, configPath, 'pages/second/index.js', 'panel')).toBe('pages/second/panel')
  })
  expect(readText).toHaveBeenCalledTimes(1)
})

it('retains resolver error fallback for one render and retries in the next render', () => {
  const { context, files, readText } = createContext()
  const configPath = path.resolve('page.json')
  files.set(configPath, '{"usingComponents":{"panel":"registry-panel"}}')
  const has = vi.fn<(file: string) => boolean>(() => {
    throw new Error('resolution probe failed')
  })
  context.artifactSource.has = has
  withComponentRegistrySnapshot(context, () => {
    expect(resolveUsingComponent(context, configPath, 'page.js', 'panel')).toBeUndefined()
    expect(resolveUsingComponent(context, configPath, 'page.js', 'panel')).toBeUndefined()
  })
  expect(readText).toHaveBeenCalledTimes(1)
  expect(has).toHaveBeenCalledTimes(1)
  has.mockImplementation(file => files.has(file))
  withComponentRegistrySnapshot(context, () => {
    expect(resolveUsingComponent(context, configPath, 'page.js', 'panel')).toBe('registry-panel')
  })
})

it('resolves only the requested alias and caches misses within the render', () => {
  const { context, files } = createContext()
  const configPath = path.resolve('page.json')
  files.set(configPath, '{"usingComponents":{"panel":"registry-panel","unused":"unused-package"}}')
  const has = vi.spyOn(context.artifactSource, 'has')
  withComponentRegistrySnapshot(context, () => {
    expect(resolveUsingComponent(context, configPath, 'page.js', 'missing')).toBeUndefined()
    expect(resolveUsingComponent(context, configPath, 'page.js', 'missing')).toBeUndefined()
    expect(has).not.toHaveBeenCalled()
    expect(resolveUsingComponent(context, configPath, 'page.js', 'panel')).toBe('registry-panel')
    const calls = has.mock.calls.length
    expect(calls).toBeGreaterThan(0)
    expect(resolveUsingComponent(context, configPath, 'page.js', 'panel')).toBe('registry-panel')
    expect(has).toHaveBeenCalledTimes(calls)
    expect(has.mock.calls.some(([file]) => file.includes('unused-package'))).toBe(false)
  })
})
