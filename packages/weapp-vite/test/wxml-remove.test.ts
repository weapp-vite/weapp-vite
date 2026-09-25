import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { createTempFixtureProject, createTestCompilerContext, getFixture, scanFiles } from './utils'

const fixtureSource = getFixture('wxml-remove')

async function buildFixture(mode: string) {
  const project = await createTempFixtureProject(fixtureSource, `wxml-remove-${mode}`)
  let dispose: (() => Promise<void>) | undefined
  try {
    const compiler = await createTestCompilerContext({ cwd: project.tempDir, mode, isDev: false })
    dispose = compiler.dispose
    await compiler.ctx.buildService.build()
    const dist = path.join(project.tempDir, 'dist')
    const files = await scanFiles(dist)
    const outputs: Record<string, string> = {}
    for (const file of files) {
      if (/\.(?:wxml|json)$/.test(file)) {
        outputs[file] = await fs.readFile(path.join(dist, file), 'utf8')
      }
    }
    return { files, outputs }
  }
  finally {
    await dispose?.()
    await project.cleanup()
  }
}

const templateCases = [
  ['pages/native/index.wxml', 'native'],
  ['pages/vue/index.wxml', 'vue'],
  ['components/keep-card/index.wxml', 'native-component'],
  ['components/DebugPanel.wxml', 'vue-component'],
  ['sub/index.wxml', 'subpackage'],
  ['independent/index.wxml', 'independent'],
  ['shared/card.wxml', 'included'],
] as const

function expectRuntimeSemantics(outputs: Record<string, string>) {
  const native = outputs['pages/native/index.wxml']
  expect(native).toContain('wx:if="{{visible}}"')
  expect(native).toContain('wx:for="{{items}}"')
  expect(native).toContain('wx:key="*this"')
  expect(native).toContain('bindtap="tap"')
  expect(native).toContain('data-id="runtime"')
  expect(native).toContain('aria-label="accessible"')
  expect(native).toContain('data-testid-extra="keep"')
  expect(native).toContain(`text: '<debug-panel data-testid="inside"> > <!-- raw-comment -->'`)
  expect(native).not.toContain('excluded-platform')
  expect(native).toContain(String.raw`title="{{ label === \"legacy\" ? \"ok\" : \"other\" }}"`)
  expect(native).toContain('legacy-escaped-content')
  expect(outputs['pages/runtime/index.wxml']).toContain(String.raw`probe="{{ 'a\\'b' }}"`)
  expect(outputs['pages/vue/index.wxml']).toContain('wx:if=')
  expect(outputs['pages/vue/index.wxml']).toContain('wx:for=')
  expect(outputs['pages/vue/index.wxml']).toContain('bindtap=')
}

describe('WXML remove final build artifacts', () => {
  it('keeps historical attributes and removes ordinary comments when unconfigured', async () => {
    const { outputs } = await buildFixture('legacy')
    for (const [file, value] of templateCases) {
      expect(outputs[file], file).toContain(`data-testid="${value}"`)
    }
    expect(outputs['pages/native/index.wxml']).not.toContain('native-comment')
    expect(outputs['pages/vue/index.wxml']).not.toContain('vue-comment')
    expect(outputs['pages/native/index.wxml']).not.toContain('legacy-boundary-comment')
    expect(outputs['pages/native/index.wxml']).toContain(String.raw`data-testid="\"legacy-id\""`)
    expectRuntimeSemantics(outputs)
  }, 60_000)

  it('uses the production preset consistently without deleting nodes or accessibility attributes', async () => {
    const { outputs } = await buildFixture('production')
    for (const [file, value] of templateCases) {
      expect(outputs[file], file).not.toContain(`data-testid="${value}"`)
    }
    const native = outputs['pages/native/index.wxml']
    expect(native).not.toMatch(/data-(?:test|cy|qa)="/)
    expect(native).not.toContain('native-comment')
    expect(native).toContain('nested-debug-content')
    expect(native).toContain('data-debug-info="remove-scoped"')
    expect(native).not.toContain('legacy-id')
    expect(native).toContain(String.raw`data-debug-payload="{\"name\":\"probe\"}"`)
    expect(outputs['pages/vue/index.wxml']).not.toContain('vue-comment')
    expectRuntimeSemantics(outputs)
  }, 60_000)

  it.each(['development', 'empty'])('preserves comments and attributes for %s without disabling conditional compilation', async (mode) => {
    const { outputs } = await buildFixture(mode)
    for (const [file, value] of templateCases) {
      expect(outputs[file], file).toContain(`data-testid="${value}"`)
    }
    expect(outputs['pages/native/index.wxml']).toContain('<!-- native-comment -->')
    expect(outputs['pages/vue/index.wxml']).toContain('<!-- vue-comment -->')
    expect(outputs['components/DebugPanel.wxml']).toContain('<!-- vue-component-comment -->')
    expect(outputs['sub/index.wxml']).toContain('<!-- sub-comment -->')
    expect(outputs['independent/index.wxml']).toContain('<!-- independent-comment -->')
    expectRuntimeSemantics(outputs)
  }, 60_000)

  it('matches final tags, scopes attribute rules, removes subtrees but not their dependencies', async () => {
    const { files, outputs } = await buildFixture('custom')
    const native = outputs['pages/native/index.wxml']
    expect(native).toContain('data-testid="native"')
    expect(native).toContain('<!-- native-comment -->')
    expect(native).not.toContain('data-debug-info="remove-scoped"')
    expect(native).toContain('data-debug-info="business-prop"')
    expect(native).not.toContain('data-debug-payload')
    expect(native).not.toContain(String.raw`\"name\":\"probe\"`)
    expect(native).not.toContain('nested-debug-content')
    expect(native).not.toContain('dev-subtree')
    expect(native).toContain('business-content')
    const vue = outputs['pages/vue/index.wxml']
    expect(vue).toContain('<view')
    expect(vue).not.toContain('mapped-debug')
    expect(vue).not.toContain('<debug-panel')
    expect(vue).toContain('vue-business-content')
    expect(outputs['pages/native/index.json']).toContain('debug-panel')
    expect(files).toContain('components/debug-panel/index.js')
    expect(outputs['components/debug-panel/index.wxml']).toContain('debug-component-body')
    expectRuntimeSemantics(outputs)
  }, 60_000)

  it('removes an exact attribute only on final view tags in native and mapped Vue templates', async () => {
    const { outputs } = await buildFixture('precise')
    for (const kind of ['native', 'vue']) {
      const template = outputs[`pages/${kind}/index.wxml`]
      expect(template).not.toContain(`data-testid="precise-${kind}"`)
      expect(template).toMatch(new RegExp(`<view[^>]*data-testid-extra="precise-${kind}-extra"[^>]*>\\s*<text data-testid="precise-${kind}-text">precise-${kind}-child</text>\\s*</view>`))
      expect(template).toContain(`<!-- ${kind}-comment -->`)
    }
    expect(outputs['pages/native/index.wxml']).toContain('data-testid="keep-prop"')
    expect(outputs['pages/vue/index.wxml']).toContain('data-testid="vue-component-call"')
    expectRuntimeSemantics(outputs)
  }, 60_000)

  it('removes only comments with an explicitly empty attribute list', async () => {
    const { outputs } = await buildFixture('comments')
    expect(outputs['pages/native/index.wxml']).toContain('data-testid="native"')
    expect(outputs['pages/native/index.wxml']).not.toContain('native-comment')
    expect(outputs['pages/vue/index.wxml']).toContain('data-testid="vue"')
    expect(outputs['pages/vue/index.wxml']).not.toContain('vue-comment')
  }, 60_000)

  it('preserves event and conditional runtime contracts under broad cleanup', async () => {
    const { outputs } = await buildFixture('runtime')
    const runtime = outputs['pages/runtime/index.wxml']
    expect(runtime).toContain('bind_ready="recordReady"')
    expect(runtime).toContain(String.raw`wx:if="{{label === \"legacy\"}}"`)
    expect(runtime).toContain('id="event-result"')
    expect(runtime).toContain('{{eventCount}}')
    expect(runtime).not.toContain('data-testid')
    expect(runtime).not.toContain('runtime-comment')
  }, 60_000)

  it.each(['unsafe', 'framework'])('rejects %s deletion with an output file location', async (mode) => {
    await expect(buildFixture(mode)).rejects.toThrow(/pages\/native\/index\.wxml.*\d:\d+/s)
  }, 60_000)
})
