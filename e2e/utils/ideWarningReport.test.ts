import type { IdeReportEvent, IdeWarningReportPaths } from './ideWarningReport'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearRuntimeWarningLog,
  resolveReportProjectPath,
  writeIdeWarningReport,
} from './ideWarningReport'

function createTempReportPaths() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ide-warning-report-'))
  const reportDir = path.join(tempRoot, 'report')
  return {
    tempRoot,
    paths: {
      reportSlug: '2026-03-11-120000-ide-warning-report',
      reportDir,
      eventLogPath: path.join(tempRoot, 'events.jsonl'),
      reportMarkdownPath: path.join(reportDir, 'index.md'),
      reportJsonPath: path.join(reportDir, 'index.json'),
    } satisfies IdeWarningReportPaths,
  }
}

describe('ideWarningReport', () => {
  afterEach(() => {
    delete process.env.WEAPP_VITE_E2E_REPORT_MARKERS
    vi.restoreAllMocks()
  })

  it('resolves project paths relative to repository root', () => {
    const projectPath = path.resolve(process.cwd(), 'e2e-apps/github-issues')

    expect(resolveReportProjectPath(projectPath)).toBe('e2e-apps/github-issues')
  })

  it('writes index and per-project reports without absolute paths', () => {
    const { tempRoot, paths } = createTempReportPaths()
    const events: IdeReportEvent[] = [
      {
        source: 'build',
        kind: 'message',
        project: 'e2e-apps/github-issues',
        label: 'ide:github-issues',
        level: 'warn',
        channel: 'build',
        text: `\u001B[2K\rtransforming...[warn] [vue] some build warning at ${tempRoot}/src/app.vue`,
      },
      {
        source: 'build',
        kind: 'stats',
        project: 'e2e-apps/github-issues',
        label: 'ide:github-issues',
        warn: 1,
        error: 0,
        exit: 0,
      },
      {
        source: 'runtime',
        kind: 'message',
        project: 'e2e-apps/github-issues',
        level: 'warn',
        channel: 'runtime',
        text: '[Component] property "activeId" received type-uncompatible value: expected <String> but get null value. Use empty string instead.',
      },
      {
        source: 'runtime',
        kind: 'message',
        project: 'e2e-apps/github-issues',
        level: 'warn',
        channel: 'runtime',
        text: '[Component] property "root" received type-uncompatible value: expected <Object> but got non-object value. Used null instead.',
      },
      {
        source: 'runtime',
        kind: 'stats',
        project: 'e2e-apps/github-issues',
        warn: 2,
        error: 0,
        exception: 0,
        total: 2,
      },
      {
        source: 'runtime',
        kind: 'message',
        project: 'e2e-apps/wevu-features',
        level: 'warn',
        channel: 'runtime',
        text: '[Component] property "badgeStyle" received type-uncompatible value: expected <String> but get null value. Use empty string instead.',
      },
      {
        source: 'runtime',
        kind: 'message',
        project: 'e2e-apps/wevu-features',
        level: 'error',
        channel: 'launch',
        text: 'simulated launch error',
      },
    ]

    fs.mkdirSync(paths.reportDir, { recursive: true })
    fs.writeFileSync(
      paths.eventLogPath,
      `${events.map(event => JSON.stringify(event)).join('\n')}\n`,
      'utf8',
    )

    const originalArgv = process.argv
    process.argv = [
      '/abs/path/to/node',
      path.resolve(process.cwd(), 'node_modules/vitest/vitest.mjs'),
      'run',
      '-c',
      './e2e/vitest.e2e.devtools.config.ts',
    ]

    try {
      const payload = writeIdeWarningReport(paths, new Date('2026-03-11T00:00:00.000Z'))

      expect(payload.summary.projectCount).toBe(2)
      expect(payload.summary.typeUncompatibleCount).toBe(3)

      const indexMarkdown = fs.readFileSync(paths.reportMarkdownPath, 'utf8')
      const indexJson = fs.readFileSync(paths.reportJsonPath, 'utf8')
      const githubMarkdownPath = path.join(paths.reportDir, 'e2e-apps__github-issues.md')
      const githubMarkdown = fs.readFileSync(githubMarkdownPath, 'utf8')
      const githubJsonPath = path.join(paths.reportDir, 'e2e-apps__github-issues.json')
      const githubJson = fs.readFileSync(githubJsonPath, 'utf8')

      expect(indexMarkdown).toContain('./e2e-apps__github-issues.md')
      expect(indexJson).toContain('"project": "e2e-apps/github-issues"')
      expect(githubMarkdown).toContain('type-uncompatible value')
      expect(githubMarkdown).toContain('got non-object value')
      expect(indexMarkdown).not.toContain(tempRoot)
      expect(indexMarkdown).not.toContain(process.cwd())
      expect(githubMarkdown).not.toContain(tempRoot)
      expect(githubMarkdown).not.toContain(process.cwd())
      expect(githubJson).not.toContain(tempRoot)
      expect(githubMarkdown).not.toContain('\u001B[2K')
      expect(githubJson).not.toContain('\u001B[2K')
    }
    finally {
      process.argv = originalArgv
    }
  })

  it('clears event log file content', () => {
    const { paths } = createTempReportPaths()
    fs.writeFileSync(paths.eventLogPath, 'stale event', 'utf8')

    clearRuntimeWarningLog(paths.eventLogPath)

    expect(fs.readFileSync(paths.eventLogPath, 'utf8')).toBe('')
  })

  it('only emits marker output when suite runners request it', () => {
    const { paths } = createTempReportPaths()
    fs.mkdirSync(paths.reportDir, { recursive: true })
    fs.writeFileSync(paths.eventLogPath, '', 'utf8')

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    writeIdeWarningReport(paths, new Date('2026-03-11T00:00:00.000Z'))
    expect(stdoutWrite).not.toHaveBeenCalled()

    process.env.WEAPP_VITE_E2E_REPORT_MARKERS = '1'
    writeIdeWarningReport(paths, new Date('2026-03-11T00:00:00.000Z'))
    expect(stdoutWrite).toHaveBeenCalledWith(
      expect.stringContaining('[ide-warning-report] index='),
    )
  })
})
