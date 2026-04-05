import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const reportsDir = process.argv[2]
const outputDir = process.argv[3]
const NEWLINE_GLOBAL_RE = /\n/g

if (!reportsDir || !outputDir) {
  console.error('Usage: node scripts/merge-create-weapp-vite-smoke-reports.mjs <reportsDir> <outputDir>')
  process.exit(1)
}

function formatMs(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-'
  }
  return `${value} ms`
}

async function findReportFiles(root) {
  try {
    await fs.access(root)
  }
  catch {
    return []
  }

  const entries = await fs.readdir(root, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...await findReportFiles(fullPath))
      continue
    }
    if (entry.name.endsWith('.json')) {
      files.push(fullPath)
    }
  }
  return files.sort()
}

async function main() {
  const files = await findReportFiles(reportsDir)
  if (files.length === 0) {
    await fs.mkdir(outputDir, { recursive: true })
    const emptyMarkdown = [
      '# Create Weapp Vite Smoke Report',
      '',
      'Rows: 0',
      'Failures: 0',
      '',
      'No smoke report artifacts were found.',
      '',
      `Source directory: \`${reportsDir}\``,
    ]
    await fs.writeFile(path.join(outputDir, 'create-weapp-vite-smoke-report.md'), `${emptyMarkdown.join('\n')}\n`, 'utf8')
    await fs.writeFile(path.join(outputDir, 'create-weapp-vite-smoke-report.json'), `${JSON.stringify({ rows: [], failures: [] }, null, 2)}\n`, 'utf8')
    return
  }

  const reports = await Promise.all(files.map(async file => JSON.parse(await fs.readFile(file, 'utf8'))))
  const rows = reports.flatMap(report =>
    report.results.map(result => ({
      os: report.os,
      nodeVersion: report.nodeVersion,
      scenario: result.scenario,
      template: result.template,
      buildMs: result.buildMs,
      devReadyMs: result.devReadyMs,
      devUpdateMs: result.devUpdateMs,
    })),
  )
  const failures = reports.flatMap(report =>
    report.failures.map(failure => ({
      os: report.os,
      nodeVersion: report.nodeVersion,
      scenario: failure.scenario,
      template: failure.template,
      error: failure.error,
    })),
  )

  rows.sort((a, b) => (
    a.os.localeCompare(b.os)
    || a.nodeVersion.localeCompare(b.nodeVersion)
    || a.scenario.localeCompare(b.scenario)
    || a.template.localeCompare(b.template)
  ))

  const markdown = [
    '# Create Weapp Vite Smoke Report',
    '',
    `Rows: ${rows.length}`,
    `Failures: ${failures.length}`,
    '',
    '| OS | Node | Runtime | Template | Build | Dev Ready | Dev Update |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(row => `| ${row.os} | ${row.nodeVersion} | ${row.scenario} | ${row.template} | ${formatMs(row.buildMs)} | ${formatMs(row.devReadyMs)} | ${formatMs(row.devUpdateMs)} |`),
  ]

  if (failures.length > 0) {
    markdown.push('', '## Failures', '', '| OS | Node | Runtime | Template | Error |', '| --- | --- | --- | --- | --- |')
    markdown.push(...failures.map(failure => `| ${failure.os} | ${failure.nodeVersion} | ${failure.scenario} | ${failure.template} | ${failure.error.replace(NEWLINE_GLOBAL_RE, '<br>')} |`))
  }

  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(path.join(outputDir, 'create-weapp-vite-smoke-report.md'), `${markdown.join('\n')}\n`, 'utf8')
  await fs.writeFile(path.join(outputDir, 'create-weapp-vite-smoke-report.json'), `${JSON.stringify({ rows, failures }, null, 2)}\n`, 'utf8')
}

await main()
