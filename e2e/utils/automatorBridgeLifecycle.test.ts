import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareAutomatorBridgeWrapperProject, waitForBridgeWrapperWarmupAsset } from './automator'

vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn(), resolveReportProjectPath: () => 'fixture' }))

describe('automator bridge wrapper lifecycle', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('copies the complete app before launch and keeps the configured runtime root stable', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER', '1')
    vi.useFakeTimers()
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-lifecycle-'))
    const distRoot = path.join(project, 'dist')
    const route = 'pages/example/index'
    const pageRoot = path.join(distRoot, route)
    fs.mkdirSync(path.dirname(pageRoot), { recursive: true })
    fs.writeFileSync(path.join(project, 'project.config.json'), JSON.stringify({ miniprogramRoot: 'dist/', setting: { compileHotReLoad: true } }))
    fs.writeFileSync(path.join(distRoot, 'app.json'), JSON.stringify({ pages: [route] }))
    fs.writeFileSync(path.join(distRoot, 'app.js'), 'App({ realApplication: true })')
    fs.writeFileSync(`${pageRoot}.js`, 'Page({ data: { title: "real page" } })')
    fs.writeFileSync(`${pageRoot}.json`, '{}')
    fs.writeFileSync(`${pageRoot}.wxml`, '<view>real page</view>')
    const wrapper = prepareAutomatorBridgeWrapperProject(project, { appConfigPath: path.join(distRoot, 'app.json') })!

    try {
      const configPath = path.join(wrapper.path, 'project.config.json')
      const initialConfigBytes = fs.readFileSync(configPath)
      const config = JSON.parse(initialConfigBytes.toString()) as { miniprogramRoot: string, srcMiniprogramRoot: string }
      const configuredRoot = path.resolve(wrapper.path, config.miniprogramRoot)
      expect(config.srcMiniprogramRoot).toBe(config.miniprogramRoot)
      expect(configuredRoot).toBe(path.resolve(wrapper.runtimeRoot))
      expect(fs.existsSync(path.join(configuredRoot, 'app.json'))).toBe(true)
      expect(fs.existsSync(path.join(configuredRoot, `${route}.js`))).toBe(true)
      expect(fs.readFileSync(path.join(configuredRoot, 'app.js'), 'utf8')).toBe('App({ realApplication: true })')
      expect(fs.readFileSync(path.join(configuredRoot, `${route}.wxml`), 'utf8')).toBe('<view>real page</view>')
      const initialMtime = fs.statSync(configPath).mtimeMs

      await vi.advanceTimersByTimeAsync(5_000)
      expect(fs.readFileSync(configPath)).toEqual(initialConfigBytes)
      expect(fs.statSync(configPath).mtimeMs).toBe(initialMtime)
      expect(fs.readFileSync(path.join(configuredRoot, `${route}.wxml`), 'utf8')).toBe('<view>real page</view>')
      const read = vi.spyOn(fs, 'readFileSync')
      await waitForBridgeWrapperWarmupAsset(wrapper, `/${route}?from=test`, 'fixture')
      expect(read).toHaveBeenCalledWith(path.join(configuredRoot, `${route}.js`), 'utf8')
    }
    finally {
      wrapper.stopSync?.()
      fs.rmSync(wrapper.path, { recursive: true, force: true })
      fs.rmSync(project, { recursive: true, force: true })
    }
  })
})
