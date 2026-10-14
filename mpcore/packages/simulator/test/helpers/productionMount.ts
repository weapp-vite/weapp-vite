import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { rolldown } from 'rolldown'

/** 与真实 IDE 使用相同页面源码，验证生产模式中的原生宿主和响应式挂载。 */
export async function createProductionMountFiles(): Promise<Array<[string, string]>> {
  const repoRoot = path.resolve(import.meta.dirname, '../../../../..')
  const fixtureRoot = path.join(repoRoot, 'e2e-apps/github-issues/fixtures/issue-1182/src')
  const bundle = await rolldown({
    cwd: repoRoot,
    tsconfig: false,
    input: {
      'app': path.join(fixtureRoot, 'app.ts'),
      'pages/index/index': path.join(fixtureRoot, 'pages/index/index.ts'),
    },
    transform: { define: { 'import.meta': JSON.stringify({ env: { PLATFORM: 'weapp', PROD: true, DEV: false } }) } },
    plugins: [{
      name: 'production-mount-source-runtime',
      resolveId(id) {
        if (id === 'wevu') {
          return path.join(repoRoot, 'packages-runtime/wevu/src/index.ts')
        }
      },
    }],
  })
  try {
    const { output } = await bundle.generate({ format: 'cjs', entryFileNames: '[name].js' })
    const files = ['app.json', 'pages/index/index.json', 'pages/index/index.wxml']
    const sources = await Promise.all(files.map(async file => [file, await readFile(path.join(fixtureRoot, file), 'utf8')] as [string, string]))
    return [
      ['project.config.json', '{"miniprogramRoot":"."}'],
      ...output.filter(item => item.type === 'chunk').map(item => [item.fileName, item.code] as [string, string]),
      ...sources,
    ]
  }
  finally {
    await bundle.close()
  }
}
