import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const packageDirectory = fileURLToPath(new URL('../../../packages/wxml/', import.meta.url))

/** 只跟踪会执行的 ESM 依赖，纯类型导入导出不会污染运行时边界。 */
function runtimeSpecifiers(source: string, file: string): string[] {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const result: string[] = []
  for (const statement of ast.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause
      if (clause?.isTypeOnly || (clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.length > 0 && clause.namedBindings.elements.every(element => element.isTypeOnly))) {
        continue
      }
      result.push(statement.moduleSpecifier.text)
    }
    else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      if (statement.isTypeOnly || (statement.exportClause && ts.isNamedExports(statement.exportClause) && statement.exportClause.elements.length > 0 && statement.exportClause.elements.every(element => element.isTypeOnly))) {
        continue
      }
      result.push(statement.moduleSpecifier.text)
    }
  }
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      const specifier = node.arguments[0]
      if (!specifier || !ts.isStringLiteral(specifier)) {
        throw new TypeError(`Cannot statically audit a computed runtime import in ${file}`)
      }
      result.push(specifier.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return result
}

async function runtimeGraph(entry: string) {
  const files = new Set<string>()
  const external = new Set<string>()
  const visit = async (file: string): Promise<void> => {
    if (files.has(file)) {
      return
    }
    files.add(file)
    for (const specifier of runtimeSpecifiers(await readFile(file, 'utf8'), file)) {
      if (!specifier.startsWith('.')) {
        external.add(specifier)
        continue
      }
      const target = path.resolve(path.dirname(file), specifier)
      if (path.extname(target)) {
        await visit(target)
      }
      else {
        const direct = `${target}.ts`
        try {
          await readFile(direct)
        }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error
          }
          await visit(path.join(target, 'index.ts'))
          continue
        }
        await visit(direct)
      }
    }
  }
  await visit(entry)
  return { files: [...files].map(file => path.relative(packageDirectory, file).split(path.sep).join('/')).sort(), external: [...external].sort() }
}

describe('independent core and preset runtime dependency graphs', () => {
  it('distinguishes executable imports from pure types and tracks lazy dependencies', () => {
    expect(runtimeSpecifiers('import type { A } from "types"; import { type B } from "types"; export type * from "types"; import {} from "empty"; export {} from "empty-export"; import("lazy"); require("commonjs");', 'fixture.ts')).toEqual(['empty', 'empty-export', 'lazy', 'commonjs'])
    expect(() => runtimeSpecifiers('import(target)', 'fixture.ts')).toThrow('computed runtime import')
  })

  it('keeps platform metadata and root compatibility outside the source core graph', async () => {
    const core = await runtimeGraph(path.join(packageDirectory, 'src/core.ts'))
    const presets = await runtimeGraph(path.join(packageDirectory, 'src/presets/index.ts'))
    expect(core.files.length).toBeGreaterThan(1)
    expect(core.files.some(file => file.startsWith('src/presets/'))).toBe(false)
    for (const file of ['src/index.ts', 'src/options.ts', 'src/parser.ts', 'src/scanner.ts', 'src/compatibilityEdit.ts']) {
      expect(core.files).not.toContain(file)
    }
    expect(presets.files).toEqual(['src/presets/definitions.ts', 'src/presets/index.ts'])
    expect(presets.external).toEqual([])
    expect(core.files.filter(file => presets.files.includes(file))).toEqual([])
  })

  it('keeps the actual built core and preset chunk graphs disjoint', async () => {
    const core = await runtimeGraph(path.join(packageDirectory, 'dist/core/index.mjs'))
    const presets = await runtimeGraph(path.join(packageDirectory, 'dist/presets/index.mjs'))
    expect(core.files.length).toBeGreaterThan(1)
    expect(presets.files.length).toBeGreaterThan(1)
    expect(core.external).toEqual(['entities'])
    expect(presets.external).toEqual([])
    expect(core.files.filter(file => presets.files.includes(file))).toEqual([])
  })
})
