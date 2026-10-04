import type { Plugin } from 'vite'
import type { PackageFileEntry } from '../../packages/weapp-vite/src/analyze/subpackages/types'
import { createHash } from 'node:crypto'
import { readFile, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createArtifactAnalysis } from '../../packages/weapp-vite/src/analyze/subpackages/artifacts'
import { runtimeModuleFacet } from './facets'
import { compareStrings, normalizeRuntimeModulePath } from './modules'

/** 虚拟模块查询和编译代码也可能包含编码路径，统一去除消费者的机器目录。 */
export function normalizeConsumerDiagnostic(value: string, root: string) {
  let result = value
  for (const prefix of new Set([root, root.replaceAll('\\', '/')])) {
    result = result.replaceAll(prefix, '[consumer]').replaceAll(encodeURIComponent(prefix), '[consumer]').replaceAll(encodeURI(prefix), '[consumer]')
  }
  return result.replaceAll('\0', '[virtual]')
}

/** 从真实发布包构建采集元数据，诊断 JSON 写在项目根目录，不参与产物持久化。 */
export function captureConsumerAttribution(root = process.cwd()): Plugin {
  const normalize = (id: string) => normalizeConsumerDiagnostic(normalizeRuntimeModulePath(root, id), root)
  const transformed = new Map<string, string>()
  let outputDirectory = ''
  return {
    name: 'capture-published-consumer-attribution',
    enforce: 'post',
    configResolved(config) {
      outputDirectory = path.resolve(root, config.build.outDir)
    },
    transform(code, id) {
      if (id.startsWith(`${root}${path.sep}src${path.sep}`) && /\.(?:[cm]?[jt]sx?|vue)(?:\?|$)/.test(id)) {
        transformed.set(normalize(id), normalizeConsumerDiagnostic(code, root))
      }
    },
    async writeBundle(_options, bundle) {
      const files: PackageFileEntry[] = []
      const moduleIds = new Set(this.getModuleIds())
      for (const output of Object.values(bundle)) {
        const contents = await readFile(path.join(outputDirectory, output.fileName))
        const modules = output.type === 'chunk'
          ? Object.entries(output.modules).map(([id, detail]) => {
              if (path.isAbsolute(id) && !id.startsWith(`${root}${path.sep}`)) {
                throw new Error('Rendered module escapes the installed consumer tree.')
              }
              moduleIds.add(id)
              return {
                id,
                source: normalize(id),
                sourceType: id.startsWith(`${root}${path.sep}src${path.sep}`) ? 'src' as const : 'node_modules' as const,
                bytes: detail.renderedLength,
              }
            })
          : undefined
        files.push({ file: output.fileName, type: output.type, from: 'main', size: contents.byteLength, sha256: createHash('sha256').update(contents).digest('hex'), modules, moduleRenderedLength: modules?.reduce((sum, module) => sum + (module.bytes ?? 0), 0) })
      }
      // 源码图必须包含零输出中间节点；模块字节仍仅由上面的实际输出清单决定。
      const graph = []
      for (const id of moduleIds) {
        if (path.isAbsolute(id) && !id.startsWith(`${root}${path.sep}`)) {
          throw new Error('Source module escapes the installed consumer tree.')
        }
        const info = this.getModuleInfo(id)
        if (!info) {
          throw new Error('Cannot capture consumer source import graph: module metadata is missing.')
        }
        for (const imported of [...info.importedIds, ...info.dynamicallyImportedIds]) {
          moduleIds.add(imported)
        }
        graph.push({
          source: normalize(id),
          isEntry: info.isEntry,
          isExternal: info.isExternal,
          imports: [...new Set(info.importedIds.map(normalize))].sort(compareStrings),
          dynamicImports: [...new Set(info.dynamicallyImportedIds.map(normalize))].sort(compareStrings),
        })
      }
      graph.sort((left, right) => compareStrings(left.source, right.source))
      const analysis = createArtifactAnalysis([{ id: 'main', label: 'main', type: 'main', files }])
      const categories: Record<string, number> = {}
      const facets: Record<string, number> = {}
      for (const artifact of analysis.files) {
        for (const module of artifact.modules) {
          categories[module.category] = (categories[module.category] ?? 0) + module.estimatedBytes
          const facet = runtimeModuleFacet(module.source, module.package, module.category)
          facets[facet] = (facets[facet] ?? 0) + module.estimatedBytes
        }
      }
      const lockfile = process.env.RUNTIME_ATTRIBUTION_LOCKFILE ?? 'package-lock.json'
      if (!['pnpm-lock.yaml', 'package-lock.json'].includes(lockfile)) {
        throw new Error('Unsupported consumer lockfile')
      }
      const lock = await readFile(path.join(root, lockfile), 'utf8')
      const packages = []
      for (const name of ['weapp-vite', 'wevu']) {
        const manifestFile = await realpath(path.join(root, 'node_modules', name, 'package.json'))
        if (!manifestFile.startsWith(`${root}${path.sep}node_modules${path.sep}`)) {
          throw new Error(`Consumer package escapes installed tree: ${name}`)
        }
        const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as { version: string }
        packages.push({ name, version: manifest.version, manifest: normalize(manifestFile) })
      }
      await writeFile(path.join(root, 'consumer-attribution.json'), `${JSON.stringify({
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        node: process.version,
        lockfile,
        lockSha256: createHash('sha256').update(lock).digest('hex'),
        packages,
        categories,
        facets,
        artifacts: analysis,
        graphKind: 'source-imports',
        graph,
        compilerOutput: [...transformed].map(([source, code]) => ({ source, code })),
      }, null, 2)}\n`)
    },
  }
}
