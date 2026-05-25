import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { createTempFixtureProject, createTestCompilerContext, getFixture, scanFiles } from './utils'

const TEXT_OUTPUT_RE = /\.(?:js|json|wxml|wxss)$/
const RUNTIME_VENDOR_RE = /^weapp-vendors\//

function normalizeOutputContent(file: string, content: string) {
  const normalizeStableNames = (value: string) => {
    return value.replace(/scoped-slot-[\w-]+-default-0/g, 'scoped-slot-hash-default-0')
  }
  if (file.endsWith('.json')) {
    return normalizeStableNames(`${JSON.stringify(JSON.parse(content), null, 2)}\n`)
  }
  if (file.endsWith('.js')) {
    return normalizeStableNames(content)
      .replace(/^\/\/#region .*\/src\//gm, '//#region <fixture>/src/')
      .replace(/\brequire_src_\w+\b/g, 'require_src')
      .replace(/require\("([^"]*wevu-src\.js)"\)\.__wevuCreatePage\(\{/g, '(require("$1").__wevuCreateWevuComponent || require("$1").to)({')
      .replace(/require\("([^"]*wevu-src\.js)"\)\.[A-Za-z_$][\w$]*\(\{/g, 'require("$1").__wevuCreatePage({')
      .replace(/require\("([^"]*wevu-src\.js)"\)\.__wevuCreatePage\(\{/g, '(require("$1").__wevuCreateWevuComponent || require("$1").to)({')
      .replace(/require_src\.[A-Za-z_$][\w$]*/g, 'require_src.__wevuScopedSlotCreator')
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
    expect(files).toMatchSnapshot('file-tree')
    expect(files.filter(file => file.includes('__scoped-slot-default'))).toEqual([
      'pages/index/index.__scoped-slot-default-0.js',
      'pages/index/index.__scoped-slot-default-0.json',
      'pages/index/index.__scoped-slot-default-0.wxml',
    ])
    expect(files.some(file => file.includes('__scoped-slot-default-1'))).toBe(false)

    const outputSnapshot: Record<string, string> = {}
    for (const file of files) {
      if (RUNTIME_VENDOR_RE.test(file) || !TEXT_OUTPUT_RE.test(file)) {
        continue
      }
      const content = await fs.readFile(path.join(distDir, file), 'utf-8')
      outputSnapshot[file] = normalizeOutputContent(file, content)
    }

    expect(outputSnapshot).toMatchSnapshot('text-outputs')
    expect(outputSnapshot['pages/index/index.__scoped-slot-default-0.wxml']).toContain(
      '<van-tabbar-item wx:for="{{__wv_bind_0}}"',
    )
    expect(outputSnapshot['pages/index/index.__scoped-slot-default-0.wxml']).toContain(
      'name="{{__wv_item_0.to.name}}"',
    )
    expect(outputSnapshot['pages/index/index.__scoped-slot-default-0.wxml']).toContain(
      '>{{__wv_item_0.label}}</van-tabbar-item>',
    )
    expect(outputSnapshot['pages/index/index.__scoped-slot-default-0.wxml']).not.toContain('generic:scoped-slots-default')
    expect(outputSnapshot['pages/index/index.__scoped-slot-default-0.js']).toContain(
      'createWevuScopedSlotComponent({ computed: __wevuComputed })',
    )
    expect(outputSnapshot['pages/index/index.__scoped-slot-default-0.js']).toContain('this.__wvOwnerProxy.tabItems')
    expect(outputSnapshot['pages/index/index.js']).toContain(
      `console.error("[wevu] 模板运行时表达式执行失败: __wv_bind_0 = {['default']:true}", __wv_expr_err)`,
    )
  })
})
