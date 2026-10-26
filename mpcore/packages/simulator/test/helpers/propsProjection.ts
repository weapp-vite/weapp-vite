import type { VueTransformResult } from 'wevu/compiler'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { rolldown } from 'rolldown'
import { compileVueFile } from 'wevu/compiler'

export interface PropsProjectionFixture {
  files: Array<[string, string]>
  bindings: Record<string, Array<{ sourceRoots: string[], outputPath: string }>>
}

/** 与真实微信 fixture 共用源码，由编译器和 bundler 生成脚本、模板及配置。 */
export async function createPropsProjectionFiles(outputDir?: string): Promise<PropsProjectionFixture> {
  const repoRoot = path.resolve(import.meta.dirname, '../../../../..')
  const sourceRoot = path.join(repoRoot, 'e2e-apps/github-issues/fixtures/issue-1261/src')
  const entries = [
    'app',
    'pages/index/index',
    'components/navBar/index',
    'components/conflictProbe/index',
    'components/mutableProbe/index',
  ]
  const sources = new Map<string, Promise<string>>()
  const compiled = new Map<string, VueTransformResult>()
  const readSource = (filename: string) => {
    let source = sources.get(filename)
    if (!source) {
      source = readFile(filename, 'utf8')
      sources.set(filename, source)
    }
    return source
  }
  const runtimeEntries: Record<string, string> = {
    'wevu': 'index.ts',
    'virtual:weapp-vite/runtime': 'internal-runtime.ts',
    'virtual:weapp-vite/runtime/template': 'internal-template.ts',
    'virtual:weapp-vite/runtime/reactivity': 'internal-reactivity.ts',
  }
  const bundle = await rolldown({
    cwd: repoRoot,
    tsconfig: false,
    input: Object.fromEntries(entries.map(entry => [entry, path.join(sourceRoot, `${entry}.vue`)])),
    transform: { define: { 'import.meta': JSON.stringify({ env: { PLATFORM: 'weapp', PROD: true, DEV: false } }) } },
    plugins: [{
      name: 'props-projection-compiled-fixture',
      buildStart() {
        this.emitFile({ type: 'asset', fileName: 'project.config.json', source: '{"miniprogramRoot":"."}' })
      },
      resolveId(id) {
        const entry = runtimeEntries[id]
        if (entry) {
          return path.join(repoRoot, 'packages-runtime/wevu/src', entry)
        }
      },
      async load(id) {
        const relative = path.relative(sourceRoot, id)
        if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
          return
        }
        if (!id.endsWith('.vue')) {
          return { code: await readSource(id), moduleType: 'ts' }
        }
        const entry = relative.replaceAll('\\', '/').replace(/\.vue$/, '')
        const result = await compileVueFile(await readSource(id), id, {
          isApp: entry === 'app',
          isPage: entry.startsWith('pages/'),
          sfcSrc: {
            readFile: readSource,
            resolveId: async (source, importer) => (await this.resolve(source, importer))?.id,
          },
          autoUsingComponents: {
            enabled: true,
            resolveUsingComponentPath: async (source, importer) => {
              const resolved = await this.resolve(source, importer)
              if (!resolved?.id.endsWith('.vue')) {
                return
              }
              return {
                resolvedId: resolved.id,
                sourceType: 'wevu-sfc',
                from: `/${path.relative(sourceRoot, resolved.id).replaceAll('\\', '/').replace(/\.vue$/, '')}`,
              }
            },
          },
        })
        if (!result.script) {
          throw new Error(`Missing compiled script for ${entry}`)
        }
        compiled.set(entry, result)
        this.emitFile({ type: 'asset', fileName: `${entry}.json`, source: result.config ?? '{}' })
        if (result.template !== undefined && entry !== 'app') {
          this.emitFile({ type: 'asset', fileName: `${entry}.wxml`, source: result.template })
        }
        return { code: result.script, moduleType: 'js' }
      },
    }],
  })
  try {
    const outputOptions = { format: 'cjs' as const, entryFileNames: '[name].js' }
    const { output } = outputDir
      ? await bundle.write({ ...outputOptions, dir: outputDir })
      : await bundle.generate(outputOptions)
    return {
      files: output.map((item): [string, string] => [
        item.fileName,
        item.type === 'chunk' ? item.code : typeof item.source === 'string' ? item.source : new TextDecoder().decode(item.source),
      ]),
      bindings: Object.fromEntries([...compiled].map(([entry, result]) => [
        entry,
        result.bindingManifest?.bindings.map(({ sourceRoots, outputPath }) => ({ sourceRoots, outputPath })) ?? [],
      ])),
    }
  }
  finally {
    await bundle.close()
  }
}
