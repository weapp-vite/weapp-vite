import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { assertTemplatesPerformanceComplete } from './templates-performance-integrity'

const directory = process.env.TEMPLATES_PERF_REPORT_DIR
if (!directory) {
  throw new Error('TEMPLATES_PERF_REPORT_DIR is required')
}
const report: unknown = JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8'))
const markdown = await readFile(path.join(directory, 'report.md'), 'utf8')
if (!markdown.trim()) {
  throw new Error('Templates performance Markdown report is empty')
}
assertTemplatesPerformanceComplete(report)
process.stdout.write('Templates performance reports are complete and all benchmark cases succeeded.\n')
