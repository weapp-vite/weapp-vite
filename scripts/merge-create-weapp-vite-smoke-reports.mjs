import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

function formatMs(value) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value} ms` : '-'
}

function cell(value) {
  return String(value ?? '-').replaceAll('|', '&#124;').replace(/\r?\n/g, '<br>')
}

async function findReportFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => [])
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...await findReportFiles(fullPath))
    }
    else if (entry.name.endsWith('.json')) {
      files.push(fullPath)
    }
  }
  return files.sort()
}

export function mergeSmokeReports(reports) {
  const attach = (report, row) => ({ os: report.os, nodeVersion: report.nodeVersion, artifact: report.artifact ?? 'registry', cacheMode: report.cacheMode ?? 'unknown', ...row })
  const rows = reports.flatMap(report => (report.results ?? []).map(result => attach(report, result)))
  const failures = reports.flatMap(report => (report.failures ?? []).map(failure => attach(report, failure)))
  const registries = reports.flatMap(report => (report.registries ?? []).map(registry => attach(report, registry)))
  const summaries = reports.map(report => attach(report, report.summary ?? {}))
  rows.sort((a, b) => ['os', 'nodeVersion', 'registryProfile', 'scenario', 'template'].reduce((order, key) => order || String(a[key] ?? '').localeCompare(String(b[key] ?? '')), 0))
  return { rows, failures, registries, summaries }
}

export function renderSmokeReport({ rows, failures, registries, summaries }) {
  const markdown = [
    '# Create Weapp Vite Smoke Report',
    '',
    `Completed scenarios: ${rows.length}`,
    `Product failures: ${failures.filter(failure => failure.kind === 'product' || !failure.kind).length}`,
    `Network/environment failures: ${failures.filter(failure => failure.kind === 'network').length}`,
    `Registry package/version unavailable: ${failures.filter(failure => failure.kind === 'registry-unavailable').length}`,
    '',
    ...summaries.map(summary => `- ${cell(summary.os)} / Node ${cell(summary.nodeVersion)} / Cache ${cell(summary.cacheMode)}: ${cell(summary.status ?? 'legacy report')}`),
    '',
    '| OS | Node | Cache | Registry | Registry version | Actual scaffold versions | Official expected | Synchronization |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...registries.map(registry => `| ${cell(registry.os)} | ${cell(registry.nodeVersion)} | ${cell(registry.cacheMode)} | ${cell(registry.name)} | ${cell(registry.resolvedVersion)} | ${cell(registry.actualVersions?.join(', '))} | ${cell(registry.expectedOfficialVersion)} | ${cell(registry.lag)} |`),
    '',
    '| OS | Node | Cache | Registry | Manager | Template | Actual scaffold | Official expected | Lag | Install | Build | Dev ready | Dev update |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(row => `| ${cell(row.os)} | ${cell(row.nodeVersion)} | ${cell(row.cacheMode)} | ${cell(row.registryProfile)} | ${cell(row.scenario)} | ${cell(row.template)} | ${cell(row.actualCreateVersion)} | ${cell(row.expectedOfficialVersion)} | ${cell(row.lag)} | ${formatMs(row.installMs)} | ${formatMs(row.buildMs)} | ${formatMs(row.devReadyMs)} | ${formatMs(row.devUpdateMs)} |`),
  ]
  if (failures.length) {
    markdown.push('', '## Failures', '', '| OS | Node | Cache | Registry | Manager | Template | Stage | Kind | Actual scaffold | Error |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
    markdown.push(...failures.map(failure => `| ${cell(failure.os)} | ${cell(failure.nodeVersion)} | ${cell(failure.cacheMode)} | ${cell(failure.registryProfile)} | ${cell(failure.scenario)} | ${cell(failure.template)} | ${cell(failure.stage)} | ${cell(failure.kind ?? 'product')} | ${cell(failure.actualCreateVersion)} | ${cell(failure.error)} |`))
  }
  if (!rows.length && !failures.length) {
    markdown.push('', 'No smoke report artifacts were found.')
  }
  return `${markdown.join('\n')}\n`
}

async function main() {
  const [reportsDir, outputDir] = process.argv.slice(2)
  if (!reportsDir || !outputDir) {
    throw new Error('Usage: node scripts/merge-create-weapp-vite-smoke-reports.mjs <reportsDir> <outputDir>')
  }
  const files = await findReportFiles(reportsDir)
  const reports = await Promise.all(files.map(async file => JSON.parse(await fs.readFile(file, 'utf8'))))
  const merged = mergeSmokeReports(reports)
  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(path.join(outputDir, 'create-weapp-vite-smoke-report.md'), renderSmokeReport(merged))
  await fs.writeFile(path.join(outputDir, 'create-weapp-vite-smoke-report.json'), `${JSON.stringify(merged, null, 2)}\n`)
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main()
}
