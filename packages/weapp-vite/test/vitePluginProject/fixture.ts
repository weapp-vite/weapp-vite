import type { InlineConfig } from 'vite'
import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach } from 'vitest'
import { weapp } from '../../src/vite'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

export async function fixture(nested = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-plugin-project-'))
  roots.push(root)
  const pluginOutput = nested ? 'dist/plugin' : 'dist-plugin'
  const files = {
    'package.json': '{"name":"plugin-project-host","private":true,"type":"module"}',
    'project.config.json': JSON.stringify({ miniprogramRoot: 'dist/', pluginRoot: `${pluginOutput}/`, compileType: 'plugin' }),
    'vite.config.mjs': 'throw new Error("child must not reload config")',
    'src/app.ts': 'import { message } from "../shared/message"; App({ globalData: { message } })',
    'src/app.json': '{"pages":["pages/home/index"]}',
    'src/pages/home/index.ts': 'Page({})',
    'src/pages/home/index.json': '{}',
    'src/pages/home/index.wxml': '<view>plugin host</view>',
    'plugin/plugin.json': '{"main":"index.js","pages":{"hello":"pages/hello/index"}}',
    'plugin/index.ts': 'export { message } from "../shared/message"',
    'plugin/pages/hello/index.ts': 'Page({})',
    'plugin/pages/hello/index.json': '{}',
    'plugin/pages/hello/index.wxml': '<view>plugin page</view>',
    'shared/message.ts': 'export const message = "plugin original"',
  }
  for (const [file, source] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), source)
  }
  let publishedManifest: unknown
  const config: InlineConfig = {
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [weapp(), {
      name: 'fixture:plugin-publication',
      enforce: 'post',
      writeBundle: {
        order: 'post',
        sequential: true,
        handler(_options, bundle) {
          const manifest = bundle['plugin.json']
          if (manifest?.type === 'asset') {
            const source = typeof manifest.source === 'string' ? manifest.source : Buffer.from(manifest.source).toString('utf8')
            publishedManifest = JSON.parse(source) as unknown
          }
        },
      },
    }],
    weapp: { srcRoot: 'src', pluginRoot: 'plugin', npm: { enable: false }, hmr: { runtime: 'classic' } },
    build: { minify: false },
    server: { middlewareMode: true },
  }
  const read = () => readFile(path.join(root, pluginOutput, 'index.js'), 'utf8')
  const edit = (source: string) => writeFile(path.join(root, 'shared/message.ts'), source)
  const pluginState = async () => {
    const pageFiles = await Promise.all(['js', 'json', 'wxml'].map(async (extension) => {
      const file = `pages/hello/index.${extension}`
      try {
        await readFile(path.join(root, pluginOutput, file))
        return file
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return undefined
        }
        throw error
      }
    }))
    return {
      publishedManifest,
      manifest: JSON.parse(await readFile(path.join(root, pluginOutput, 'plugin.json'), 'utf8')) as unknown,
      entry: await read(),
      pageFiles: pageFiles.filter(file => file !== undefined),
    }
  }
  return { root, config, read, edit, pluginOutput, pluginState }
}
