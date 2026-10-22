import type { RuntimeRendererContext } from './types'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { readComponentConfig, resolveUsingComponents, withComponentRegistrySnapshot } from './registry'

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
    expect(resolveUsingComponents(context, configPath, 'pages/first/index.js').get('panel')).toBe('pages/first/panel')
    expect(resolveUsingComponents(context, configPath, 'pages/second/index.js').get('panel')).toBe('pages/second/panel')
  })
  expect(readText).toHaveBeenCalledTimes(1)
})

it('retains resolver error fallback for one render and retries in the next render', () => {
  const { context, files, readText } = createContext()
  const configPath = path.resolve('page.json')
  files.set(configPath, '{"usingComponents":{"panel":"registry-panel"}}')
  readText.mockImplementation((file) => {
    if (file !== configPath) {
      throw new Error('resolution read failed')
    }
    return files.get(file)
  })
  withComponentRegistrySnapshot(context, () => {
    expect(resolveUsingComponents(context, configPath, 'page.js').size).toBe(0)
    expect(resolveUsingComponents(context, configPath, 'page.js').size).toBe(0)
  })
  expect(readText).toHaveBeenCalledTimes(2)
  readText.mockImplementation(file => files.get(file))
  withComponentRegistrySnapshot(context, () => {
    expect(resolveUsingComponents(context, configPath, 'page.js').get('panel')).toBe('registry-panel')
  })
})
