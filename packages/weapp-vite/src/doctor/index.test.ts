import type { DoctorArtifactSnapshot } from './types'
import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatDoctorReport, runDoctor } from './index'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function project() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'weapp-doctor-'))
  roots.push(cwd)
  await mkdir(path.join(cwd, 'src'))
  await writeFile(path.join(cwd, 'package.json'), '{"name":"doctor-fixture"}')
  await writeFile(path.join(cwd, 'project.config.json'), '{}')
  await writeFile(path.join(cwd, 'src/page.ts'), 'const custom = { at() {} }; custom.at()')
  await writeFile(path.join(cwd, 'vite.config.ts'), 'throw new Error("配置不应执行")')
  return cwd
}

function snapshot(overrides: Record<string, string> = {}): DoctorArtifactSnapshot {
  return {
    origin: 'build',
    freshness: 'current-build',
    capturedAt: '2026-01-01T00:00:00.000Z',
    budgets: { source: 'config', totalBytes: 100000, mainBytes: 100000, subPackageBytes: 100000, independentBytes: 100000, warningRatio: 0.85 },
    files: Object.entries({
      'app.json': '{"pages":["pages/index"]}',
      'app.js': 'App({})',
      'pages/index.js': 'Page({})',
      'pages/index.json': '{}',
      'pages/index.wxml': '<view>ready</view>',
      ...overrides,
    }).map(([file, text]) => ({ path: file, text, size: Buffer.byteLength(text), sha256: 'fixture-digest' })),
  }
}

describe('Doctor evidence and gates', () => {
  it('does not evaluate configuration, build or connect in static mode', async () => {
    const cwd = await project()
    const build = vi.fn()
    const runtime = vi.fn()
    const report = await runDoctor({ cwd }, { build, runtime })
    expect(report.exitCode).toBe(0)
    expect(build).not.toHaveBeenCalled()
    expect(runtime).not.toHaveBeenCalled()
    expect(report.diagnostics).toEqual([])
    expect(report.coverage.filter(c => c.status === 'not-requested').map(c => c.layer)).toEqual(['artifact', 'runtime'])
    expect(await readFile(path.join(cwd, 'vite.config.ts'), 'utf8')).toContain('配置不应执行')
  })

  it('rejects unknown targets before invoking adapters', async () => {
    const build = vi.fn()
    const report = await runDoctor({ cwd: await project(), targets: ['unknown'], build: true }, { build })
    expect(report.exitCode).toBe(2)
    expect(build).not.toHaveBeenCalled()
  })

  it('does not apply the WeChat global baseline to Alipay', async () => {
    const cwd = await project()
    await writeFile(path.join(cwd, 'src/page.ts'), 'my.request({}); wx.request({}); window.open()')
    const report = await runDoctor({ cwd, targets: ['alipay'] })
    expect(report.exitCode).toBe(2)
    expect(report.diagnostics).toEqual([])
    expect(report.coverage).toContainEqual(expect.objectContaining({ check: 'host-api-baseline', status: 'incomplete' }))
  })

  it('accepts complete build evidence without running runtime implicitly', async () => {
    const report = await runDoctor({ cwd: await project(), build: true }, { build: async () => snapshot() })
    expect(report.exitCode).toBe(0)
    expect(report.artifacts.weapp.freshness).toBe('current-build')
    expect(report.artifacts.weapp.files[0]).not.toHaveProperty('text')
  })

  it('detects missing page, component and imported files independently of source diagnostics', async () => {
    const report = await runDoctor({ cwd: await project(), build: true }, {
      build: async () => snapshot({
        'app.json': '{"pages":["pages/index","pages/missing"]}',
        'pages/index.json': '{"usingComponents":{"card":"/components/card"}}',
        'pages/index.js': 'require("../missing.js"); Page({})',
      }),
    })
    expect(report.exitCode).toBe(1)
    expect(report.diagnostics.map(d => d.ruleId)).toContain('doctor/artifact/missing-import')
    expect(report.diagnostics.some(d => d.location?.file === 'components/card.wxml')).toBe(true)
    expect(report.diagnostics.every(d => d.responsibility.owner === 'unknown')).toBe(true)
  })

  it('checks independent package ownership and template/style references', async () => {
    const report = await runDoctor({ cwd: await project(), build: true }, {
      build: async () => snapshot({
        'app.json': '{"pages":["pages/index"],"subPackages":[{"root":"isolated","independent":true,"pages":["index"]}]}',
        'isolated/index.js': 'require("../pages/index.js")',
        'isolated/index.json': '{}',
        'isolated/index.wxml': '<include src="../pages/index.wxml"/>',
        'isolated/index.wxss': '@import "../missing.wxss";',
      }),
    })
    expect(report.exitCode).toBe(1)
    expect(report.diagnostics.filter(d => d.ruleId === 'doctor/artifact/package-import')).toHaveLength(2)
    expect(report.diagnostics.some(d => d.location?.file === 'isolated/index.wxss')).toBe(true)
  })

  it('uses compiler budgets and keeps incomplete higher priority than diagnosed errors', async () => {
    const artifact = snapshot()
    artifact.budgets!.mainBytes = 1
    const report = await runDoctor({ cwd: await project(), build: true, runtime: true }, {
      build: async () => artifact,
      runtime: async () => { throw new Error('host unavailable') },
    })
    expect(report.exitCode).toBe(2)
    expect(report.diagnostics.map(d => d.ruleId)).toContain('doctor/artifact/budget')
  })

  it('records an explicit successful host probe separately from artifact coverage', async () => {
    const runtime = vi.fn(async () => ({ host: 'wechat-devtools', route: 'pages/index', provider: 'devtools', checks: ['App.getCurrentPage'] }))
    const cwd = await project()
    const report = await runDoctor({ cwd, runtime: true, runtimePort: 12345 }, {
      runtime,
    })
    expect(runtime).toHaveBeenCalledWith(cwd, 'weapp', 12345)
    expect(report.exitCode).toBe(0)
    expect(report.runtime.weapp.route).toBe('pages/index')
    expect(report.coverage).toContainEqual(expect.objectContaining({ layer: 'artifact', status: 'not-requested' }))
  })

  it('reports parser failure as incomplete and keeps node/web/test execution domains excluded', async () => {
    const cwd = await project()
    await writeFile(path.join(cwd, 'src/page.ts'), 'const =')
    for (const file of ['node.ts', 'page.web.ts', 'page.test.ts']) {
      await writeFile(path.join(cwd, 'src', file), 'window.open(); process.exit()')
    }
    const report = await runDoctor({ cwd })
    expect(report.exitCode).toBe(2)
    expect(report.diagnostics).toHaveLength(1)
    expect(report.diagnostics[0].location?.file).toBe('page.ts')
  })

  it('preserves stable fingerprints and valid JSON/SARIF without including source text', async () => {
    const cwd = await project()
    const options = { cwd, build: true }
    const adapters = { build: async () => snapshot({ 'pages/index.js': 'window.open()' }) }
    const report = await runDoctor(options, adapters)
    const next = await runDoctor(options, adapters)
    expect(report.diagnostics.map(d => d.fingerprint)).toEqual(next.diagnostics.map(d => d.fingerprint))
    expect(JSON.parse(formatDoctorReport(report, 'json')).exitCode).toBe(1)
    const sarif = JSON.parse(formatDoctorReport(report, 'sarif'))
    expect(sarif.version).toBe('2.1.0')
    expect(sarif.runs[0].results[0].properties.responsibility.owner).toBe('unknown')
    expect(formatDoctorReport(report, 'json')).not.toContain(cwd)
  })
})
