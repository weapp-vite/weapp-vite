import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { createTempFixtureProject, createTestCompilerContext, getFixture, scanFiles } from './utils'

const TEXT_OUTPUT_RE = /\.(?:js|json|wxml|wxss)$/
const RUNTIME_VENDOR_RE = /^weapp-vendors\//

function normalizeOutputContent(file: string, content: string) {
  const normalizeStableNames = (value: string) => {
    return value
      .replace(/scoped-slot-[\w-]+-default-0/g, 'scoped-slot-hash-default-0')
      .replace(/weapp-vendors\/wevu-[\w-]+\.js/g, 'weapp-vendors/wevu-runtime.js')
  }
  if (file.endsWith('.json')) {
    return normalizeStableNames(`${JSON.stringify(JSON.parse(content), null, 2)}\n`)
  }
  if (file.endsWith('.js')) {
    return normalizeStableNames(content)
      .replace(/^\/\/#region .*\/src\//gm, '//#region <fixture>/src/')
      .replace(/\brequire_src_\w+\b/g, 'require_src')
      .replace(/\brequire_templateRef_\w+\b/g, 'require_templateRef')
      .replace(/require\("([^"]*wevu-runtime\.js)"\)\.to\(\{/g, '(require("$1").__wevuCreateWevuComponent || require("$1").to)({')
      .replace(/require\("([^"]*wevu-runtime\.js)"\)\.__wevuCreateWevuComponent\(\{/g, '(require("$1").__wevuCreateWevuComponent || require("$1").to)({')
      .replace(/require\("([^"]*wevu-runtime\.js)"\)\.__wevuCreatePage\(\{/g, '(require("$1").__wevuCreateWevuComponent || require("$1").to)({')
      .replace(/require\("([^"]*wevu-runtime\.js)"\)\.[A-Za-z_$][\w$]*\(\{/g, 'require("$1").__wevuCreatePage({')
      .replace(/require\("([^"]*wevu-runtime\.js)"\)\.__wevuCreatePage\(\{/g, '(require("$1").__wevuCreateWevuComponent || require("$1").to)({')
      .replace(/require_src\.[A-Za-z_$][\w$]*/g, 'require_src.__wevuScopedSlotCreator')
      .replace(/\brequire_templateRef\.[A-Za-z_$][\w$]*/g, 'require_templateRef.__wevuScopedSlotCreator')
      .replace(/(\bcreateWevuScopedSlotComponent = .*?\?\? require_templateRef\.)[A-Za-z_$][\w$]*(;)/g, '$1__wevuScopedSlotCreator$2')
      .replace(/(var createWevuScopedSlotComponent = .*?\?\? require_templateRef\.)[A-Za-z_$][\w$]*(;)/g, '$1__wevuScopedSlotCreator$2')
  }
  return normalizeStableNames(content)
}

describe('scoped slot native output snapshots', () => {
  const fixtureSource = getFixture('scoped-slot-native-output')
  let cleanup: (() => Promise<void>) | undefined
  let distDir = ''

  beforeAll(async () => {
    const tempProject = await createTempFixtureProject(fixtureSource, 'scoped-slot-native-output')
    cleanup = tempProject.cleanup
    distDir = path.join(tempProject.tempDir, 'dist')

    const { ctx, dispose } = await createTestCompilerContext({
      cwd: tempProject.tempDir,
    })
    try {
      await ctx.buildService.build()
    }
    finally {
      await dispose()
    }
  }, 30_000)

  afterAll(async () => {
    await cleanup?.()
  })

  it('locks the emitted file tree and app text outputs', async () => {
    const files = await scanFiles(distDir)
    const appFiles = files.filter(file => !RUNTIME_VENDOR_RE.test(file))
    const runtimeVendorFiles = files.filter(file => RUNTIME_VENDOR_RE.test(file))

    expect(appFiles).toMatchSnapshot('file-tree')
    expect(runtimeVendorFiles.length).toBeGreaterThan(0)
    expect(runtimeVendorFiles.every(file => /^weapp-vendors\/wevu-[\w-]+\.js$/.test(file))).toBe(true)
    expect(files.filter(file => file.includes('__scoped-slot-default'))).toEqual([])

    const outputSnapshot: Record<string, string> = {}
    for (const file of files) {
      if (RUNTIME_VENDOR_RE.test(file) || !TEXT_OUTPUT_RE.test(file)) {
        continue
      }
      const content = await fs.readFile(path.join(distDir, file), 'utf-8')
      outputSnapshot[file] = normalizeOutputContent(file, content)
    }

    expect(outputSnapshot).toMatchSnapshot('text-outputs')
    expect(outputSnapshot['pages/index/index.wxml']).toContain(
      '<van-tabbar-item wx:for="{{tabItems}}"',
    )
    expect(outputSnapshot['pages/index/index.wxml']).toContain(
      'name="{{__wv_item_0.to.name}}"',
    )
    expect(outputSnapshot['pages/index/index.wxml']).toContain(
      '>{{__wv_item_0.label}}</van-tabbar-item>',
    )
    expect(outputSnapshot['pages/index/index.wxml']).not.toContain('generic:scoped-slots-default')
  })
})
