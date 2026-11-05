import type { Metafile, Plugin } from 'esbuild'
import type { ProfileOperation } from './types'
import { readFile } from 'node:fs/promises'
import { createRequire, isBuiltin } from 'node:module'
import path from 'node:path'
import { build } from 'esbuild'
import { recordBuildInputs, recordFiles } from '../../benchmarkWxmlParser/bundleIdentity'
import { consumerEntries } from '../../benchmarkWxmlParser/freeze'
import { repositoryRoot } from '../paths'

interface ConsumerArm { sourceRoot: string, builtEntry: string }

function within(parent: string, file: string): boolean {
  const relative = path.relative(parent, file)
  return !relative.startsWith('..') && !path.isAbsolute(relative)
}

/** 冻结分支不可通过 workspace 软链接导入当前分支的业务实现。 */
export function assertConsumerClosure(metafile: Pick<Metafile, 'inputs'>, arm: ConsumerArm): void {
  for (const input of Object.keys(metafile.inputs)) {
    const file = path.resolve(repositoryRoot, input)
    const relative = path.relative(repositoryRoot, file).replaceAll('\\', '/')
    if (/^(?:packages|packages-runtime|mpcore\/packages|@weapp-core)\//.test(relative)
      && !within(arm.sourceRoot, file) && !within(path.dirname(arm.builtEntry), file)) {
      throw new Error(`Frozen consumer imported a current workspace implementation: ${relative}`)
    }
  }
}

/** 仅收窄既有生产 barrel 导出，业务源码及其 workspace 依赖始终来自指定源码树。 */
export function consumerAliases(arm: ConsumerArm): Record<string, string> {
  return {
    '@weapp-vite/wxml': arm.builtEntry,
    '@weapp-vite/wxml/core': path.join(path.dirname(arm.builtEntry), 'core/index.mjs'),
    '@weapp-vite/wxml/presets': path.join(path.dirname(arm.builtEntry), 'presets/index.mjs'),
    '@weapp-core/shared': path.join(arm.sourceRoot, '@weapp-core/shared/src/index.ts'),
    '@weapp-core/shared/platforms': path.join(arm.sourceRoot, '@weapp-core/shared/src/platforms/index.ts'),
    '@weapp-core/shared/platforms/runtime': path.join(arm.sourceRoot, '@weapp-core/shared/src/platforms/runtime/index.ts'),
    '@weapp-core/constants': path.join(arm.sourceRoot, '@weapp-core/constants/src/index.ts'),
    '@weapp-vite/language-service': path.join(arm.sourceRoot, 'packages/language-service/src/script/scanner.ts'),
    '@weapp-vite/ast': path.join(arm.sourceRoot, 'packages/ast/src/babel.ts'),
    'wevu/compiler': path.join(arm.sourceRoot, 'packages-runtime/wevu-compiler/src/auto-import-components/builtin.ts'),
  }
}

function transport(arm: ConsumerArm): Plugin {
  const aliases = consumerAliases(arm)
  const bridge = path.join(repositoryRoot, 'scripts/benchmarkWxmlParser/browserBabelModule.ts')
  return { name: 'frozen-main-consumer-closure', setup(builder) {
    builder.onResolve({ filter: /.*/ }, (args) => {
      if (aliases[args.path]) {
        return { path: aliases[args.path]! }
      }
      if (args.path === 'node:module') {
        if (args.importer !== aliases['@weapp-vite/ast']) {
          throw new Error('Consumer Node module bridge may only serve the actual Babel loader')
        }
        return { path: bridge }
      }
      if (args.path === '@babel/parser' && args.importer === bridge) {
        return { path: createRequire(path.join(repositoryRoot, 'packages/ast/package.json')).resolve('@babel/parser') }
      }
      if (args.path.startsWith('@weapp-') || args.path.startsWith('@wevu/')) {
        throw new Error(`Unmapped workspace dependency in frozen consumer closure: ${args.path}`)
      }
      if (args.path.startsWith('.') || path.isAbsolute(args.path) || isBuiltin(args.path)) {
        return undefined
      }
      // 第三方版本由本轮锁文件决定；不允许软链接把 workspace 实现带回当前主树。
      const relative = path.relative(arm.sourceRoot, args.importer)
      const importer = !relative.startsWith('..') && !path.isAbsolute(relative)
        ? path.join(repositoryRoot, relative)
        : args.importer || path.join(repositoryRoot, 'package.json')
      const require = createRequire(importer)
      return { path: require.resolve(args.path) }
    })
  } }
}

export interface PreparedConsumers {
  imports: string[]
  expression: string
  operations: ProfileOperation[]
  artifacts: Record<string, string>
  boundary: string
}

/** 计时外完整打包六份真实消费者闭包，metafile 覆盖相对 chunk 与第三方实际模块。 */
export async function prepareRegressionConsumers(output: string, baseline: ConsumerArm, current: ConsumerArm): Promise<PreparedConsumers> {
  const artifacts: Record<string, string> = {}
  const imports: string[] = []
  const mappings: string[] = []
  const operations: ProfileOperation[] = []
  for (const arm of [baseline, current]) {
    await recordFiles(['@weapp-core/shared', '@weapp-core/constants', 'packages/wxml', 'packages/language-service', 'packages/ast', 'packages-runtime/wevu-compiler', 'packages/weapp-vite', 'packages-runtime/web', 'mpcore/packages/simulator'].map(directory => path.join(arm.sourceRoot, directory, 'package.json')), artifacts)
  }
  for (const [name, entry] of Object.entries(consumerEntries)) {
    const exported = name === 'simulator' ? 'parseWxsTemplateDocument' : 'parseWxml'
    for (const [label, arm] of Object.entries({ baseline, candidate: current })) {
      const file = path.join(output, `consumer-${label}-${name}.mjs`)
      const source = path.join(arm.sourceRoot, entry)
      await readFile(source)
      const built = await build({ absWorkingDir: repositoryRoot, entryPoints: [source], outfile: file, bundle: true, platform: 'browser', format: 'esm', metafile: true, logLevel: 'silent', plugins: [transport(arm)] })
      assertConsumerClosure(built.metafile!, arm)
      await recordBuildInputs(built.metafile!, artifacts)
      await recordFiles([file, path.join(arm.sourceRoot, 'pnpm-lock.yaml')], artifacts)
      imports.push(`import {${exported} as ${label}_${name}} from ${JSON.stringify(file)}`)
    }
    const call = (arm: string) => name === 'scanner'
      ? `fixture => ${arm}_${name}({source:fixture.source,platform:fixture.options.platform ?? 'weapp',excludeComponent:()=>false})`
      : `fixture => ${arm}_${name}(fixture.source)`
    mappings.push(`${JSON.stringify(`consumer-${name}`)}:{baseline:${call('baseline')},candidate:${call('candidate')}}`)
    operations.push(`consumer-${name}` as ProfileOperation)
  }
  return { imports, expression: `{${mappings.join(',')}}`, operations, artifacts, boundary: 'Real scanner, Web compiler and simulator production source closures from each source tree; explicit built parser per arm. Workspace barrels narrow to their actual production exports. The finite Babel loader bridge imports the actual locked parser in both Node and Chromium. No consumer implementation is copied or replaced.' }
}
