import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readExports() {
  const packageJsonPath = new URL('../package.json', import.meta.url)
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    exports?: Record<string, { types?: string, import?: { types?: string, default?: string } }>
  }

  return packageJson.exports ?? {}
}

describe('package exports', () => {
  it('declares store subpath export', () => {
    const exportsField = readExports()

    expect(exportsField['./store']).toEqual({
      types: './dist/store.d.mts',
      import: {
        types: './dist/store.d.mts',
        default: './dist/store.mjs',
      },
    })
  })

  it('declares api subpath export', () => {
    const exportsField = readExports()

    expect(exportsField['./api']).toEqual({
      types: './dist/api.d.mts',
      import: {
        types: './dist/api.d.mts',
        default: './dist/api.mjs',
      },
    })
  })

  it('declares router subpath export', () => {
    const exportsField = readExports()

    expect(exportsField['./router']).toEqual({
      types: './dist/router.d.mts',
      import: {
        types: './dist/router.d.mts',
        default: './dist/router.mjs',
      },
    })
  })
})
