import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  callCurrentPageMethod,
  closeSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
} from './github-issues.runtime.shared'

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
    miniProgram ??= await getSharedMiniProgram(ctx)
    return miniProgram
  }

  it('checks which host attributes are available as native and Vue SFC component props in DevTools', async (ctx) => {
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-627-native/index.js')
    const componentJsPath = path.join(DIST_ROOT, 'components/issue-627/native-props-probe/index.js')
    const sfcComponentJsPath = path.join(DIST_ROOT, 'components/issue-627/ReservedPropsProbe/index.js')

    expect(await fs.readFile(pageJsPath, 'utf-8')).toContain('selectComponent?.("#issue627-native-probe")')
    expect(await fs.readFile(pageJsPath, 'utf-8')).toContain('selectComponent?.("#issue627-sfc-host-literal")')
    const componentJs = await fs.readFile(componentJsPath, 'utf-8')
    expect(componentJs).toContain('"class": String')
    expect(componentJs).toContain('"style": String')
    expect(componentJs).toContain('"hidden": Boolean')
    expect(componentJs).toContain('"dataFoo": String')
    expect(componentJs).toContain('"data-foo": String')
    expect(componentJs).toContain('"markFoo": String')
    expect(componentJs).toContain('"mark:foo": String')
    expect(componentJs).toContain('"slot": String')
    expect(await fs.readFile(sfcComponentJsPath, 'utf-8')).toContain('props: {')
    expect(await fs.readFile(sfcComponentJsPath, 'utf-8')).toContain('class: {')
    expect(await fs.readFile(sfcComponentJsPath, 'utf-8')).toContain('style: {')

    const miniProgram = await ensureMiniProgram(ctx)
    const issuePage = await relaunchPage(miniProgram, '/pages/issue-627-native/index', undefined, 20_000, {
      readiness: async () => {
        const snapshot = await callCurrentPageMethod(miniProgram, '_runE2E')
        return Boolean(snapshot?.native && snapshot?.sfcLiteral && snapshot?.sfcDynamic)
      },
    })
    if (!issuePage) {
      throw new Error('Failed to launch issue-627-native page')
    }
    const snapshot = await callCurrentPageMethod(miniProgram, '_runE2E')

    expect(snapshot).toMatchObject({
      native: {
        id: '',
        class: '',
        style: 'color: rgb(22, 119, 255);',
        hidden: false,
        dataFoo: 'issue-627-native-dataFoo',
        dataDashFoo: 'issue-627-native-data-foo',
        markFoo: 'issue-627-native-markFoo',
        markColonFoo: 'issue-627-native-mark-colon-foo',
        slot: '',
        wxIf: false,
        customClass: 'issue-627-native-custom-class',
        customStyle: 'font-size: 32rpx;',
        customHidden: true,
        customDataFoo: 'issue-627-native-custom-data-foo',
      },
      sfcLiteral: {
        id: '',
        class: '',
        style: 'color: rgb(22, 119, 255);',
        hidden: false,
        dataFoo: 'issue-627-sfc-host-dataFoo',
        markFoo: 'issue-627-sfc-host-markFoo',
        slot: '',
        customClass: 'issue-627-sfc-host-custom-class',
        customStyle: 'font-size: 32rpx;',
        customHidden: true,
        customDataFoo: 'issue-627-sfc-host-custom-data-foo',
      },
      sfcDynamic: {
        id: '',
        class: '',
        style: 'font-size: 32rpx;',
        hidden: false,
        dataFoo: 'issue-627-sfc-host-dynamic-dataFoo',
        markFoo: 'issue-627-sfc-host-dynamic-markFoo',
        slot: '',
        customClass: 'issue-627-sfc-host-dynamic-custom-class',
        customStyle: 'color: rgb(22, 119, 255);',
        customHidden: false,
        customDataFoo: 'issue-627-sfc-host-dynamic-custom-data-foo',
      },
    })
  })
})
