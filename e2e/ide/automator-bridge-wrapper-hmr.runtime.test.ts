import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import {
  cleanupResidualIdeProcesses,
} from '../utils/ide-devtools-cleanup'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

const HMR_PAGE_WXML = path.join(APP_ROOT, 'src/pages/hmr/index.wxml')
const HMR_PAGE_WXML_DIST = path.join(DIST_ROOT, 'pages/hmr/index.wxml')

function getSessionMetadata(miniProgram: any) {
  return Reflect.get(miniProgram as object, '__WEAPP_VITE_SESSION_METADATA') as { projectPath?: string } | undefined
}

describe.sequential('automator bridge wrapper hmr (ide)', () => {
  let dev: ReturnType<typeof startDevProcess> | undefined
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let originalWxml = ''

  beforeAll(async () => {
    await cleanupResidualIdeProcesses()
    await fs.remove(DIST_ROOT)
    originalWxml = await fs.readFile(HMR_PAGE_WXML, 'utf8')

    dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    await dev.waitFor(
      Promise.all([
        waitForFile(path.join(DIST_ROOT, 'app.json'), 90_000),
        waitForFileContains(HMR_PAGE_WXML_DIST, '<view class="title">HMR</view>', 90_000),
      ]),
      'bridge wrapper hmr baseline dist generated',
    )

    miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      skipWarmup: true,
    })
  }, 120_000)

  afterAll(async () => {
    try {
      await miniProgram?.close?.().catch(() => {})
    }
    finally {
      if (originalWxml) {
        await replaceFileByRename(HMR_PAGE_WXML, originalWxml)
      }
      await dev?.stop()
      await cleanupResidualIdeProcesses()
    }
  }, 60_000)

  it('keeps the opened bridge wrapper project synced with dev dist updates', async () => {
    const wrapperProjectPath = getSessionMetadata(miniProgram)?.projectPath
    expect(wrapperProjectPath).toContain(path.join('.tmp', 'e2e-ide-bridge-projects'))
    const wrapperHmrWxml = path.join(wrapperProjectPath!, 'pages/hmr/index.wxml')
    await waitForFileContains(wrapperHmrWxml, '<view class="title">HMR</view>', 20_000)

    const pageTemplateMarker = createHmrMarker('IDE-BRIDGE-WRAPPER-HMR', 'weapp')
    const updatedWxml = originalWxml.replace(
      '<view class="title">HMR</view>',
      `<view class="title">${pageTemplateMarker}</view>`,
    )
    await replaceFileByRename(HMR_PAGE_WXML, updatedWxml)

    await dev!.waitFor(
      Promise.all([
        waitForFileContains(HMR_PAGE_WXML_DIST, pageTemplateMarker, 30_000),
        waitForFileContains(wrapperHmrWxml, pageTemplateMarker, 30_000),
      ]),
      'bridge wrapper hmr update synced',
    )
  })
})
