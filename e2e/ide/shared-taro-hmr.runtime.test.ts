import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 保留跨平台进程启动、流式输出与终止能力。
import { execa } from 'execa'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { installTaroHmrTransport } from '../utils/taroHmrTransport'

const root = path.resolve(import.meta.dirname, '../..')
const route = '/pages/index/index'
const checkStyles = resolveRuntimeProviderName() === 'devtools'

function readReports(source: string) {
  return [...source.matchAll(/SHARED_HOST_REPORT=([^\r\n]+)\r?\n/g)].map((match) => {
    const value: unknown = JSON.parse(match[1]!)
    if (!value || typeof value !== 'object' || !('kind' in value) || typeof value.kind !== 'string'
      || !('buildId' in value) || typeof value.buildId !== 'string') {
      throw new Error('Invalid Taro runtime report')
    }
    return { kind: value.kind, buildId: value.buildId, seq: 'seq' in value && typeof value.seq === 'number' ? value.seq : undefined }
  })
}

describe('shared HMR compiler: Taro runtime', { concurrent: false }, () => {
  let child: ReturnType<typeof execa> | undefined
  let project = ''
  let output = ''
  let dispose: (() => void) | undefined
  let runtime: Awaited<ReturnType<typeof launchAutomator>> | undefined

  beforeAll(async () => {
    child = execa(process.execPath, ['integrations/shared-hmr-tailwind/run-taro.mjs'], {
      cwd: root,
      env: { ...createDevProcessEnv({ usePolling: false }), WEAPP_VITE_TARO_HMR_MODE: resolveRuntimeProviderName() === 'headless' ? 'interpreter' : 'devtools' },
      reject: false,
      extendEnv: false,
    })
    child.stdout?.on('data', (data) => {
      output += String(data)
    })
    child.stderr?.on('data', (data) => {
      output += String(data)
    })
    await Promise.race([
      vi.waitFor(() => expect(/SHARED_HOST_PROJECT=([^\r\n]+)\r?\n/.exec(output)?.[1], output).toBeTruthy(), { timeout: 60_000 }),
      child.then((result) => {
        throw new Error(`Taro startup exited: code=${result.exitCode} signal=${result.signal}\n${output}`)
      }),
    ])
    project = /SHARED_HOST_PROJECT=([^\r\n]+)\r?\n/.exec(output)![1]!.trim()
    await vi.waitFor(async () => expect(await readFile(path.join(project, 'dist/app.wxss'), 'utf8')).toContain('vpt-build:'), { timeout: 30_000 })
    for (const extension of ['js', 'json', 'wxml']) {
      expect(await readFile(path.join(project, `dist/pages/index/index.${extension}`), 'utf8')).not.toBe('')
    }
    runtime = await launchAutomator({
      projectPath: path.join(project, 'dist'),
      bridgeProjectMode: 'direct',
      warmupRoute: route,
      warmupRootSelectors: ['#shared-utility'],
      configureHeadlessSession(session) {
        dispose = installTaroHmrTransport(session)
      },
    })
  }, 180_000)

  afterAll(async () => {
    dispose?.()
    try {
      await runtime?.close()
    }
    finally {
      child?.kill('SIGTERM')
      await child
      if (project) {
        await rm(project, { recursive: true, force: true })
      }
    }
  }, 60_000)

  it('keeps React state while publishing and applying class and event updates separately', async (context) => {
    context.onTestFailed(() => {
      process.stdout.write(output)
    })
    const host = runtime!
    await expect.poll(() => readReports(output).some(report => report.kind === 'startup'), { timeout: 30_000 }).toBe(true)
    const startups = readReports(output).filter(report => report.kind === 'startup')
    const buildId = startups.at(-1)!.buildId
    const page = await host.reLaunch(route)
    const dom = createDomAcceptance(context, 'integrations/shared-hmr-tailwind/fixture', [
      { id: 'initial', route, action: '初始 Taro 产物', nodes: [{ selector: '#shared-utility', text: 'shared utility' }, { selector: '#shared-count', text: '0' }] },
      { id: 'edited', route, action: '等待真实 applied 并保留点击状态', nodes: [{ selector: '#shared-utility', text: 'shared utility updated' }, { selector: '#shared-count', text: '1' }] },
      { id: 'event', route, action: '执行更新后的事件', nodes: [{ selector: '#shared-count', text: '3' }] },
      { id: 'restored', route, action: '恢复源码并保留状态', nodes: [{ selector: '#shared-utility', text: 'shared utility' }, { selector: '#shared-count', text: '4' }] },
    ])
    await dom.check('initial', host, page)
    await (await page.$('#shared-count'))!.tap()
    await expect.poll(async () => (await (await (await host.currentPage()).$('#shared-count'))!.text()).trim()).toBe('1')
    const source = path.join(project, 'src/pages/index/index.tsx')
    const original = await readFile(source, 'utf8')
    const edited = original.replace('#fce7f3', '#dbeafe').replace('shared utility</View>', 'shared utility updated</View>').replace('value + 1', 'value + 2')
    const receiptCount = () => readReports(output).filter(report => report.kind === 'applied').length
    const previousReceipts = receiptCount()
    const temporary = `${source}.pending`
    await writeFile(temporary, edited)
    await rename(temporary, source)
    await expect.poll(() => readFile(path.join(project, 'dist/assets/global.wxss'), 'utf8'), { timeout: 45_000 }).toContain('#dbeafe')
    await expect.poll(receiptCount, { timeout: 45_000 }).toBeGreaterThan(previousReceipts)
    await dom.check('edited', host, await host.currentPage())
    await (await (await host.currentPage()).$('#shared-count'))!.tap()
    await dom.check('event', host, await host.currentPage())
    const editedReceipts = receiptCount()
    await writeFile(temporary, original)
    await rename(temporary, source)
    await expect.poll(receiptCount, { timeout: 45_000 }).toBeGreaterThan(editedReceipts)
    await (await (await host.currentPage()).$('#shared-count'))!.tap()
    await dom.check('restored', host, await host.currentPage())
    expect(output).not.toMatch(/HMR (?:publish|update) failed/)
    expect(readReports(output).filter(report => report.kind === 'startup')).toHaveLength(startups.length)
    expect(readReports(output).filter(report => report.kind === 'applied').every(report => report.buildId === buildId)).toBe(true)
  }, 180_000)
  it('applies a newly generated native utility without a full reload', async (context) => {
    context.onTestFailed(() => {
      process.stdout.write(output)
    })
    const host = runtime!
    await expect.poll(() => readReports(output).some(report => report.kind === 'startup'), { timeout: 30_000 }).toBe(true)
    const startups = readReports(output).filter(report => report.kind === 'startup')
    const buildId = startups.at(-1)!.buildId
    const page = await host.reLaunch(route)
    const dom = createDomAcceptance(context, 'integrations/shared-hmr-tailwind/fixture', [
      { id: 'style-initial', route, action: '确认初始可见样式', nodes: [{ selector: '#shared-utility', text: 'shared utility', ...(checkStyles ? { styles: { 'background-color': 'rgb(252, 231, 243)' } } : {}) }] },
      { id: 'style-edited', route, action: '确认新规则实际作用于原页面', nodes: [{ selector: '#shared-utility', text: 'shared utility', ...(checkStyles ? { styles: { 'background-color': 'rgb(199, 210, 254)' } } : {}) }] },
    ])
    await dom.check('style-initial', host, page)
    const source = path.join(project, 'src/pages/index/index.tsx')
    const original = await readFile(source, 'utf8')
    const before = readReports(output).filter(report => report.kind === 'applied').length
    await writeFile(`${source}.pending`, original.replace('#fce7f3', '#c7d2fe'))
    await rename(`${source}.pending`, source)
    await expect.poll(() => readFile(path.join(project, 'dist/assets/global.wxss'), 'utf8'), { timeout: 45_000 }).toContain('#c7d2fe')
    await expect.poll(() => readReports(output).filter(report => report.kind === 'applied').length, { timeout: 45_000 }).toBeGreaterThan(before)
    await expect.poll(async () => {
      const node = (await (await host.currentPage()).$('#shared-utility'))!
      return (node.attribute ?? node.attr).call(node, 'class')
    }).toContain('c7d2fe')
    await dom.check('style-edited', host, await host.currentPage())
    expect(readReports(output).filter(report => report.kind === 'startup')).toHaveLength(startups.length)
    expect(readReports(output).findLast(report => report.kind === 'applied')?.buildId).toBe(buildId)
  }, 120_000)
})
