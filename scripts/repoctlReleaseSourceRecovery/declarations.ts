import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

export function emitFixtureDeclarations(cwd: string) {
  const modules = path.join(cwd, 'node_modules')
  const parser = path.join(modules, '.pnpm/parser@1.0.0/node_modules/@fixture/parser')
  const core = path.join(modules, '.pnpm/core@1.0.0/node_modules/@fixture/core')
  for (const [directory, name] of [[parser, '@fixture/parser'], [core, '@fixture/core']] as const) {
    mkdirSync(directory, { recursive: true })
    writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name, version: '1.0.0', types: 'index.d.ts' }))
  }
  writeFileSync(path.join(parser, 'index.d.ts'), 'export interface ParseResult { value: string }\n')
  writeFileSync(path.join(core, 'index.d.ts'), 'import type { ParseResult } from \'@fixture/parser\'\nexport declare function parse(code: string): ParseResult\n')
  const visible = path.join(modules, '@fixture')
  mkdirSync(visible, { recursive: true })
  for (const [target, link] of [
    [parser, path.join(visible, 'parser')],
    [core, path.join(visible, 'core')],
    [parser, path.join(path.dirname(core), 'parser')],
  ]) {
    symlinkSync(target!, link!, 'junction')
  }
  const sources = path.join(cwd, '.type-probe')
  mkdirSync(sources, { recursive: true })
  const index = path.join(sources, 'index.ts')
  const seed = path.join(sources, 'seed.ts')
  writeFileSync(index, 'import { parse } from \'@fixture/core\'\nexport const engine = { parse(code: string) { return parse(code) } }\n')
  // 独立入口使 TypeScript 记录公开符号链接，并与历史 AST 的依赖关系保持一致。
  writeFileSync(seed, 'export type { ParseResult } from \'@fixture/parser\'\n')
  const options: ts.CompilerOptions = {
    declaration: true,
    emitDeclarationOnly: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    strict: true,
    types: [],
    skipLibCheck: true,
  }
  const declarations = new Map<string, string>()
  const host = ts.createCompilerHost(options)
  host.getCurrentDirectory = () => cwd
  host.writeFile = (file, contents) => {
    declarations.set(file, contents)
  }
  const program = ts.createProgram([index, seed], options, host)
  const emitted = program.emit()
  return {
    diagnostics: [...ts.getPreEmitDiagnostics(program), ...emitted.diagnostics].map(diagnostic => diagnostic.code),
    declarations: [...declarations.values()].join('\n'),
  }
}
