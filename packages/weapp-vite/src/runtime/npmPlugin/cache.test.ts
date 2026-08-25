import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { createDependenciesCache } from './cache'

function createContext(packageFiles: Record<string, { include?: string[], exclude?: string[] }>) {
  return {
    configService: {
      cwd: process.cwd(),
      packageJson: {
        dependencies: {
          'mini-pkg': '1.0.0',
        },
      },
      weappViteConfig: {
        npm: {
          packageFiles,
        },
      },
    },
  } as any
}

describe('npm dependencies cache', () => {
  it('invalidates when package file filters change', () => {
    const dialogHash = createDependenciesCache(createContext({
      'mini-pkg': {
        include: ['dialog/**'],
      },
    })).dependenciesCacheHash()
    const buttonHash = createDependenciesCache(createContext({
      'mini-pkg': {
        include: ['button/**'],
      },
    })).dependenciesCacheHash()

    expect(dialogHash).not.toBe(buttonHash)
  })
})
