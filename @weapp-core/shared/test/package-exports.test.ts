import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readExports() {
  const packageJsonPath = new URL('../package.json', import.meta.url)
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    exports?: Record<string, { types?: string, import?: string }>
    publishConfig?: {
      exports?: Record<string, { types?: string, import?: string }>
    }
  }

  return {
    exports: packageJson.exports ?? {},
    publishExports: packageJson.publishConfig?.exports ?? {},
  }
}

describe('@weapp-core/shared package exports', () => {
  it('declares runtime-safe root export', () => {
    const { exports, publishExports } = readExports()

    const expected = {
      types: './dist/index.d.ts',
      import: './dist/index.js',
    }

    expect(exports['.']).toEqual(expected)
    expect(publishExports['.']).toEqual(expected)
  })

  it('declares node-only fs subpath export', () => {
    const { exports, publishExports } = readExports()

    const expected = {
      types: './dist/fs/index.d.ts',
      import: './dist/fs/index.js',
    }

    expect(exports['./fs']).toEqual(expected)
    expect(publishExports['./fs']).toEqual(expected)
  })
})
