import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 与仓库 coverage manifest 的 glob 语义保持一致。
import fg from 'fast-glob'

const ROOT = path.resolve(import.meta.dirname, '..')
const METRICS = ['lines', 'statements', 'functions', 'branches'] as const

interface CoverageMetric {
  pct: number
}

interface CoverageEntry {
  lines: CoverageMetric
  statements: CoverageMetric
  functions: CoverageMetric
  branches: CoverageMetric
}

interface CoverageSummary extends CoverageEntry {
  total?: CoverageEntry
}

interface CoverageProject {
  label: string
  report: string
  source: string | string[]
}

interface CoverageLocation {
  start: { column: number, line: number }
}

interface FileCoverageDetails {
  b: Record<string, number[]>
  branchMap: Record<string, { locations: CoverageLocation[], type: string }>
  f: Record<string, number>
  fnMap: Record<string, { loc: CoverageLocation, name: string }>
  s: Record<string, number>
  statementMap: Record<string, CoverageLocation>
}

const projects: CoverageProject[] = [
  {
    label: '@weapp-vite/web',
    report: 'coverage/packages-runtime/web/coverage-summary.json',
    source: 'packages-runtime/web/src/**/*.ts',
  },
  {
    label: '@wevu/web-apis',
    report: 'coverage/packages-runtime/web-apis/coverage-summary.json',
    source: 'packages-runtime/web-apis/src/**/*.ts',
  },
  {
    label: 'weapp-vite Web entrypoints',
    report: 'coverage/packages/weapp-vite/web/coverage-summary.json',
    source: [
      'packages/weapp-vite/src/backends/index.ts',
      'packages/weapp-vite/src/backends/miniprogram.ts',
      'packages/weapp-vite/src/backends/registry.ts',
      'packages/weapp-vite/src/backends/web.ts',
      'packages/weapp-vite/src/cli/commands/analyze.ts',
      'packages/weapp-vite/src/cli/commands/build.ts',
      'packages/weapp-vite/src/cli/commands/open.ts',
      'packages/weapp-vite/src/cli/commands/serve/index.ts',
      'packages/weapp-vite/src/runtime/config/internal/merge/index.ts',
      'packages/weapp-vite/src/runtime/config/internal/merge/web.ts',
      'packages/weapp-vite/src/runtime/webPlugin.ts',
      'packages/weapp-vite/src/runtimeTarget.ts',
    ],
  },
]

function normalize(filename: string) {
  return path.resolve(filename)
}

function getMetric(entry: CoverageEntry, metric: typeof METRICS[number]) {
  return entry[metric].pct
}

async function readSummary(project: CoverageProject) {
  const filename = path.join(ROOT, project.report)
  const source = await fs.readFile(filename, 'utf8')
  return JSON.parse(source) as Record<string, CoverageSummary>
}

async function readDetails(project: CoverageProject) {
  const filename = path.join(ROOT, path.dirname(project.report), 'coverage-final.json')
  const source = await fs.readFile(filename, 'utf8')
  return JSON.parse(source) as Record<string, FileCoverageDetails>
}

function uniqueSorted(values: number[]) {
  return [...new Set(values)].sort((left, right) => left - right)
}

function formatUncoveredDetails(details: FileCoverageDetails | undefined) {
  if (!details) {
    return ['缺少 coverage-final.json 文件详情。']
  }
  const lines = uniqueSorted(Object.entries(details.s)
    .filter(([, count]) => count === 0)
    .map(([id]) => details.statementMap[id]?.start.line)
    .filter((line): line is number => typeof line === 'number'))
  const functions = Object.entries(details.f)
    .filter(([, count]) => count === 0)
    .map(([id]) => {
      const entry = details.fnMap[id]
      return entry ? `${entry.name || '<anonymous>'}@${entry.loc.start.line}` : id
    })
  const branches = Object.entries(details.b).flatMap(([id, counts]) => {
    const entry = details.branchMap[id]
    return counts.flatMap((count, index) => {
      if (count !== 0) {
        return []
      }
      const location = entry?.locations[index]?.start
      return [`${entry?.type ?? 'branch'}#${index}@${location?.line ?? '?'}:${location?.column ?? '?'}`]
    })
  })
  return [
    ...(lines.length ? [`未覆盖行: ${lines.join(', ')}`] : []),
    ...(functions.length ? [`未覆盖函数: ${functions.join(', ')}`] : []),
    ...(branches.length ? [`未覆盖分支: ${branches.join(', ')}`] : []),
  ]
}

async function checkProject(project: CoverageProject) {
  const summary = await readSummary(project)
  const coverageDetails = await readDetails(project)
  const failures: string[] = []
  const total = summary.total
  if (!total) {
    failures.push('缺少 total 覆盖率摘要。')
  }
  else {
    for (const metric of METRICS) {
      if (getMetric(total, metric) !== 100) {
        failures.push(`total ${metric}=${getMetric(total, metric)}%`)
      }
    }
  }

  const coveredFiles = new Set(
    Object.keys(summary)
      .filter(filename => filename !== 'total')
      .map(normalize),
  )
  const sourceFiles = await fg(project.source, {
    cwd: ROOT,
    absolute: true,
    onlyFiles: true,
    ignore: ['**/*.test.ts', '**/*.spec.ts', '**/*.d.ts'],
  })
  for (const filename of sourceFiles) {
    if (!coveredFiles.has(normalize(filename))) {
      failures.push(`未进入覆盖率报告: ${path.relative(ROOT, filename)}`)
    }
  }

  for (const [filename, entry] of Object.entries(summary)) {
    if (filename === 'total') {
      continue
    }
    const failedMetrics = METRICS
      .filter(metric => getMetric(entry, metric) !== 100)
      .map(metric => `${metric}=${getMetric(entry, metric)}%`)
    if (failedMetrics.length) {
      const details = coverageDetails[filename] ?? coverageDetails[normalize(filename)]
      failures.push([
        `${path.relative(ROOT, filename)} ${failedMetrics.join(' ')}`,
        ...formatUncoveredDetails(details).map(detail => `  ${detail}`),
      ].join('\n'))
    }
  }

  if (failures.length) {
    return failures
  }
  process.stdout.write(`[web-coverage] ${project.label}: 100%\n`)
  return []
}

const projectFailures: string[] = []
for (const project of projects) {
  const failures = await checkProject(project)
  if (failures.length) {
    projectFailures.push(`[${project.label}]\n${failures.join('\n')}`)
  }
}

if (projectFailures.length) {
  throw new Error(`Web coverage gate failed:\n${projectFailures.join('\n\n')}`)
}
