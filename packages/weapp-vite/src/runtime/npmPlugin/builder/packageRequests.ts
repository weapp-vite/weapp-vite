import { isBuiltin } from 'node:module'
import { fs } from '@weapp-core/shared/fs'
import * as t from '@weapp-vite/ast/babelTypes'
import path from 'pathe'
import { BABEL_TS_MODULE_PLUGINS, parse, parseJsLike, traverse } from '../../../utils/babel'
import { parseNpmPackageSpecifier } from '../../../utils/npmImport'
import { collectFiles } from './shared'

/** 原生 CommonJS 允许顶层 return 和非严格语法，模块文件仍保留 ESM 解析语义。 */
function parseCopiedScript(source: string, file: string) {
  if (path.extname(file) === '.mjs') {
    return parseJsLike(source)
  }
  try {
    return parse(source, { sourceType: 'commonjs', plugins: BABEL_TS_MODULE_PLUGINS }) as unknown as t.File
  }
  catch (error) {
    if (path.extname(file) === '.cjs') {
      throw error
    }
    return parseJsLike(source)
  }
}

/** 只查本次复制保留的 npm 实体，不借用未发布的外层 Node 依赖目录。 */
function resolvesWithinCopiedPackage(root: string, owner: string, request: string, files: Set<string>, npmDirectories: string[]) {
  if (request.includes('\\') || request.includes(':') || request.split('/').some(part => !part || part === '.' || part === '..')) {
    return false
  }
  let directory = path.dirname(owner)
  while (true) {
    for (const npmDirectory of npmDirectories) {
      const base = path.join(directory, npmDirectory, request)
      if ([base, `${base}.js`, `${base}.json`, path.join(base, 'index.js')].some(file => files.has(file))) {
        return true
      }
    }
    if (directory === root) {
      return false
    }
    directory = path.dirname(directory)
  }
}

/** 只分析真正保留的运行时文件；局部 require、注释和字符串不构成外部依赖。 */
export async function collectCopiedPackageRequests(root: string, npmDirectories: string[]) {
  const requests: { specifier: string, relativeFile: string }[] = []
  const files = new Set((await collectFiles(root)).sort())
  for (const file of files) {
    if (!/\.[cm]?js$/.test(file)) {
      continue
    }
    const source = await fs.readFile(file, 'utf8')
    const ast = parseCopiedScript(source, file)
    const collected = new Set<string>()
    const collect = (value: string) => {
      if (!isBuiltin(value) && parseNpmPackageSpecifier(value) && !resolvesWithinCopiedPackage(root, file, value, files, npmDirectories)) {
        collected.add(value)
      }
    }
    traverse(ast, {
      CallExpression(nodePath) {
        const { callee, arguments: args } = nodePath.node
        if (t.isIdentifier(callee, { name: 'require' }) && !nodePath.scope.hasBinding('require') && t.isStringLiteral(args[0])) {
          collect(args[0].value)
        }
      },
      ImportDeclaration(nodePath) { collect(nodePath.node.source.value) },
      ExportNamedDeclaration(nodePath) {
        if (nodePath.node.source) {
          collect(nodePath.node.source.value)
        }
      },
      ExportAllDeclaration(nodePath) { collect(nodePath.node.source.value) },
      ImportExpression(nodePath) {
        if (t.isStringLiteral(nodePath.node.source)) {
          collect(nodePath.node.source.value)
        }
      },
    })
    const relativeFile = path.relative(root, file).replace(/\\/g, '/')
    requests.push(...[...collected].sort().map(specifier => ({ specifier, relativeFile })))
  }
  return requests
}
