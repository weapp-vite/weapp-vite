import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { rolldown } from 'rolldown'
import { describe, expect, it } from 'vitest'

const VIRTUAL_ENTRY_ID = '\0wevu-built-entry'

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

function collectModuleFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.resolve(root, entry.name)
    if (entry.isDirectory()) {
      return collectModuleFiles(filePath)
    }
    return entry.name.endsWith('.mjs') ? [filePath] : []
  })
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

  it('keeps built entry files stable without hashed forwarding chunks', () => {
    const packageRoot = path.resolve(import.meta.dirname, '..')
    const distRoot = path.resolve(packageRoot, 'dist')
    const exportsField = readExports()

    for (const entry of Object.values(exportsField)) {
      if (entry.types) {
        expect(existsSync(path.resolve(packageRoot, entry.types))).toBe(true)
      }
      if (entry.import?.development) {
        expect(existsSync(path.resolve(packageRoot, entry.import.development))).toBe(true)
      }
      if (entry.import?.default) {
        expect(existsSync(path.resolve(packageRoot, entry.import.default))).toBe(true)
      }
    }

    const rootFiles = readdirSync(distRoot)
    const devFiles = readdirSync(path.resolve(distRoot, 'dev'))
    const generatedChunkPattern = /^(?:base|computed|ref|rolldown-runtime|router|store|template|templateRef|toRefs|watch)-[\w-]{6,}\.mjs$/
    expect(rootFiles).not.toEqual(expect.arrayContaining([
      expect.stringMatching(generatedChunkPattern),
    ]))
    expect(devFiles).not.toEqual(expect.arrayContaining([
      expect.stringMatching(generatedChunkPattern),
    ]))
  })

  it('keeps every built relative import resolvable', () => {
    const packageRoot = path.resolve(import.meta.dirname, '..')
    const distRoot = path.resolve(packageRoot, 'dist')
    const missingImports: string[] = []

    for (const filePath of collectModuleFiles(distRoot)) {
      const code = readFileSync(filePath, 'utf8')
      for (const match of code.matchAll(/(?:\bfrom|\bimport)\s*["'](\.[^"']+)["']/g)) {
        const specifier = match[1]
        if (specifier && !existsSync(path.resolve(path.dirname(filePath), specifier))) {
          missingImports.push(`${path.relative(distRoot, filePath)} -> ${specifier}`)
        }
      }
    }

    expect(missingImports).toEqual([])
  })

  it('tree-shakes named imports from the built reactivity entry', async () => {
    const entryPath = path.resolve(import.meta.dirname, '../dist/internal-reactivity.mjs')
    const bundle = await rolldown({
      input: VIRTUAL_ENTRY_ID,
      plugins: [{
        name: 'wevu-built-entry',
        resolveId(id) {
          if (id === VIRTUAL_ENTRY_ID) {
            return id
          }
        },
        load(id) {
          if (id === VIRTUAL_ENTRY_ID) {
            return `import { ref } from ${JSON.stringify(entryPath)}; console.log(ref(1))`
          }
        },
      }],
      treeshake: true,
    })

    try {
      const output = await bundle.generate({ format: 'esm' })
      const renderedModuleIds = output.output.flatMap((chunk) => {
        if (chunk.type !== 'chunk') {
          return []
        }
        return Object.entries(chunk.modules)
          .filter(([, info]) => info.renderedLength > 0)
          .map(([id]) => id.replaceAll('\\', '/'))
      })

      expect(renderedModuleIds).toEqual(expect.arrayContaining([
        expect.stringMatching(/\/reactivity\/ref\.mjs$/),
      ]))
      expect(renderedModuleIds).not.toEqual(expect.arrayContaining([
        expect.stringMatching(/\/reactivity\/watch\.mjs$/),
        expect.stringMatching(/\/runtime\/define\.mjs$/),
      ]))
    }
    finally {
      await bundle.close()
    }
  })
})
