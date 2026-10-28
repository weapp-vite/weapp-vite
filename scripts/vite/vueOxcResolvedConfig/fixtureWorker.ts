import type { InlineConfig } from 'vite'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import vue from '@vitejs/plugin-vue'
import { build, createServer } from 'vite'
import * as compiler from 'vue/compiler-sfc'
import { createVueOxcTsconfigGuard } from '../vueOxcTsconfigGuard'

export type FixtureMode = 'serve-explicit' | 'serve-discovery' | 'build-guard'
export type FixtureResult = {
  success: true
  code: string
  devServerRestored?: boolean
  includePreserved: boolean
} | {
  success: false
  error: string
}

const root = process.cwd()
const configFile = path.join(root, 'web/tsconfig.json')
const require = createRequire(import.meta.url)
const config: InlineConfig = {
  configFile: false,
  root,
  cacheDir: path.join(root, 'cache'),
  clearScreen: false,
  logLevel: 'silent',
  resolve: { alias: [{ find: 'vue', replacement: require.resolve('vue/dist/vue.runtime.esm-bundler.js') }] },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, watch: null },
}

function failure(error: unknown): FixtureResult {
  return { success: false, error: error instanceof Error ? error.message : String(error) }
}

async function run(mode: FixtureMode): Promise<FixtureResult> {
  const vuePlugin = vue({ compiler, include: /\.vue$/ })
  const api = vuePlugin.api
  if (!api) {
    throw new Error('Expected the real Vue plugin to expose its public API')
  }
  const previousDevServer = api.options.devServer
  const previousInclude = api.include
  if (mode === 'build-guard') {
    try {
      const result = await build({
        ...config,
        tsconfig: configFile,
        plugins: [vuePlugin, createVueOxcTsconfigGuard(vuePlugin)],
        build: {
          write: false,
          emptyOutDir: false,
          minify: false,
          lib: { entry: path.join(root, 'Fixture.vue'), formats: ['es'], fileName: 'fixture' },
          rolldownOptions: { external: ['vue'] },
        },
      })
      if (!Array.isArray(result) && !('output' in result)) {
        await result.close()
        throw new Error('Expected an in-memory build result rather than a watcher')
      }
      const outputs = Array.isArray(result) ? result : [result]
      return {
        success: true,
        code: outputs.flatMap(output => output.output.flatMap(file => file.type === 'chunk' ? [file.code] : [])).join('\n'),
        devServerRestored: api.options.devServer === previousDevServer,
        includePreserved: api.include === previousInclude,
      }
    }
    catch (error) {
      return failure(error)
    }
  }
  const server = await createServer({
    ...config,
    ...(mode === 'serve-explicit' ? { tsconfig: configFile } : {}),
    plugins: [vuePlugin],
  })
  try {
    const transformed = await server.transformRequest('/Fixture.vue')
    if (!transformed) {
      throw new Error('Expected the Vue TS fixture to produce a transformed module')
    }
    return {
      success: true,
      code: transformed.code,
      includePreserved: api.include === previousInclude,
    }
  }
  catch (error) {
    return failure(error)
  }
  finally {
    await server.close()
  }
}

const mode = process.argv[2]
if (mode !== 'serve-explicit' && mode !== 'serve-discovery' && mode !== 'build-guard') {
  throw new Error('Expected a supported Vue/OXC fixture mode')
}
process.stdout.write(JSON.stringify(await run(mode)))
