import path, { win32 } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'

const windowsRepo = 'C:\\repo'
const scriptsDirectory = path.resolve(import.meta.dirname, '../../../../e2e/scripts')
const helpersModule = '../../../../e2e/scripts/domAcceptanceReport/helpers'

async function createWindowsReport(reportsRoot: string, child: string) {
  const files = new Map<string, string>()
  const mkdir = vi.fn()
  const identity = vi.fn(() => {
    throw new Error('Explicit test identity must prevent environment discovery')
  })
  vi.doMock('node:path', () => ({ default: {
    ...win32,
    resolve: (...parts: string[]) => parts[0] === scriptsDirectory && parts[1] === '../..'
      ? windowsRepo
      : win32.resolve(...parts),
  } }))
  vi.doMock('node:fs', () => ({ default: {
    mkdirSync: mkdir,
    writeFileSync: (file: string, value: string) => files.set(file, value),
  } }))
  vi.doMock(helpersModule, () => ({
    createAcceptanceIdentity: identity,
    // 保留原值，确保脱敏 mock 不会掩盖错误链接中的绝对路径。
    sanitizeAcceptanceValue: <T>(value: T) => value,
  }))
  const { createSuiteReport } = await import('../../../../e2e/scripts/suiteReport')
  const tasks = [{ label: 'windows-paths', exitCode: 0, durationMs: 1, artifacts: [{ kind: 'dom-acceptance-report' as const, indexPath: child }] }]
  const report = createSuiteReport(tasks, 'windows-paths', undefined, reportsRoot, {
    runId: 'windows-paths',
    commitSha: 'fixture',
    workingTreeDirty: false,
    strict: true,
    partial: false,
    plannedTasks: tasks,
  })
  expect(identity).not.toHaveBeenCalled()
  expect(mkdir).toHaveBeenCalledExactlyOnceWith(report.reportDir, { recursive: true })
  expect(files.size).toBe(2)
  const markdown = files.get(win32.join(report.reportDir, 'index.md'))!
  const json = JSON.parse(files.get(win32.join(report.reportDir, 'index.json'))!) as {
    reportDir: string
    tasks: Array<{ artifacts: Array<{ indexPath: string }> }>
  }
  return { report, markdown, json }
}

afterEach(() => {
  for (const module of ['node:path', 'node:fs', helpersModule]) {
    vi.doUnmock(module)
  }
  vi.resetModules()
})

it('keeps C-drive child references as safe text when the suite is on D drive', async () => {
  const { markdown, json } = await createWindowsReport('D:\\reports', 'C:\\repo\\docs\\reports\\child\\index.json')
  expect(markdown).toContain('`docs/reports/child/index.json`')
  expect(markdown).not.toContain('[index.json]')
  expect(markdown).not.toMatch(/[A-Z]:[\\/]/i)
  expect(json.reportDir).toMatch(/^<external>\//)
  expect(json.tasks[0]!.artifacts[0]!.indexPath).toBe('docs/reports/child/index.json')
})

it('redacts D-drive child references when the suite is inside the C-drive repository', async () => {
  const { markdown, json } = await createWindowsReport('C:\\repo\\docs\\reports', 'D:\\reports\\private\\index.json')
  expect(markdown).toContain('`<external>/index.json`')
  expect(markdown).not.toContain('[index.json]')
  expect(markdown).not.toMatch(/[A-Z]:[\\/]/i)
  expect(json.tasks[0]!.artifacts[0]!.indexPath).toBe('<external>/index.json')
})

it('preserves a resolvable POSIX-style destination for repository children on the same Windows drive', async () => {
  const child = 'C:\\repo\\docs\\reports\\child\\index.json'
  const { report, markdown, json } = await createWindowsReport('C:\\repo\\docs\\reports', child)
  const destinations = [...markdown.matchAll(/\[index\.json\]\(([^)]+)\)/g)].map(match => match[1]!)
  expect(destinations).toEqual(['./../child/index.json'])
  expect(win32.resolve(report.reportDir, destinations[0]!)).toBe(child)
  expect(markdown).not.toMatch(/[A-Z]:[\\/]/i)
  expect(json.tasks[0]!.artifacts[0]!.indexPath).toBe('docs/reports/child/index.json')
})
