import type { ViteDevServer } from 'vite'
import type { DashboardAnalyzeSnapshot } from '../../../packages/weapp-vite/src/dashboard/index'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'vite'
import { expect, it } from 'vitest'
import { createAnalyzeDashboardDevframe, createDashboardArtifactSnapshot } from '../../../packages/weapp-vite/src/dashboard/index'
import { createAnalyzeDashboardPlugin } from '../../../packages/weapp-vite/src/dashboard/vite'

function createSnapshot(version: number): DashboardAnalyzeSnapshot {
  const artifacts = createDashboardArtifactSnapshot()
  artifacts.capture('app.js', `export const version = ${version}\n`)
  return {
    current: {
      packages: [{ id: 'main', label: `build-${version}`, type: 'main', files: [{ file: 'app.js', type: 'chunk', from: 'main' }] }],
      modules: [],
      subPackages: [],
      glassEasel: {
        detected: false,
        minimumBaseLibrary: '3.8.12',
        migrationGuide: '',
        diagnostics: [],
        summary: { errors: 0, warnings: 0 },
      },
    },
    previous: null,
    artifacts: artifacts.files,
  }
}

it('keeps reports live across Vite restart and rejected replacement assets until final close', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-vite-restart-'))
  const clientAssets = path.join(root, 'client')
  const controller = createAnalyzeDashboardDevframe({
    snapshot: createSnapshot(0),
    roots: { projectRoot: root },
    clientAssets,
  })
  const contexts: Parameters<typeof controller.definition.setup>[0][] = []
  const candidates: ViteDevServer[] = []
  const setup = controller.definition.setup
  controller.definition.setup = async (...args) => {
    await setup(...args)
    contexts.push(args[0])
  }
  try {
    await fs.mkdir(clientAssets)
    await fs.writeFile(path.join(clientAssets, 'index.html'), '<html><body>Dashboard client</body></html>')
    await fs.writeFile(path.join(root, 'index.html'), '<html><body>Vite host</body></html>')
    const configFile = path.join(root, 'vite.config.mjs')
    const devtoolsUrl = pathToFileURL(createRequire(import.meta.url).resolve('@vitejs/devtools')).href
    // SDK 0.7.6 的同一插件实例复用会关闭新 transport；配置重载独立创建 SDK，隔离 Dashboard 生命周期回归。
    await fs.writeFile(configFile, `
      import { DevTools } from ${JSON.stringify(devtoolsUrl)}
      export default { plugins: [DevTools({ builtinDevTools: false, clientAuth: true, allowedOrigins: [], mcp: false, banner: () => {} })] }
    `)
    const server = await createServer({
      root,
      configFile,
      configLoader: 'native',
      cacheDir: path.join(root, 'cache'),
      logLevel: 'silent',
      server: { host: '127.0.0.1', port: 0, watch: null },
      plugins: [
        {
          name: 'capture-restart-candidate',
          enforce: 'pre',
          configureServer(candidate) {
            candidates.push(candidate)
          },
        },
        createAnalyzeDashboardPlugin(controller),
      ],
    })
    await server.listen()
    const initialContext = contexts.at(-1)!
    const initialState = await initialContext.rpc.invokeLocal('weapp-vite:get-dashboard-state')
    await server.restart()
    const restartedContext = contexts.at(-1)!
    expect(restartedContext).not.toBe(initialContext)
    expect(await restartedContext.rpc.invokeLocal('weapp-vite:get-dashboard-state')).toEqual(initialState)

    const next = createSnapshot(1)
    await controller.update(next.current, next.artifacts)
    const nextState = await restartedContext.rpc.invokeLocal('weapp-vite:get-dashboard-state')
    expect(nextState.revision).toBe(initialState.revision + 1)
    expect(nextState.analyze.previous).toEqual(initialState.analyze.current)
    const nextPage = await restartedContext.rpc.invokeLocal('weapp-vite:get-analyze-page', { target: 'current', index: 0, revision: nextState.revision })
    expect(JSON.parse(nextPage.content)).toEqual(next.current)
    await expect(restartedContext.rpc.invokeLocal('weapp-vite:read-dashboard-file', { kind: 'artifact', path: 'app.js', revision: nextState.revision }))
      .resolves
      .toMatchObject({ content: next.artifacts.get('app.js')!.content })

    const activeConfig = server.config
    controller.definition.clientAssets = path.join(root, 'missing-client')
    await server.restart()
    // Vite 会记录替换失败并保留旧服务，不会把异常从 restart() 抛出。
    expect(server.config).toBe(activeConfig)
    await candidates.at(-1)!.close()
    expect(await restartedContext.rpc.invokeLocal('weapp-vite:get-dashboard-state')).toEqual(nextState)
    const preservedPage = await restartedContext.rpc.invokeLocal('weapp-vite:get-analyze-page', { target: 'current', index: 0, revision: nextState.revision })
    expect(JSON.parse(preservedPage.content)).toEqual(next.current)
    const latest = createSnapshot(2)
    await controller.update(latest.current, latest.artifacts)
    const latestState = await restartedContext.rpc.invokeLocal('weapp-vite:get-dashboard-state')
    expect(latestState.revision).toBe(nextState.revision + 1)
    await expect(restartedContext.rpc.invokeLocal('weapp-vite:read-dashboard-file', { kind: 'artifact', path: 'app.js', revision: latestState.revision }))
      .resolves
      .toMatchObject({ content: latest.artifacts.get('app.js')!.content })

    controller.definition.clientAssets = clientAssets
    await server.restart()
    const recoveredContext = contexts.at(-1)!
    expect(recoveredContext).not.toBe(restartedContext)
    expect(await recoveredContext.rpc.invokeLocal('weapp-vite:get-dashboard-state')).toEqual(latestState)
    const recovered = createSnapshot(3)
    await controller.update(recovered.current, recovered.artifacts)
    const recoveredState = await recoveredContext.rpc.invokeLocal('weapp-vite:get-dashboard-state')
    expect(recoveredState.revision).toBe(latestState.revision + 1)
    const recoveredPage = await recoveredContext.rpc.invokeLocal('weapp-vite:get-analyze-page', { target: 'current', index: 0, revision: recoveredState.revision })
    expect(JSON.parse(recoveredPage.content)).toEqual(recovered.current)
    await expect(recoveredContext.rpc.invokeLocal('weapp-vite:read-dashboard-file', { kind: 'artifact', path: 'app.js', revision: recoveredState.revision }))
      .resolves
      .toMatchObject({ content: recovered.artifacts.get('app.js')!.content })

    await server.close()
    await expect(recoveredContext.rpc.invokeLocal('weapp-vite:get-dashboard-state')).rejects.toThrow()
    await expect(recoveredContext.rpc.invokeLocal('weapp-vite:read-dashboard-file', { kind: 'artifact', path: 'app.js', revision: recoveredState.revision }))
      .rejects
      .toThrow()
  }
  finally {
    // Vite 未返回的失败候选也已创建 watcher，需要和活动服务一起释放。
    try {
      await Promise.all(candidates.map(candidate => candidate.close()))
    }
    finally {
      controller.dispose()
      await fs.rm(root, { recursive: true, force: true })
    }
  }
}, 30_000)
