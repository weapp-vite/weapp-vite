import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

interface CoverageLocation { start: { line: number, column: number }, end: { line: number, column: number } }
interface FileCoverage {
  path: string
  statementMap: Record<string, CoverageLocation>
  fnMap: Record<string, { loc: CoverageLocation }>
  branchMap: Record<string, { locations: CoverageLocation[] }>
  s: Record<string, number>
  f: Record<string, number>
  b: Record<string, number[]>
}

export interface CoverageCount { covered: number, total: number }
export interface CoverageCounts { statements: CoverageCount, functions: CoverageCount, branches: CoverageCount, lines: CoverageCount }
export interface CoverageGap { metric: keyof CoverageCounts, line: number, column: number, id: string }
export interface CoverageFileReport { file: string, counts: CoverageCounts, gaps: CoverageGap[] }
export interface StrictCoverageReport {
  accepted: boolean
  thresholds: { statements: 100, functions: 100, lines: 100, branches: 99 }
  productionFiles: string[]
  missingFiles: string[]
  unexpectedFiles: string[]
  ignoredFiles: string[]
  totals: CoverageCounts
  files: CoverageFileReport[]
}

function emptyCounts(): CoverageCounts {
  return { statements: { covered: 0, total: 0 }, functions: { covered: 0, total: 0 }, branches: { covered: 0, total: 0 }, lines: { covered: 0, total: 0 } }
}

function normalized(value: string) {
  return value.split(path.sep).join('/')
}

/** 完整枚举生产源码，测试与纯声明不属于可执行分母。 */
export async function productionFiles(sourceDirectory: string): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(sourceDirectory, { withFileTypes: true })
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const file = path.join(sourceDirectory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await productionFiles(file))
    }
    else if (entry.isFile() && file.endsWith('.ts') && !/\.(?:test|spec|d)\.ts$/.test(file)) {
      files.push(file)
    }
  }
  return files
}

function inspectFile(file: string, coverage: FileCoverage): CoverageFileReport {
  const counts = emptyCounts()
  const gaps: CoverageGap[] = []
  const add = (metric: keyof CoverageCounts, hit: number, id: string, location?: CoverageLocation) => {
    if (!Number.isSafeInteger(hit) || hit < 0) {
      throw new TypeError(`Invalid raw coverage hit in ${file}: ${metric}/${id}`)
    }
    counts[metric].total++
    if (hit > 0) {
      counts[metric].covered++
    }
    else {
      gaps.push({ metric, id, line: location?.start.line ?? 0, column: location?.start.column ?? 0 })
    }
  }
  const lineHits = new Map<number, number>()
  for (const [id, location] of Object.entries(coverage.statementMap)) {
    const hit = coverage.s[id]
    if (hit === undefined) {
      throw new TypeError(`Missing statement coverage hit: ${file}/${id}`)
    }
    add('statements', hit, id, location)
    lineHits.set(location.start.line, Math.max(lineHits.get(location.start.line) ?? 0, hit))
  }
  for (const [line, hit] of lineHits) {
    add('lines', hit, String(line), { start: { line, column: 0 }, end: { line, column: 0 } })
  }
  for (const [id, fn] of Object.entries(coverage.fnMap)) {
    add('functions', coverage.f[id] ?? Number.NaN, id, fn.loc)
  }
  for (const [id, branch] of Object.entries(coverage.branchMap)) {
    const hits = coverage.b[id]
    if (!hits || hits.length !== branch.locations.length) {
      throw new TypeError(`Missing branch coverage hits: ${file}/${id}`)
    }
    hits.forEach((hit, index) => add('branches', hit, `${id}/${index}`, branch.locations[index]))
  }
  return { file, counts, gaps }
}

/** 阈值用原始整数比较，四舍五入的百分比无法掩盖未命中项。 */
export async function auditCoverage(sourceDirectory: string, reportFile: string): Promise<StrictCoverageReport> {
  const sourceRoot = path.resolve(sourceDirectory)
  const listed = await productionFiles(sourceRoot)
  const raw = JSON.parse(await readFile(reportFile, 'utf8')) as unknown
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError('Expected Istanbul coverage-final.json object.')
  }
  const records = new Map(Object.entries(raw).map(([file, record]) => [path.resolve(file), record as FileCoverage]))
  const production = new Set(listed)
  const report: StrictCoverageReport = { accepted: false, thresholds: { statements: 100, functions: 100, lines: 100, branches: 99 }, productionFiles: listed.map(file => normalized(path.relative(sourceRoot, file))), missingFiles: [], unexpectedFiles: [], ignoredFiles: [], totals: emptyCounts(), files: [] }
  for (const file of listed) {
    const label = normalized(path.relative(sourceRoot, file))
    const source = await readFile(file, 'utf8')
    if (/\b(?:istanbul|c8|v8)\s+ignore\b/.test(source)) {
      report.ignoredFiles.push(label)
    }
    const record = records.get(file)
    if (!record) {
      report.missingFiles.push(label)
      continue
    }
    if (!record.statementMap || !record.fnMap || !record.branchMap || !record.s || !record.f || !record.b) {
      throw new TypeError(`Incomplete Istanbul file coverage: ${label}`)
    }
    const result = inspectFile(label, record)
    report.files.push(result)
    for (const metric of Object.keys(report.totals) as Array<keyof CoverageCounts>) {
      report.totals[metric].covered += result.counts[metric].covered
      report.totals[metric].total += result.counts[metric].total
    }
  }
  for (const file of records.keys()) {
    if (!production.has(file)) {
      report.unexpectedFiles.push(normalized(path.relative(sourceRoot, file)))
    }
  }
  report.accepted = report.missingFiles.length === 0 && report.ignoredFiles.length === 0 && listed.length > 0
    && (['statements', 'functions', 'lines'] as const).every(metric => report.totals[metric].covered === report.totals[metric].total)
    && report.totals.branches.covered * 100 >= report.totals.branches.total * 99
  return report
}
