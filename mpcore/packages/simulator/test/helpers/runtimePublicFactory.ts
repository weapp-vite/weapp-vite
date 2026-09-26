import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { rolldown } from 'rolldown'

/** 与真实 IDE 复用原生页面源码，绕过 SFC 编译器验证公开动态工厂。 */
export async function createRuntimePublicFactoryFiles(): Promise<Array<[string, string]>> {
  const repoRoot = path.resolve(import.meta.dirname, '../../../../..')
  const fixtureRoot = path.join(repoRoot, 'e2e-apps/github-issues/fixtures/runtime-public-factory/src')
  const bundle = await rolldown({
    cwd: repoRoot,
    tsconfig: false,
    input: path.join(fixtureRoot, 'pages/index/index.ts'),
    transform: { define: {
      'import.meta.env.PLATFORM': '"weapp"',
      'import.meta': JSON.stringify({ env: { PLATFORM: 'weapp' } }),
    } },
    plugins: [{
      name: 'public-factory-source-runtime',
      resolveId(id) {
        if (id === 'wevu' || id === 'wevu/internal-runtime') {
          return path.join(repoRoot, `packages-runtime/wevu/src/${id === 'wevu' ? 'index' : 'internal-runtime'}.ts`)
        }
      },
    }],
  })
  try {
    const { output } = await bundle.generate({ format: 'cjs' })
    const page = output[0]
    if (output.length !== 1 || page?.type !== 'chunk') {
      throw new Error('Expected one public factory page chunk')
    }
    const files = ['app.json', 'pages/index/index.json', 'pages/index/index.wxml']
    const sources = await Promise.all(files.map(async file => [file, await readFile(path.join(fixtureRoot, file), 'utf8')] as [string, string]))
    return [
      ['project.config.json', '{"miniprogramRoot":"."}'],
      ['app.js', 'App({})'],
      ['pages/index/index.js', page.code],
      ...sources,
    ]
  }
  finally {
    await bundle.close()
  }
}
