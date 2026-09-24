import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { createTempFixtureProject, createTestCompilerContext, getFixture } from './utils'

const templates = [
  'pages/native/index.wxml',
  'pages/vue/index.wxml',
  'components/keep-card/index.wxml',
  'components/DebugPanel.wxml',
  'sub/index.wxml',
  'independent/index.wxml',
  'shared/card.wxml',
]

describe('WXML transform final build artifacts', () => {
  it('awaits function chains once for native, mapped Vue, components, imports and both subpackage kinds', async () => {
    const project = await createTempFixtureProject(getFixture('wxml-remove'), 'wxml-transform')
    const compiler = await createTestCompilerContext({ cwd: project.tempDir, mode: 'transform', isDev: false })
    try {
      await compiler.ctx.buildService.build()
      for (const file of templates) {
        const code = await fs.readFile(path.join(project.tempDir, 'dist', file), 'utf8')
        if (file === 'shared/card.wxml') {
          expect(code).toContain('<view data-testid="included"')
          expect(code).toContain('data-transformed="{{true}}"')
          expect(code.match(/<!-- transform-once -->/g)).toHaveLength(1)
          continue
        }
        expect(code, file).toContain('data-rule="initial"')
        expect(code, file).toContain('data-analytics=')
        expect(code, file).toContain(`data-output="${file}"`)
        expect(code, file).toContain(`data-scope="${file.startsWith('independent/') ? 'independent' : 'main'}"`)
        expect(code.match(/<!-- transform-once -->/g), file).toHaveLength(1)
      }
      const native = await fs.readFile(path.join(project.tempDir, 'dist/pages/native/index.wxml'), 'utf8')
      expect(native).toContain('bindtap="tap"')
      expect(native).toContain('wx:if="{{visible}}"')
      expect(native).toMatch(/<view data-testid="precise-native-text" data-transformed="\{\{true\}\}">precise-native-child<\/view>/)
      const vue = await fs.readFile(path.join(project.tempDir, 'dist/pages/vue/index.wxml'), 'utf8')
      expect(vue).toContain('data-analytics="precise-vue"')
      expect(vue).toContain('bindtap=')
    }
    finally {
      await compiler.dispose()
      await project.cleanup()
    }
  }, 60_000)
})
