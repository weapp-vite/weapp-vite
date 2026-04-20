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

  it('declares fetch subpath export', () => {
    const exportsField = readExports()

    expect(exportsField['./fetch']).toEqual({
      types: './dist/fetch.d.mts',
      import: {
        types: './dist/fetch.d.mts',
        default: './dist/fetch.mjs',
      },
    })
  })

  it('declares web-apis subpath export', () => {
    const exportsField = readExports()

    expect(exportsField['./web-apis']).toEqual({
      types: './dist/web-apis.d.mts',
      import: {
        types: './dist/web-apis.d.mts',
        default: './dist/web-apis.mjs',
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

  it('declares vue-demi subpath export', () => {
    const exportsField = readExports()

    expect(exportsField['./vue-demi']).toEqual({
      types: './dist/vue-demi.d.mts',
      import: {
        types: './dist/vue-demi.d.mts',
        default: './dist/vue-demi.mjs',
      },
    })
  })
})
