import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { finished } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

it.each([false, true])('naturally exits after Sass updates hand the stateful engine over to classic (Tailwind=%s)', async (tailwind) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-stateful-sass-shutdown-')))
  const dependencies = fileURLToPath(new URL('../../../../../node_modules', import.meta.url))
  const host = new URL('../../vite/index.ts', import.meta.url).href
  const runtime = new URL('../hmrRuntimeSession.ts', import.meta.url).href
  let child: ReturnType<typeof spawn> | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    // 保留 fixture 自有的 npm 缓存目录，避免整棵依赖链接把写入带到共享工作区。
    const nodeModules = path.join(root, 'node_modules')
    await mkdir(nodeModules)
    for (const name of tailwind ? ['sass-embedded', 'tailwindcss'] : ['sass-embedded']) {
      await symlink(await realpath(path.join(dependencies, name)), path.join(nodeModules, name), process.platform === 'win32' ? 'junction' : 'dir')
    }
    const script = path.join(root, 'sass-handoff.mts')
    await writeFile(script, `
      import assert from 'node:assert/strict'
      import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
      import path from 'node:path'
      import { setTimeout as delay } from 'node:timers/promises'
      import { createServer, preprocessCSS } from ${JSON.stringify(import.meta.resolve('vite'))}
      import { weapp } from ${JSON.stringify(host)}
      import { getHmrRuntimeSession } from ${JSON.stringify(runtime)}
      const root = ${JSON.stringify(root)}
      for (const [file, source] of Object.entries({
        'package.json': '{"name":"stateful-sass-shutdown","private":true,"type":"module"}',
        'project.config.json': '{"appid":"wxb3d842a4a7e3440d","miniprogramRoot":"dist/","srcMiniprogramRoot":"src/"}',
        'project.private.config.json': '{"setting":{"compileHotReLoad":true},"condition":{"miniprogram":{"list":[{"name":"Sass handoff","pathName":"pages/home/index"}]}}}',
        'src/app.js': ${JSON.stringify(tailwind ? 'import "./tailwind.css"; App({})' : 'App({})')},
        'src/app.json': '{"pages":["pages/home/index"]}',
        'src/app.scss': '$brand: red; page { color: $brand; }',
        'src/tailwind.css': '@import "tailwindcss";',
        'src/pages/home/index.js': 'Page({ data: { count: 1 } })',
        'src/pages/home/index.json': '{}',
        'src/pages/home/index.wxml': '<view class="owner">{{count}}</view>',
        'src/pages/home/index.scss': '$gap: 1px; .owner { padding-left: $gap; }',
      })) {
        await mkdir(path.dirname(path.join(root, file)), { recursive: true })
        await writeFile(path.join(root, file), source)
      }
      let buildStarts = 0
      const startedAt = performance.now()
      const hosts = []
      const watcherEvents = []
      let eventSequence = 0
      let droppedWatcherEvents = 0
      const relativeFile = file => {
        const relative = path.relative(root, path.resolve(root, file))
        return relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)
          ? '<external>' : relative.split(path.sep).join('/') || '.'
      }
      const recordWatcherEvent = (host, event, file) => {
        if (watcherEvents.length === 128) {
          watcherEvents.shift()
          droppedWatcherEvents++
        }
        watcherEvents.push({ sequence: ++eventSequence, elapsedMs: performance.now() - startedAt, host, event, file: file && relativeFile(file) })
      }
      const server = await createServer({ root, configFile: false, logLevel: 'silent', plugins: [weapp(), {
        name: 'sass-generation-observer', buildStart() { buildStarts++ },
        configureServer(host) {
          const index = hosts.length
          hosts.push({ config: host.config, watcher: host.watcher })
          host.watcher.on('all', (event, file) => recordWatcherEvent(index, event, file))
          host.watcher.on('ready', () => recordWatcherEvent(index, 'ready'))
          recordWatcherEvent(index, host.watcher._readyEmitted ? 'attached-after-ready' : 'attached-before-ready')
        },
      }],
        weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false }, hmr: { runtime: 'stateful-experimental' },
          tailwindcss: ${tailwind ? '{ cssEntries: ["src/tailwind.css"] }' : 'false'},
        },
        server: { middlewareMode: true, host: '127.0.0.1', port: 0, ws: false },
        build: { minify: false, cssMinify: false },
      })
      try {
        const context = server.config.plugins.find(plugin => plugin.name === 'weapp-vite:context')?.api?.ctx
        assert.ok(context, 'missing compiler context')
        const session = getHmrRuntimeSession(context)
        assert.equal(session.phase, 'stateful')
        const output = path.join(root, 'dist/pages/home/index.wxss')
        const diagnose = async label => {
          const read = file => readFile(file, 'utf8').then(source => source.slice(0,2000), error => ({ errorCode: error.code }))
          process.stderr.write('[sass-handoff] ' + JSON.stringify({
            label, phase: session.phase,
            fallback: session.fallback && { ...session.fallback, files: session.fallback.files?.map(relativeFile) },
            buildStarts,
            style: await read(path.join(root, 'src/pages/home/index.scss')),
            output: await read(output),
            hosts: hosts.map(host => {
              const current = host.config.plugins.find(plugin => plugin.name === 'weapp-vite:context')?.api?.ctx
              return {
                bundledDev: host.config.experimental.bundledDev,
                runtime: current?.configService.weappViteConfig.hmr,
                compileHotReLoad: current?.configService.projectPrivateConfig.setting?.compileHotReLoad,
                watcherClosed: host.watcher.closed, watcherReady: host.watcher._readyEmitted,
                watched: Object.entries(host.watcher.getWatched()).map(([directory, files]) => ({ directory: relativeFile(directory), files })),
              }
            }),
            watcherEvents, droppedWatcherEvents,
          }) + '\\n')
        }
        const until = async (check, label) => {
          const deadline = Date.now() + 10000
          while (!(await check())) {
            if (Date.now() >= deadline) {
              await diagnose(label).catch(error => process.stderr.write('[sass-handoff-diagnostic-error] ' + error.name + '\\n'))
              throw new Error(label)
            }
            await delay(20)
          }
        }
        const style = path.join(root, 'src/pages/home/index.scss')
        // 初次 buildEnd 后公开预处理会重开同一 CSS 池；真实完整重建必须先释放旧池。
        const preprocessed = await preprocessCSS(await readFile(style, 'utf8'), style, server.config)
        assert.ok(preprocessed.code.includes('1px'))
        const engine = server.environments.client.bundledDev?._devEngine
        assert.ok(engine, 'missing native stateful engine')
        const beforeRebuild = buildStarts
        await engine.ensureCurrentBuildFinish()
        engine.triggerFullBuild()
        await engine.ensureLatestBuildOutput()
        await session.whenSettled()
        assert.ok(buildStarts > beforeRebuild, 'native full rebuild did not invoke buildStart')
        assert.equal(session.phase, 'stateful')
        for (const width of [3, 7, 1]) {
          await writeFile(style, '$gap: ' + width + 'px; .owner { padding-left: $gap; }')
          await until(async () => (await readFile(output, 'utf8')).includes(width + 'px'), 'Sass publication missing ' + width)
          await session.whenSettled()
          assert.equal(session.phase, 'classic')
          assert.equal(session.fallback?.code, 'stylesheet-output')
        }
        const cacheDirectory = path.join(root, 'node_modules/weapp-vite/.cache')
        assert.equal(await realpath(cacheDirectory), cacheDirectory, 'npm cache escaped the isolated fixture')
      }
      finally { await server.close() }
      process.stdout.write('SASS_CLASSIC_HANDOFF_CLOSED\\n')
    `)
    child = spawn(process.execPath, ['--import', 'tsx', script], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout!.on('data', chunk => stdout += String(chunk))
    child.stderr!.on('data', chunk => stderr += String(chunk))
    const exited = once(child, 'exit')
    timeout = setTimeout(() => child!.kill('SIGKILL'), 25_000)
    const [[code, signal]] = await Promise.all([exited, finished(child.stdout!), finished(child.stderr!)])
    expect(signal, `${stdout}\n${stderr}`).toBeNull()
    expect(code, `${stdout}\n${stderr}`).toBe(0)
    expect(stdout).toContain('SASS_CLASSIC_HANDOFF_CLOSED\n')
  }
  finally {
    clearTimeout(timeout)
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGKILL')
      await exited
    }
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)
