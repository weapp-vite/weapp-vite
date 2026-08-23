import type { DashboardTailwindScenario } from './scenarios'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import process from 'node:process'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'

export interface WorkerResult {
  buildMs: number
  createMs: number
  cssFile: string
  importMs: number
  scenario: DashboardTailwindScenario
}

interface CssSummary {
  bytes: number
  classCount: number
  dashboardVariableCount: number
  dataUriCount: number
  hasPageSelector: boolean
  iconCount: number
  sha256: string
  unresolvedDirectives: string[]
  selectorCount: number
}

interface BuildSample extends Omit<WorkerResult, 'cssFile'> {
  css: CssSummary
}

interface Stats {
  max: number
  mean: number
  median: number
  min: number
}

export interface ScenarioReport {
  classDiffFromOfficial: SetDiff
  samples: BuildSample[]
  selectorDiffFromOfficial: SetDiff
  stats: {
    buildMs: Stats
    createMs: Stats
    importMs: Stats
  }
}

interface SetDiff {
  extra: number
  missing: number
}

export interface AnalyzedBuild {
  classes: Set<string>
  icons: Set<string>
  sample: BuildSample
  selectors: Set<string>
}

function stats(values: number[]): Stats {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
  return {
    max: sorted[sorted.length - 1] ?? 0,
    mean: sorted.reduce((total, value) => total + value, 0) / sorted.length,
    median,
    min: sorted[0] ?? 0,
  }
}

function diffSet(actual: Set<string>, expected: Set<string>): SetDiff {
  return {
    extra: [...actual].filter(value => !expected.has(value)).length,
    missing: [...expected].filter(value => !actual.has(value)).length,
  }
}

export function assertEqualSets(
  actual: Set<string>,
  expected: Set<string>,
  description: string,
) {
  const diff = diffSet(actual, expected)
  if (diff.extra > 0 || diff.missing > 0) {
    throw new Error(`${description}: missing=${diff.missing} extra=${diff.extra}`)
  }
}

export function analyzeCss(css: string, scenario: DashboardTailwindScenario): AnalyzedBuild {
  const classes = new Set<string>()
  const dashboardVariables = new Set<string>()
  const selectors = new Set<string>()
  const root = postcss.parse(css)

  root.walkRules((rule) => {
    for (const selector of postcss.list.comma(rule.selector)) {
      const normalized = selector.replace(/\s+/g, ' ').trim()
      selectors.add(normalized)
      selectorParser((parsed) => {
        parsed.walkClasses(node => classes.add(node.value))
      }).processSync(normalized)
    }
  })
  root.walkDecls((declaration) => {
    if (declaration.prop.startsWith('--dashboard-')) {
      dashboardVariables.add(declaration.prop)
    }
  })

  const icons = new Set([...classes].filter(className => /^icon-\[mdi--[a-z0-9-]+\]$/.test(className)))
  const unresolvedDirectives = [
    /@import\s+['"]tailwindcss['"]/.test(css) ? '@import tailwindcss' : undefined,
    css.includes('@plugin') ? '@plugin' : undefined,
    css.includes('generator-placeholder') ? 'generator-placeholder' : undefined,
  ].filter((value): value is string => value !== undefined)

  return {
    classes,
    icons,
    sample: {
      buildMs: 0,
      createMs: 0,
      css: {
        bytes: Buffer.byteLength(css),
        classCount: classes.size,
        dashboardVariableCount: dashboardVariables.size,
        dataUriCount: css.match(/data:image\/svg\+xml/g)?.length ?? 0,
        hasPageSelector: selectors.has('page'),
        iconCount: icons.size,
        sha256: createHash('sha256').update(css).digest('hex'),
        unresolvedDirectives,
        selectorCount: selectors.size,
      },
      importMs: 0,
      scenario,
    },
    selectors,
  }
}

export function validateGeneratedCss(build: AnalyzedBuild, expectedIcons: Set<string>) {
  if (build.sample.css.unresolvedDirectives.length > 0) {
    throw new Error(`${build.sample.scenario} left unresolved directives: ${build.sample.css.unresolvedDirectives.join(', ')}`)
  }
  if (build.sample.css.dashboardVariableCount === 0) {
    throw new Error(`${build.sample.scenario} did not emit dashboard variables`)
  }
  assertEqualSets(build.icons, expectedIcons, `${build.sample.scenario} icon selectors`)
  if (build.sample.css.dataUriCount < expectedIcons.size) {
    throw new Error(`${build.sample.scenario} emitted ${build.sample.css.dataUriCount} SVG data URIs for ${expectedIcons.size} icons`)
  }
}

export function createScenarioReport(builds: AnalyzedBuild[], official: AnalyzedBuild): ScenarioReport {
  return {
    classDiffFromOfficial: diffSet(builds[0].classes, official.classes),
    samples: builds.map(build => build.sample),
    selectorDiffFromOfficial: diffSet(builds[0].selectors, official.selectors),
    stats: {
      buildMs: stats(builds.map(build => build.sample.buildMs)),
      createMs: stats(builds.map(build => build.sample.createMs)),
      importMs: stats(builds.map(build => build.sample.importMs)),
    },
  }
}

function formatRow(scenario: string, report: ScenarioReport) {
  const sample = report.samples[0]
  return [
    scenario.padEnd(34),
    report.stats.importMs.median.toFixed(1).padStart(9),
    report.stats.createMs.median.toFixed(1).padStart(9),
    report.stats.buildMs.median.toFixed(1).padStart(10),
    String(sample.css.bytes).padStart(9),
    String(sample.css.selectorCount).padStart(10),
    String(sample.css.classCount).padStart(8),
    String(sample.css.iconCount).padStart(6),
    `${report.selectorDiffFromOfficial.missing}/${report.selectorDiffFromOfficial.extra}`.padStart(11),
  ].join(' ')
}

export function printReports(reports: Record<string, ScenarioReport>) {
  process.stdout.write([
    'scenario                           import_ms create_ms   build_ms     bytes  selectors  classes  icons missing/extra',
    ...Object.entries(reports).map(([scenario, report]) => formatRow(scenario, report)),
    '',
  ].join('\n'))
}
