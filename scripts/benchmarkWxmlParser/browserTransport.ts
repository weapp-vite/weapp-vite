import type { Plugin } from 'esbuild'
import { createRequire } from 'node:module'
import path from 'node:path'
import { baselineRoot, repositoryRoot } from './freeze'

export function browserTransportPlan(candidateScanner?: string) {
  const astRoot = path.join(repositoryRoot, 'packages/ast')
  const require = createRequire(path.join(astRoot, 'package.json'))
  return {
    bridge: path.join(repositoryRoot, 'scripts/benchmarkWxmlParser/browserBabelModule.ts'),
    parser: require.resolve('@babel/parser'),
    babel: path.join(astRoot, 'dist/babel.mjs'),
    astEntry: path.join(astRoot, 'dist/index.mjs'),
    astPackage: path.join(astRoot, 'package.json'),
    languageService: path.join(repositoryRoot, 'packages/language-service/dist'),
    baselineScanner: path.join(baselineRoot, 'scanner.mjs'),
    candidateScanner,
    compilerBuiltin: path.join(repositoryRoot, 'packages-runtime/wevu-compiler/src/auto-import-components/builtin.ts'),
    compilerEntry: path.join(repositoryRoot, 'packages-runtime/wevu-compiler/dist/index.mjs'),
    compilerPackage: path.join(repositoryRoot, 'packages-runtime/wevu-compiler/package.json'),
  }
}

export function browserConsumerTransport(plan = browserTransportPlan()): Plugin {
  return {
    name: 'scanner-browser-module-transport',
    setup(builder) {
      builder.onResolve({ filter: /^wevu\/compiler$/ }, args => args.importer === plan.candidateScanner ? { path: plan.compilerBuiltin } : undefined)
      // barrel 的 parse/traverse 直接来自同一个 Babel 文件，避免解析无关 native 导出。
      builder.onResolve({ filter: /^@weapp-vite\/ast$/ }, (args) => {
        const relative = path.relative(plan.languageService, args.importer)
        if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
          return { path: plan.babel }
        }
        return undefined
      })
      builder.onResolve({ filter: /^node:module$/ }, (args) => {
        if (![plan.babel, plan.baselineScanner].includes(args.importer)) {
          throw new Error(`Node module transport outside the scanner Babel loader: ${path.relative(repositoryRoot, args.importer)}`)
        }
        return { path: plan.bridge }
      })
      builder.onResolve({ filter: /^@babel\/parser$/ }, args => args.importer === plan.bridge ? { path: plan.parser } : undefined)
    },
  }
}
