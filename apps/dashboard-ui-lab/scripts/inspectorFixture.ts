import type { AnalyzeSubpackagesResult, ModuleInFile, ModuleUsage, PackageFileEntry, PackageReport } from '../../../packages/weapp-vite/src/analyze/subpackages/types'
import { Buffer } from 'node:buffer'
import { createDashboardArtifactSnapshot } from '../../../packages/weapp-vite/src/cli/analyze/dashboardDevframe/artifacts'

export const FIXTURE_PROJECT_NAME = 'dashboard-ui-lab · Inspector fixture (synthetic report)'
export const SELECTED_SOURCE = 'inspector/selected-module.ts'
export const SELECTED_FILE = 'inspector.js'
export const LONG_FILE = 'inspector/long-path/navigation-and-layout/retained-selection-and-identity/user-scroll-takes-priority/closed-sections-and-unread/inspector-with-a-long-artifact-name.js'

export interface InspectorFixtureState {
  relatedVersion: number
  unrelatedVersion: number
  expanded: boolean
  selectedDeleted: boolean
  sourceMissing: boolean
}

export function createBaselineState(): InspectorFixtureState {
  return {
    relatedVersion: 0,
    unrelatedVersion: 0,
    expanded: false,
    selectedDeleted: false,
    sourceMissing: false,
  }
}

/** 构造明确标记的实验报告；产物仅保留在分析快照中，不写入真实构建目录。 */
export function createInspectorFixture(state: InspectorFixtureState, generatedAt: string) {
  const sources = new Map<string, string>()
  const artifacts = createDashboardArtifactSnapshot()

  function source(sourcePath: string, exportName: string, version = 0, lineCount = 6): ModuleInFile {
    const content = [
      '// dashboard-ui-lab Inspector fixture: synthetic source, not application code.',
      `export const ${exportName} = {`,
      `  version: ${version},`,
      ...Array.from({ length: lineCount }, (_, index) => `  row${index}: 'Inspector fixture row ${index}, version ${version}',`),
      '}\n',
    ].join('\n')
    sources.set(sourcePath, content)
    const bytes = Buffer.byteLength(content)
    return { id: sourcePath, source: sourcePath, sourceType: 'src', bytes, originalBytes: bytes }
  }

  function chunk(file: string, modules: ModuleInFile[], options: {
    independent?: boolean
    entry?: boolean
    imports?: string[]
    dynamicImports?: string[]
  } = {}): PackageFileEntry {
    const content = [
      '// dashboard-ui-lab Inspector fixture: in-memory artifact, not build output.',
      ...(options.imports ?? []).map(value => `import ${JSON.stringify(value)};`),
      ...(options.dynamicImports ?? []).map(value => `import(${JSON.stringify(value)});`),
      ...modules.map(module => sources.get(module.source)),
    ].join('\n')
    artifacts.capture(file, content)
    return {
      file,
      type: 'chunk',
      from: options.independent ? 'independent' : 'main',
      isEntry: options.entry ?? false,
      size: Buffer.byteLength(content),
      imports: options.imports ?? [],
      dynamicImports: options.dynamicImports ?? [],
      modules,
      source: modules[0]?.source,
      sourceType: 'src',
    }
  }

  const selected = state.selectedDeleted
    ? []
    : [source(SELECTED_SOURCE, 'selectedFixture', state.relatedVersion, 24 + state.relatedVersion * 3)]
  const helper = source('inspector/helper.ts', 'helperFixture')
  const extraModules = state.expanded
    ? Array.from({ length: 72 }, (_, index) => source(`inspector/nodes/node-${String(index + 1).padStart(3, '0')}.ts`, `nodeFixture${index}`))
    : []
  const mainFiles = [
    chunk(SELECTED_FILE, [...selected, helper, ...extraModules], {
      entry: true,
      imports: ['./shared/base.js'],
      dynamicImports: state.relatedVersion > 0 ? ['./shared/detail.js'] : [],
    }),
    chunk('shared/base.js', [helper]),
  ]
  if (state.relatedVersion > 0) {
    mainFiles.push(chunk('shared/detail.js', [source('inspector/detail.ts', 'detailFixture')]))
  }
  if (state.expanded) {
    // 长路径只作为内存产物键；磁盘源码使用短路径，避免 Windows 路径长度限制。
    mainFiles.push(chunk(LONG_FILE, [source('inspector/long-title.ts', 'longTitleFixture', 0, 120)]))
  }

  const consumerCount = (state.expanded ? 96 : 18) + state.relatedVersion
  const consumerFiles = Array.from({ length: consumerCount }, (_, index) => {
    const name = `consumer-${String(index + 1).padStart(3, '0')}`
    return chunk(`packages/inspector/${name}.js`, [
      ...selected,
      source(`inspector/consumers/${name}.ts`, `consumerFixture${index}`),
    ], { entry: true })
  })
  const packages: PackageReport[] = [
    { id: '__main__', label: 'Inspector fixture · 主包', type: 'main', files: mainFiles },
    { id: 'packages/inspector', label: 'Inspector fixture · 关联分包', type: 'subPackage', files: consumerFiles },
    {
      id: 'packages/unrelated',
      label: 'Inspector fixture · 无关独立包',
      type: 'independent',
      files: [chunk('packages/unrelated/independent.js', [
        source('inspector/unrelated.ts', 'unrelatedFixture', state.unrelatedVersion, 8 + state.unrelatedVersion * 2),
      ], { independent: true, entry: true })],
    },
  ]

  const modules = new Map<string, ModuleUsage>()
  for (const pkg of packages) {
    for (const file of pkg.files) {
      for (const module of file.modules ?? []) {
        let usage = modules.get(module.id)
        if (!usage) {
          usage = { id: module.id, source: module.source, sourceType: module.sourceType, packages: [] }
          modules.set(module.id, usage)
        }
        let placement = usage.packages.find(item => item.packageId === pkg.id)
        if (!placement) {
          placement = { packageId: pkg.id, files: [] }
          usage.packages.push(placement)
        }
        placement.files.push(file.file)
      }
    }
  }

  const result: AnalyzeSubpackagesResult = {
    metadata: {
      projectName: FIXTURE_PROJECT_NAME,
      generatedAt,
      budgets: {
        totalBytes: 20 * 1024 * 1024,
        mainBytes: 2 * 1024 * 1024,
        subPackageBytes: 2 * 1024 * 1024,
        independentBytes: 2 * 1024 * 1024,
        warningRatio: 0.85,
        source: 'default',
      },
      history: { enabled: false, dir: '.weapp-vite/analyze-history', limit: 20 },
    },
    packages,
    modules: [...modules.values()],
    subPackages: [
      { root: 'packages/inspector', independent: false, name: 'Inspector fixture · 关联分包' },
      { root: 'packages/unrelated', independent: true, name: 'Inspector fixture · 无关独立包' },
    ],
    glassEasel: {
      detected: false,
      minimumBaseLibrary: '3.8.12',
      migrationGuide: '',
      diagnostics: [],
      summary: { errors: 0, warnings: 0 },
    },
  }
  if (state.sourceMissing) {
    sources.delete(SELECTED_SOURCE)
  }
  return { result, artifacts: artifacts.files, sources }
}
