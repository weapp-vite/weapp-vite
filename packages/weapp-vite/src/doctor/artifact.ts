import type { PackageReport } from '../analyze/subpackages/types'
import type { MpPlatform } from '../types'
import type { DoctorArtifactSnapshot, DoctorReport } from './types'
import { posix as path } from 'node:path'
import { classifyPackage } from '../analyze/subpackages/classifier'
import { createAnalyzeBudgetCheck } from '../dashboard/analyze'
import { getPlatformOutputExtensions } from '../platform'
import { objectValue, parseObject } from './files'
import { checkArtifactReferences } from './references'
import { addDiagnostic } from './report'
import { checkDoctorScripts, incompleteCoverage } from './source'

export function checkDoctorArtifact(report: DoctorReport, target: MpPlatform, snapshot: DoctorArtifactSnapshot) {
  const files = new Map(snapshot.files.map(file => [file.path, file]))
  const ext = getPlatformOutputExtensions(target)
  const fail = (rule: string, file: string, expected: string, actual: string) => addDiagnostic(report, {
    ruleId: `doctor/artifact/${rule}`,
    target,
    layer: 'artifact',
    severity: 'error',
    message: `${file}: ${expected}`,
    location: { file },
    evidence: { expected, actual },
    responsibility: { owner: 'unknown', confidence: 'confirmed' },
    suggestion: '比较来源声明和最终编译产物，确定配置、插件或编译器责任后补充最小回归。',
  })
  const readJson = (file: string) => {
    try {
      return parseObject(files.get(file)?.text)
    }
    catch {
      fail('json', file, '存在合法的 JSON 对象', files.has(file) ? '无法解析 JSON 对象' : '文件缺失')
      return undefined
    }
  }
  const app = readJson('app.json')
  if (!app) {
    incompleteCoverage(report, target, 'artifact', 'reachable-graph', 'app.json 不可读，无法遍历页面图。')
    return
  }
  if (!files.has(`app.${ext.js}`)) {
    fail('entry-file', `app.${ext.js}`, '应用入口脚本存在', '文件缺失')
  }
  const packages = Array.isArray(app.subPackages ?? app.subpackages) ? (app.subPackages ?? app.subpackages) as unknown[] : []
  if ((app.subPackages ?? app.subpackages) !== undefined && !Array.isArray(app.subPackages ?? app.subpackages)) {
    fail('subpackage', 'app.json', 'subPackages 为数组', '非法分包声明')
  }
  const subPackageRoots = new Set<string>()
  const independentRoots = new Set<string>()
  const pages: string[] = []
  const addPages = (value: unknown, root = '') => {
    if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
      fail('pages', 'app.json', 'pages 为字符串数组', '页面列表缺失或类型错误')
      return
    }
    for (const item of value as string[]) {
      pages.push(root ? `${root}/${item}` : item)
    }
  }
  addPages(app.pages)
  for (const value of packages) {
    const pkg = objectValue(value)
    if (!pkg || typeof pkg.root !== 'string' || !pkg.root || path.normalize(pkg.root) !== pkg.root || /^[./]/.test(pkg.root)) {
      fail('subpackage', 'app.json', '分包 root 为规范的相对路径', '非法分包声明')
      continue
    }
    subPackageRoots.add(pkg.root)
    if (pkg.independent === true) {
      independentRoots.add(pkg.root)
    }
    addPages(pkg.pages, pkg.root)
  }
  const classifier = { subPackageRoots, independentRoots }
  const checked = new Set<string>()
  const queued: Array<{ base: string, component: boolean }> = pages.map(base => ({ base, component: false }))
  const resolveReference = (owner: string, reference: string) => path.normalize(reference.startsWith('/')
    ? reference.slice(1)
    : path.join(path.dirname(owner), reference))
  const checkComponents = (owner: string, config: Record<string, unknown>) => {
    const components = objectValue(config.usingComponents)
    if (config.usingComponents !== undefined && !components) {
      fail('components', owner, 'usingComponents 为路径映射', '非法组件映射')
    }
    for (const [name, value] of Object.entries(components ?? {})) {
      if (typeof value !== 'string') {
        fail('components', owner, '组件引用为字符串', name)
        continue
      }
      if (/^[a-z]+:\/\//i.test(value)) {
        incompleteCoverage(report, target, 'artifact', 'external-component', '外部插件组件不在本地产物快照中。')
        continue
      }
      const base = resolveReference(owner, value)
      const from = classifyPackage(owner, 'main', classifier)
      const to = classifyPackage(base, 'main', classifier)
      if ((from.type === 'independent' && from.id !== to.id) || (to.type !== 'main' && from.id !== to.id)) {
        fail('package-boundary', owner, '组件引用不跨越独立包或其他分包边界', base)
      }
      queued.push({ base, component: true })
    }
  }
  checkComponents('app.json', app)
  while (queued.length) {
    const { base, component } = queued.shift()!
    if (base.startsWith('../') || base.startsWith('/') || path.normalize(base) !== base) {
      fail('path', 'app.json', '引用位于产物根目录内且已规范化', base)
      continue
    }
    if (checked.has(base)) {
      continue
    }
    checked.add(base)
    for (const extension of [ext.js, ext.json, ext.wxml]) {
      if (!files.has(`${base}.${extension}`)) {
        fail('entry-file', `${base}.${extension}`, '页面/组件的宿主必需文件存在', '文件缺失')
      }
    }
    const config = readJson(`${base}.${ext.json}`)
    if (config) {
      if (component && config.component !== true) {
        fail('component-flag', `${base}.${ext.json}`, '被引用的组件声明 component: true', '未声明组件')
      }
      checkComponents(`${base}.${ext.json}`, config)
    }
  }
  if (typeof app.workers === 'string' && !snapshot.files.some(file => file.path.startsWith(`${app.workers}/`) && file.path.endsWith(ext.js))) {
    fail('worker-root', 'app.json', 'workers 目录内有脚本产物', app.workers)
  }
  const packageMap = new Map<string, PackageReport>()
  for (const file of snapshot.files) {
    const pkg = classifyPackage(file.path, 'main', classifier)
    const current = packageMap.get(pkg.id) ?? { ...pkg, files: [] }
    current.files.push({ file: file.path, size: file.size, type: file.path.endsWith(ext.js) ? 'chunk' : 'asset', from: 'main' })
    packageMap.set(pkg.id, current)
  }
  if (snapshot.budgets) {
    for (const item of createAnalyzeBudgetCheck({
      packages: [...packageMap.values()],
      metadata: { generatedAt: snapshot.capturedAt, budgets: snapshot.budgets, history: { enabled: false, dir: '', limit: 0 } },
    })) {
      if (item.status === 'exceeded') {
        fail('budget', item.id, `包体不超过 ${item.limitBytes} 字节`, `${item.currentBytes} 字节`)
      }
    }
  }
  else {
    incompleteCoverage(report, target, 'artifact', 'budgets', '复用目录未提供编译器实际预算；不套用其他平台默认预算。')
  }
  report.coverage.push({ target, layer: 'artifact', check: 'pages-components-packages-workers', status: 'complete' })
  checkArtifactReferences(report, target, snapshot, classifier)
  checkDoctorScripts(report, target, snapshot.files, 'artifact')
}
