import { access, cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { rolldown } from 'rolldown'
import { createStatefulHmrHostFormatPlugin } from '../../packages/weapp-vite/src/runtime/statefulHmr/hostFormat'

/** 直接验收宿主格式转换，避免被微信启动时的 classic 安全回退绕开。 */
export async function createStatefulHostFormatProject() {
  const root = path.resolve(import.meta.dirname, '../..')
  const fixture = path.join(root, 'e2e-apps/stateful-host-format')
  const parent = path.join(root, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const projectRoot = await mkdtemp(path.join(parent, 'stateful-host-format-'))
  const distRoot = path.join(projectRoot, 'dist')
  const cleanup = () => rm(projectRoot, { recursive: true, force: true })
  try {
    for (const file of ['project.config.json', 'project.private.config.json']) {
      await cp(path.join(fixture, file), path.join(projectRoot, file))
    }
    const assets = ['app.json', 'pages/index/index.json', 'pages/index/index.wxml']
    const bundle = await rolldown({
      input: {
        'app': path.join(fixture, 'src/app.ts'),
        'pages/index/index': path.join(fixture, 'src/pages/index/index.ts'),
      },
      plugins: [createStatefulHmrHostFormatPlugin(), {
        name: 'stateful-host-format-fixture-assets',
        async buildStart() {
          for (const fileName of assets) {
            this.emitFile({ type: 'asset', fileName, source: await readFile(path.join(fixture, 'src', fileName), 'utf8') })
          }
        },
      }],
    })
    try {
      const { output } = await bundle.write({
        dir: distRoot,
        format: 'esm',
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        sourcemap: true,
      })
      if (!output.some(item => item.type === 'chunk' && item.isDynamicEntry)) {
        throw new Error('Expected preserved dynamic chunks in the host format fixture')
      }
    }
    finally {
      await bundle.close()
    }
    for (const file of ['app.js', 'pages/index/index.js', ...assets]) {
      await access(path.join(distRoot, file))
    }
    return { projectRoot, cleanup }
  }
  catch (error) {
    await cleanup()
    throw error
  }
}
