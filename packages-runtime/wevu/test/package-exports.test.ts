import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readExports() {
  const packageJsonPath = new URL('../package.json', import.meta.url)
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    exports?: Record<string, {
      types?: string
      import?: {
        types?: string
        development?: string
        default?: string
      }
    }>
  }

  return packageJson.exports ?? {}
}

const publicEntries = [
  ['.', 'index'],
  ['./compiler', 'compiler'],
  ['./jsx-runtime', 'jsx-runtime'],
  ['./store', 'store'],
  ['./api', 'api'],
  ['./fetch', 'fetch'],
  ['./web-apis', 'web-apis'],
  ['./router', 'router'],
  ['./vue-demi', 'vue-demi'],
] as const

function entryExport(fileName: string) {
  const types = `./dist/${fileName}.d.mts`

  return {
    types,
    import: {
      types,
      development: `./dist/dev/${fileName}.mjs`,
      default: `./dist/${fileName}.mjs`,
    },
  }
}

function devEntryExport(fileName: string) {
  const types = `./dist/${fileName}.d.mts`

  return {
    types,
    import: {
      types,
      default: `./dist/dev/${fileName}.mjs`,
    },
  }
}

describe('package exports', () => {
  it('declares production and development exports for every public entry', () => {
    const exportsField = readExports()

    for (const [exportName, fileName] of publicEntries) {
      expect(exportsField[exportName]).toEqual(entryExport(fileName))
    }
  })

  it('declares explicit dev exports for manual runtime switching', () => {
    const exportsField = readExports()

    for (const [exportName, fileName] of publicEntries) {
      const devExportName = exportName === '.'
        ? './dev'
        : `./dev/${exportName.slice(2)}`

      expect(exportsField[devExportName]).toEqual(devEntryExport(fileName))
    }
  })
})
