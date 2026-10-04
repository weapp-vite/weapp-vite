import type { DomCheckpoint } from '../utils/domAcceptance/types'
import { access, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 仓库 CLI 回归统一使用跨平台进程封装。
import { execa } from 'execa'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { dialogImportCheckpoints } from './dialogImportDom'
import { attachRuntimeErrorCollector } from './runtimeErrors'
import { tapRendered } from './tdesignDom'

const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/tdesign-dialog-import')
const require = createRequire(import.meta.url)
const VITE_CLI = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js')
const OPTIONS_ROUTE = '/customized/pages/npm-options/index'
const CALLBACK_COMPONENT = '/customized/custom-components/tdesign-miniprogram/button/button'
const MAPPED_COMPONENT = '/manual-output/miniprogram_npm/tdesign-miniprogram/button/button'
let runtime: Awaited<ReturnType<typeof launchAutomator>> | undefined

async function assertNpmOptionsOutput() {
  const output = (file: string) => path.join(APP_ROOT, 'dist', file)
  for (const file of [OPTIONS_ROUTE, CALLBACK_COMPONENT, MAPPED_COMPONENT]) {
    for (const extension of ['js', 'json', 'wxml']) {
      await access(output(`${file}.${extension}`))
    }
  }
  for (const component of [CALLBACK_COMPONENT, MAPPED_COMPONENT]) {
    await access(output(`${component}.wxss`))
  }
  await expect(access(output('customized/miniprogram_npm/tdesign-miniprogram/button/button.js'))).rejects.toMatchObject({ code: 'ENOENT' })
  const json = JSON.parse(await readFile(output(`${OPTIONS_ROUTE}.json`), 'utf8')) as { usingComponents?: Record<string, string> }
  expect(json.usingComponents).toEqual({
    'callback-button': CALLBACK_COMPONENT,
    'mapped-button': MAPPED_COMPONENT,
  })
}

function npmOptionsCheckpoint(id: string, callbackCount: number, mappedCount: number): DomCheckpoint {
  return {
    id,
    route: OPTIONS_ROUTE,
    action: id,
    nodes: [
      { selector: '//*[@id="npm-callback-button"]', query: 'xpath', text: 'callback output' },
      { selector: '//*[@id="npm-mapped-button"]', query: 'xpath', text: 'manual mapped output' },
      { selector: '//*[@id="npm-disabled-button"]', query: 'xpath', text: 'disabled callback output' },
      { selector: '#npm-callback-count', text: `callback = ${callbackCount}` },
      { selector: '#npm-mapped-count', text: `mapped = ${mappedCount}` },
      { selector: '#npm-disabled-count', text: 'disabled = 0' },
    ],
  }
}

async function getSharedMiniProgram() {
  if (!runtime) {
    await execa(process.execPath, [VITE_CLI, 'build', '--config', 'vite.plugin.config.mts'], { cwd: APP_ROOT })
    await assertNpmOptionsOutput()
    runtime = await launchAutomator({
      projectPath: APP_ROOT,
      warmupRoute: '/pages/dialog-bare/index',
      warmupRootSelectors: ['.title'],
    })
  }
  return runtime
}

describe('standard Vite plugin npm publication (weapp e2e)', { concurrent: false }, () => {
  afterAll(async () => {
    await runtime?.close()
  })

  for (const kind of ['bare', 'index'] as const) {
    it(`renders and opens emitted npm components with ${kind} imports`, async (context) => {
      const acceptance = createDomAcceptance(context, 'e2e-apps/tdesign-dialog-import', dialogImportCheckpoints(kind).filter(checkpoint => ['initial', 'open', 'cancel'].includes(checkpoint.id)))
      const miniProgram = await getSharedMiniProgram()
      const page = await miniProgram.reLaunch(`/pages/dialog-${kind}/index`)
      await acceptance.check('initial', miniProgram, page)
      const button = await page.$(`#dialog-${kind}-open`)
      expect(button).toBeTruthy()
      await button!.tap()
      await expect.poll(async () => page.callMethod('_runE2E')).toMatchObject({ dialogVisible: true, lastReturnedPromise: true, lastError: '' })
      await acceptance.check('open', miniProgram, page)
      await page.callMethod('_cancelDialogE2E')
      await acceptance.check('cancel', miniProgram, page)
    })
  }

  it('loads callback and manually mapped npm outputs and preserves button events', async (context) => {
    const acceptance = createDomAcceptance(context, 'e2e-apps/tdesign-dialog-import', [
      npmOptionsCheckpoint('initial', 0, 0),
      npmOptionsCheckpoint('callback', 1, 0),
      npmOptionsCheckpoint('mapped', 1, 1),
      npmOptionsCheckpoint('disabled', 1, 1),
    ])
    const miniProgram = await getSharedMiniProgram()
    const collector = attachRuntimeErrorCollector(miniProgram)
    try {
      const page = await miniProgram.reLaunch(OPTIONS_ROUTE)
      await acceptance.check('initial', miniProgram, page)
      for (const [kind, callbackCount, mappedCount] of [
        ['callback', 1, 0],
        ['mapped', 1, 1],
        ['disabled', 1, 1],
      ] as const) {
        await tapRendered(page, `//*[@id="npm-${kind}-button"]`)
        await expect.poll(async () => page.callMethod('_runE2E')).toMatchObject({ callbackCount, mappedCount, disabledCount: 0 })
        await acceptance.check(kind, miniProgram, page)
      }
      expect(collector.getSince(0)).toEqual([])
    }
    finally {
      collector.dispose()
    }
  })
})
