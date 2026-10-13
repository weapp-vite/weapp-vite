import type { OutputBundle } from 'rolldown'
import type { CompilerContext } from '../../../context'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import MagicString from 'magic-string'
import { afterEach } from 'vitest'
import { createCompiler, postcss } from 'weapp-tailwindcss/core'
import { createRuntimeState } from '../../../runtime/runtimeState'
import { createTailwindcssPlugin } from '../../tailwindcss'

const require = createRequire(import.meta.url)
const tailwindDirectory = path.dirname(require.resolve('tailwindcss/package.json'))
const cleanup: (() => Promise<void>)[] = []

afterEach(async () => {
  const errors: unknown[] = []
  for (const close of cleanup.splice(0).reverse()) {
    try {
      await close()
    }
    catch (error) {
      errors.push(error)
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, 'Tailwind generation fixture cleanup failed')
  }
})

function hook(hook: any) {
  return typeof hook === 'function' ? hook : hook?.handler
}

export function declarations(css: string, property: string) {
  const values: string[] = []
  postcss.parse(css).walkDecls(property, (declaration) => {
    values.push(declaration.value)
  })
  return values
}

/** 真实 CSS 插件只记录初始化次数，同时注册可观察的静态 utility。 */
export async function createGenerationFixture(entries = ['src/tailwind.css'], options: { conditionalMacros?: boolean } = {}) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-lifetime-')))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'src'), { recursive: true })
  await mkdir(path.join(root, 'node_modules'))
  await symlink(tailwindDirectory, path.join(root, 'node_modules/tailwindcss'), 'junction')
  const key = Symbol.for(`tailwind-lifetime-test:${randomUUID()}`)
  const probe = { initializations: 0 }
  const globals = globalThis as unknown as Record<symbol, typeof probe>
  globals[key] = probe
  cleanup.push(async () => {
    delete globals[key]
  })
  const plugin = path.join(root, 'src/probe.cjs')
  await writeFile(plugin, `const probe = globalThis[Symbol.for(${JSON.stringify(Symbol.keyFor(key))})];
module.exports = ({ addUtilities }) => {
  probe.initializations++;
  addUtilities({ '.fixture-plugin': { 'min-width': '23px' } });
};
`)
  const write = async (file: string, code: string) => {
    const filename = path.resolve(root, file)
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, code)
    return filename
  }
  const variants = options.conditionalMacros
    ? `@custom-variant mini { /* #ifdef MP-WEIXIN */ @slot; /* #endif */ }
@custom-variant foreign { /* #ifdef MP-ALIPAY */ @slot; /* #endif */ }
@utility fixture-foreign { width: 83px; }
@source inline("foreign:fixture-foreign");`
    : '@custom-variant mini (&);'
  const css = `@import "tailwindcss" source(none);
@plugin "./probe.cjs";
@source "./pages/**/*.wxml";
@source inline("fixture-plugin fixture-utility checked:fixture-utility mini:fixture-utility p-[19px]");
@source not inline("w-[99px]");
@utility fixture-utility { height: 31px; }
@custom-variant checked (&[data-state="ready"]);
${variants}
.author { @apply p-[17px]; color: #123456; }`
  for (const [index, entry] of entries.entries()) {
    await write(entry, `${css}\n.owner-${index} { margin-bottom: ${13 + index}px; }`)
  }
  await write('src/pages/index.wxml', '<view class="w-[37px] w-[99px] fixture-utility fixture-plugin" />')

  function owner(command: 'build' | 'serve', watch?: object) {
    const watched = new Set<string>()
    const ctx = {
      configService: {
        cwd: root,
        absoluteSrcRoot: path.join(root, 'src'),
        isDev: true,
        platform: 'weapp',
        outputExtensions: { wxml: 'wxml', wxss: 'wxss' },
        relativeOutputPath: (file: string) => path.relative(path.join(root, 'src'), file).replaceAll('\\', '/'),
        weappViteConfig: { tailwindcss: { cssEntries: entries, generator: { styleOptions: { platform: 'weapp' } } } },
      },
      runtimeState: createRuntimeState(),
    } as unknown as CompilerContext
    const plugins = createTailwindcssPlugin(ctx)
    const manager = plugins[0]!
    const pluginContext = {
      addWatchFile: (file: string) => watched.add(file),
      resolve: async (request: string, importer: string) => request.startsWith('.')
        ? { id: path.resolve(path.dirname(importer), request) }
        : null,
    }
    hook(manager.configResolved)({ command, build: { watch, sourcemap: true } })
    const close = async () => {
      await hook(manager.closeWatcher)?.call(pluginContext)
    }
    cleanup.push(close)
    const transform = async (code: string, file: string) => {
      const result: unknown = await hook(manager.transform).call(pluginContext, code, path.resolve(root, file), {})
      assert.ok(result && (typeof result === 'string' || (typeof result === 'object' && 'code' in result && typeof result.code === 'string')))
      return typeof result === 'string' ? result : result.code as string
    }
    const render = async (classes = 'w-[37px] fixture-plugin fixture-utility') => {
      await hook(manager.buildStart).call(pluginContext, {})
      const markers = await Promise.all(entries.map(async (entry) => {
        const filename = path.join(root, entry)
        const source = await hook(manager.load).call(pluginContext, filename)
        return transform(source, entry)
      }))
      const scriptFile = 'pages/probe/index.js'
      const script = `export const classes = ${JSON.stringify(classes)};`
      // bundler 开启 sourcemap 时先提供原始映射，输出转换再按正式契约组合映射。
      const scriptMap = new MagicString(script).generateMap({ source: scriptFile, includeContent: true, hires: true })
      const bundle = {
        'app.wxss': { type: 'asset', fileName: 'app.wxss', source: markers.join('\n') },
        'pages/probe/index.wxml': { type: 'asset', fileName: 'pages/probe/index.wxml', source: `<view class="${classes}" />` },
        [scriptFile]: { type: 'chunk', fileName: scriptFile, code: script, map: scriptMap },
      } as unknown as OutputBundle
      for (const plugin of plugins) {
        await hook(plugin.generateBundle)?.call(pluginContext, {}, bundle, false)
      }
      return {
        css: String((bundle['app.wxss'] as { source: string }).source),
        template: String((bundle['pages/probe/index.wxml'] as { source: string }).source),
        script: (bundle['pages/probe/index.js'] as { code: string }).code,
        map: (bundle['pages/probe/index.js'] as { map: unknown }).map,
      }
    }
    return {
      render,
      transform,
      watched,
      close,
      change: async (file: string, event: 'create' | 'update' | 'delete' = 'update') => await hook(manager.watchChange).call(pluginContext, path.resolve(root, file), { event }),
      buildEnd: async (error?: Error) => await hook(manager.buildEnd).call(pluginContext, error),
      closeBundle: async () => await hook(plugins[1]!.closeBundle).call(pluginContext),
    }
  }
  async function generateCore(incrementalCache: boolean) {
    const compiler = createCompiler({ appType: 'weapp-vite', tailwindcssBasedir: root, platform: 'weapp' })
    cleanup.push(() => compiler.dispose())
    const generated = await compiler.generate({
      id: `lifetime:${incrementalCache}`,
      sourceOptions: { projectRoot: root, cssEntries: [path.join(root, entries[0]!)], packageName: 'tailwindcss' },
      target: 'weapp',
      scanSources: true,
      incrementalCache,
      styleOptions: { platform: 'weapp' },
    })
    return { generated, compiler }
  }
  return { root, entries, probe, owner, write, generateCore }
}
