import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { rolldown } from 'rolldown'

/** 复用真实 IDE 的阶段观测页面，避免 simulator 另写一套适配器语义。 */
export async function createSetDataPhaseFiles(): Promise<Array<[string, string]>> {
  const root = path.resolve(import.meta.dirname, '../../../../..')
  const source = path.join(root, 'e2e-apps/github-issues/src/pages/issue-1138')
  const bundle = await rolldown({
    cwd: root,
    tsconfig: false,
    input: {
      'app': 'virtual:set-data-app',
      'pages/issue-1138/index': path.join(source, 'index.ts'),
      'pages/issue-1138/delayed': path.join(source, 'delayed.ts'),
    },
    plugins: [{
      name: 'wevu-source',
      resolveId: id => id === 'wevu' ? path.join(root, 'packages-runtime/wevu/src/index.ts') : id === 'virtual:set-data-app' ? id : undefined,
      load: id => id === 'virtual:set-data-app' ? 'import { createApp } from "wevu"; createApp({});' : undefined,
    }],
    transform: { define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.PLATFORM': '"weapp"', 'import.meta': JSON.stringify({ env: { PLATFORM: 'weapp' } }) } },
  })
  try {
    const { output } = await bundle.generate({ format: 'cjs', entryFileNames: '[name].js' })
    const files: Array<[string, string]> = output.filter(item => item.type === 'chunk').map(item => [item.fileName, item.code])
    for (const name of ['index', 'delayed']) {
      files.push([`pages/issue-1138/${name}.wxml`, await readFile(path.join(source, `${name}.wxml`), 'utf8')])
      files.push([`pages/issue-1138/${name}.json`, '{}'])
    }
    return [
      ...files,
      ['project.config.json', JSON.stringify({ miniprogramRoot: '.', compileType: 'miniprogram' })],
      ['app.json', JSON.stringify({ pages: ['pages/issue-1138/index', 'pages/issue-1138/delayed'] })],
    ]
  }
  finally {
    await bundle.close()
  }
}
