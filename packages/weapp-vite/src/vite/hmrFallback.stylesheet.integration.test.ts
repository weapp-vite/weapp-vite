import type { Plugin, ViteDevServer } from 'vite'
import type { HmrRuntimeSession } from '../runtime/hmrRuntimeSession'
import type { WeappVitePluginApi } from '../types'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'
import { createServer } from 'vite'
import { expect, it } from 'vitest'
import { getHmrRuntimeSession } from '../runtime/hmrRuntimeSession'
import { weapp } from './index'

it('replaces optional stylesheet ownership and preserves required import errors after classic handoff', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-classic-style-scan-')))
  const style = path.join(root, 'src/pages/home/index.wxss')
  const requiredStyle = path.join(root, 'src/pages/home/required.css')
  let runtime: HmrRuntimeSession | undefined
  let server: ViteDevServer | undefined
  let classicPublications = 0
  let holdClassicPublication = true
  let classicPrewriteEntered = false
  const releaseClassicPrewrite = Promise.withResolvers<void>()
  const classicBuildErrors: Error[] = []
  const probe: Plugin = {
    name: 'classic-style-scan-publication-probe',
    configureServer(host) {
      if (!runtime) {
        const api = host.config.plugins.find(plugin => plugin.name === 'weapp-vite:context')?.api as WeappVitePluginApi | undefined
        if (!api) {
          throw new Error('The style scan fixture did not expose its compiler context')
        }
        runtime = getHmrRuntimeSession(api.ctx)
      }
    },
    buildEnd(error) {
      if (error && runtime && runtime.phase !== 'stateful') {
        classicBuildErrors.push(error)
      }
    },
    generateBundle: {
      order: 'post',
      sequential: true,
      async handler() {
        if (!holdClassicPublication || !runtime?.fallback || this.environment.config.build.write === false) {
          return
        }
        holdClassicPublication = false
        classicPrewriteEntered = true
        await releaseClassicPrewrite.promise
      },
    },
    writeBundle: {
      order: 'post',
      sequential: true,
      handler() {
        if (runtime && runtime.phase !== 'stateful') {
          classicPublications++
        }
      },
    },
  }
  const readStyle = () => readFile(path.join(root, 'dist/pages/home/index.wxss'), 'utf8')
  const expectClassic = async () => {
    expect(runtime!.phase).toBe('classic')
    expect(server!.config.experimental.bundledDev).toBe(false)
    for (const file of [WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE]) {
      await expect(readFile(path.join(root, 'dist', file))).rejects.toMatchObject({ code: 'ENOENT' })
    }
  }
  try {
    for (const [file, content] of Object.entries({
      'package.json': '{"name":"classic-style-scan-fixture","type":"module"}',
      'project.config.json': '{"appid":"wxb3d842a4a7e3440d","miniprogramRoot":"dist"}',
      'project.private.config.json': '{"setting":{"compileHotReLoad":true},"condition":{"miniprogram":{"list":[{"name":"Style scan","pathName":"pages/home/index"}]}}}',
      'src/app.js': 'App({})',
      'src/app.json': '{"pages":["pages/home/index"]}',
      'src/pages/home/index.js': 'import "./index.css"; import "./required.css"; Page({ data: { message: "style-scan-owner" } })',
      'src/pages/home/index.json': '{}',
      'src/pages/home/index.wxml': '<view class="owner">{{message}}</view>',
      'src/pages/home/index.css': '.owner { color: #1f1a3f; }',
      'src/pages/home/index.wxss': '.owner { border-top-width: 1px; }',
      'src/pages/home/required.css': '.owner { padding-left: 13px; }',
    })) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), content)
    }
    server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp(), probe],
      weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false }, hmr: { runtime: 'stateful-experimental' } },
      server: { middlewareMode: true, host: '127.0.0.1', port: 0, ws: false },
      build: { minify: false, cssMinify: false },
    })
    const statefulStyle = await readStyle()
    expect(statefulStyle).toContain('1px')
    await writeFile(style, '.owner { border-top-width: 3px; }')
    await expect.poll(() => runtime!.fallback?.code, { timeout: 15_000 }).toBe('stylesheet-output')
    await expect.poll(() => classicPrewriteEntered, { timeout: 15_000 }).toBe(true)
    expect(runtime!.phase).toBe('switching')
    expect(classicPublications).toBe(0)
    expect(await readStyle()).toBe(statefulStyle)
    releaseClassicPrewrite.resolve()
    await runtime!.whenSettled()
    await expect.poll(readStyle, { timeout: 15_000 }).toContain('3px')
    await expectClassic()

    for (const width of [undefined, 5, undefined, 7]) {
      const previousPublications = classicPublications
      if (width === undefined) {
        await rm(style)
      }
      else {
        await writeFile(style, `.owner { border-top-width: ${width}px; }`)
      }
      await expect.poll(() => classicPublications, { timeout: 15_000 }).toBeGreaterThan(previousPublications)
      await expect.poll(async () => {
        const output = await readStyle()
        return {
          hasSourceColor: output.includes('#1f1a3f'),
          hasRequiredPadding: output.includes('13px'),
          borderWidths: Array.from(output.matchAll(/border-top-width\s*:\s*([^;}\s]+)/g), match => match[1]),
        }
      }, { timeout: 15_000 }).toEqual({
        hasSourceColor: true,
        hasRequiredPadding: true,
        borderWidths: width === undefined ? [] : [`${width}px`],
      })
      const output = await readStyle()
      expect(output).toContain('#1f1a3f')
      if (width === undefined) {
        expect(output).not.toContain('border-top-width')
      }
      else {
        expect(output).toContain(`${width}px`)
      }
      await expectClassic()
    }

    const lastSuccessfulStyle = await readStyle()
    expect(lastSuccessfulStyle).toContain('#1f1a3f')
    expect(lastSuccessfulStyle).toContain('7px')
    expect(lastSuccessfulStyle).toContain('13px')
    const previousPublications = classicPublications
    const previousErrors = classicBuildErrors.length
    await rm(requiredStyle)
    await expect.poll(() => classicBuildErrors.length, { timeout: 15_000 }).toBeGreaterThan(previousErrors)
    expect(classicBuildErrors.at(-1)?.message).toContain('required.css')
    expect(classicPublications).toBe(previousPublications)
    expect(await readStyle()).toBe(lastSuccessfulStyle)
    await expectClassic()

    await writeFile(requiredStyle, '.owner { padding-left: 17px; }')
    await expect.poll(() => classicPublications, { timeout: 15_000 }).toBeGreaterThan(previousPublications)
    await expect.poll(readStyle, { timeout: 15_000 }).toContain('17px')
    const restoredStyle = await readStyle()
    expect(restoredStyle).toContain('#1f1a3f')
    expect(restoredStyle).toContain('7px')
    expect(restoredStyle).not.toContain('13px')
    await expectClassic()
  }
  finally {
    releaseClassicPrewrite.resolve()
    await server?.close()
    await rm(root, { recursive: true, force: true })
  }
}, 90_000)
