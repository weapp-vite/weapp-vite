import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

export function collectInventorySources(root: string, entrypoints: string[]) {
  const sources = new Map<string, string>()
  const visit = (file: string) => {
    if (sources.has(file) || !file.startsWith('e2e/')) {
      return
    }
    const content = fs.readFileSync(path.join(root, file), 'utf8').replaceAll('\r\n', '\n')
    sources.set(file, createHash('sha256').update(content).digest('hex'))
    const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true)
    const imports = source.statements
      .filter((statement): statement is ts.ImportDeclaration | ts.ExportDeclaration => ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))
      .map(statement => statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : '')
      .filter(specifier => specifier.startsWith('.'))
    for (const specifier of imports) {
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
      const target = [base, `${base}.ts`, `${base}.mts`, `${base}/index.ts`]
        .find(candidate => /\.[cm]?ts$/.test(candidate) && fs.existsSync(path.join(root, candidate)))
      if (target) {
        visit(target)
      }
    }
  }
  for (const entrypoint of entrypoints) {
    visit(entrypoint)
  }
  return [...sources].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([file, sha256]) => ({ file, sha256 }))
}
