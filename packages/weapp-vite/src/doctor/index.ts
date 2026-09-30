import type { DoctorAdapters, DoctorArtifactSnapshot, DoctorOptions, DoctorReport } from './types'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { getProjectPlatformOptions, resolveMiniPlatform } from '../platform'
import { checkDoctorArtifact } from './artifact'
import { buildDoctorSnapshot } from './build'
import { parseObject, readDoctorFiles } from './files'
import { addDiagnostic, finishReport } from './report'
import { probeDoctorRuntime } from './runtime'
import { checkDoctorScripts, incompleteCoverage } from './source'

export { formatDoctorReport } from './report'
export type * from './types'

/** 分层收集事实；静态路径永不调用配置加载器、构建或宿主连接。 */
export async function runDoctor(options: DoctorOptions = {}, adapters: Partial<DoctorAdapters> = {}): Promise<DoctorReport> {
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const report: DoctorReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    targets: [...new Set(options.targets ?? ['weapp'])],
    coverage: [],
    diagnostics: [],
    artifacts: {},
    runtime: {},
    exitCode: 0,
  }
  for (const requested of report.targets) {
    const target = resolveMiniPlatform(requested)
    if (!target) {
      incompleteCoverage(report, requested, 'project', 'target', '当前编译器没有注册该目标。')
      continue
    }
    const configName = getProjectPlatformOptions(target).projectConfigFileName
    for (const file of ['package.json', configName]) {
      try {
        parseObject(await readFile(path.join(cwd, file), 'utf8'))
        report.coverage.push({ target, layer: 'project', check: file, status: 'complete', reason: '只读 JSON 结构；未执行项目配置或插件。' })
      }
      catch {
        incompleteCoverage(report, target, 'project', file, '文件缺失、不可读或不是合法 JSON 对象。')
      }
    }
    let sourceRoot = options.source
    if (options.build && options.artifact) {
      incompleteCoverage(report, target, 'artifact', 'selection', 'build 与 artifact 不能同时选择。')
    }
    else if (options.build || options.artifact) {
      try {
        const snapshot: DoctorArtifactSnapshot = options.build
          ? await (adapters.build ?? buildDoctorSnapshot)({ ...options, cwd }, target)
          : { files: await readDoctorFiles(path.resolve(cwd, options.artifact!)), origin: 'existing' as const, capturedAt: new Date().toISOString(), freshness: 'unverified' as const }
        report.artifacts[target] = { ...snapshot, files: snapshot.files.map(({ text: _text, ...file }) => file) }
        sourceRoot ??= snapshot.sourceRoot
        for (const limitation of snapshot.limitations ?? []) {
          incompleteCoverage(report, target, 'artifact', 'compiler-scope', limitation)
        }
        checkDoctorArtifact(report, target, snapshot)
      }
      catch {
        incompleteCoverage(report, target, 'artifact', 'collection', '构建或最终产物快照失败；没有采用旧产物作为本轮通过证据。')
      }
    }
    else {
      report.coverage.push({ target, layer: 'artifact', check: 'collection', status: 'not-requested' })
    }
    try {
      const files = await readDoctorFiles(path.resolve(cwd, sourceRoot ?? 'src'), true)
      checkDoctorScripts(report, target, files, 'source')
    }
    catch {
      incompleteCoverage(report, target, 'source', 'scan', '源码目录无法完整读取；可用 source 显式指定目录。')
    }
    if (options.runtime) {
      try {
        report.runtime[target] = await (adapters.runtime ?? probeDoctorRuntime)(cwd, target, options.runtimePort)
        report.coverage.push({ target, layer: 'runtime', check: 'connected-page-snapshot', status: 'complete', reason: '仅证明工具信息和当前页面可读取；不代表完整应用功能验收。' })
      }
      catch {
        incompleteCoverage(report, target, 'runtime', 'connected-page-snapshot', '没有可连接的受支持宿主或探针执行失败；请先打开目标项目并启用服务端口。')
      }
    }
    else {
      report.coverage.push({ target, layer: 'runtime', check: 'connected-page-snapshot', status: 'not-requested' })
    }
  }
  if (!report.targets.length) {
    incompleteCoverage(report, 'unknown', 'project', 'target', '至少需要一个注册目标。')
  }
  if (options.build && options.artifact) {
    addDiagnostic(report, {
      ruleId: 'doctor/options',
      target: 'all',
      layer: 'project',
      severity: 'error',
      message: 'build 与 artifact 不能同时选择',
      evidence: { expected: '一个产物来源', actual: '两个产物来源' },
      responsibility: { owner: 'project', confidence: 'confirmed' },
      suggestion: '选择重新构建或复用目录。',
    })
  }
  return finishReport(report)
}
