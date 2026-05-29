import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import {
  APP_ROOT,
  closeSharedMiniProgram,
  DIST_ROOT,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
} from './github-issues.runtime.shared'

async function waitForCurrentIssue627Page(miniProgram: any, timeoutMs = 45_000) {
  const start = Date.now()
  let lastPage: any = null
  while (Date.now() - start <= timeoutMs) {
    try {
      const page = await miniProgram.currentPage()
      lastPage = page
      if (page?.path === 'pages/issue-627-native/index') {
        const root = await page.$('page').catch(() => null)
        if (root) {
          return page
        }
      }
    }
    catch {
    }
    await new Promise(resolve => setTimeout(resolve, 220))
  }
  throw new Error(`Failed to read issue-627 startup page; current=${lastPage?.path ?? '<none>'}`)
}

describe.sequential('e2e app: github-issues / issue #627', () => {
  let miniProgram: any = null

  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await miniProgram?.close?.().catch(() => {})
    miniProgram = null
    await closeSharedMiniProgram()
  })

  async function ensureMiniProgram(ctx: { skip: (message?: string) => void }) {
    try {
      miniProgram ??= await launchAutomator({
        projectConfig: {
          condition: {
            miniprogram: {
              current: -1,
              list: [{
                launchMode: 'default',
                name: 'pages/issue-627-native/index',
                pathName: 'pages/issue-627-native/index',
                query: '',
                scene: null,
              }],
            },
          },
        },
        projectPath: APP_ROOT,
        skipWarmup: true,
      })
      return miniProgram
    }
    catch (error) {
      if (isDevtoolsHttpPortError(error)) {
        ctx.skip('WeChat DevTools 服务端口未开启，跳过 issue #627 IDE 自动化用例。')
      }
      throw error
    }
  }

  it('keeps class empty while passing style into native and Vue SFC component props in DevTools', async (ctx) => {
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-627-native/index.js')
    const componentJsPath = path.join(DIST_ROOT, 'components/issue-627/native-props-probe/index.js')
    const sfcComponentJsPath = path.join(DIST_ROOT, 'components/issue-627/ReservedPropsProbe/index.js')

    expect(await fs.readFile(pageJsPath, 'utf-8')).toContain('selectComponent?.("#issue627-native-probe")')
    expect(await fs.readFile(pageJsPath, 'utf-8')).toContain('selectComponent?.("#issue627-sfc-host-literal")')
    expect(await fs.readFile(componentJsPath, 'utf-8')).toContain('class: String')
    expect(await fs.readFile(componentJsPath, 'utf-8')).toContain('style: String')
    expect(await fs.readFile(sfcComponentJsPath, 'utf-8')).toContain('props: {')
    expect(await fs.readFile(sfcComponentJsPath, 'utf-8')).toContain('class: {')
    expect(await fs.readFile(sfcComponentJsPath, 'utf-8')).toContain('style: {')

    const miniProgram = await ensureMiniProgram(ctx)
    const issuePage = await waitForCurrentIssue627Page(miniProgram)

    expect(await issuePage.callMethod('_runE2E')).toMatchObject({
      native: {
        class: '',
        style: 'color: rgb(22, 119, 255);',
        customClass: 'issue-627-native-custom-class',
        customStyle: 'font-size: 32rpx;',
      },
      sfcLiteral: {
        class: '',
        style: 'color: rgb(22, 119, 255);',
      },
      sfcDynamic: {
        class: '',
        style: 'font-size: 32rpx;',
      },
    })
  })
})
