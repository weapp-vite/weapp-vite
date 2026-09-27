import type { DevToolsConfig } from '@vitejs/devtools/config'
import type { DevframeDefinition } from 'devframe/types'
import type { ViteDevServer } from 'vite'
import type { AnalyzeDashboardDevframeController, DashboardAnalyzeSnapshot, DashboardContentRoots } from 'weapp-vite/dashboard'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { DevTools } from '@vitejs/devtools'
import { createPluginFromDevframe } from '@vitejs/devtools-kit/node'
import { buildOtpAuthUrl, getTempAuthCodeInfo } from 'devframe/node/auth'
import { withLeadingSlash, withTrailingSlash } from 'devframe/utils/url'
import { createServer } from 'vite'
import { createAnalyzeDashboardDevframe, resolveDashboardClientAssets } from 'weapp-vite/dashboard'
import { createAnalyzeDashboardPlugin } from 'weapp-vite/dashboard/vite'

interface InspectorViteHostOptions {
  cwd: string
  snapshot: DashboardAnalyzeSnapshot
  roots: DashboardContentRoots
  panelBase?: string
  appBase?: string
}

/** 在独立临时 HTML 应用中挂载原生 Dashboard；报告控制仍由 Inspector 命令循环持有。 */
export async function startInspectorViteHost(options: InspectorViteHostOptions) {
  if (process.env.VITE_DEVTOOLS_DISABLE_CLIENT_AUTH === 'true') {
    throw new Error('Inspector Vite DevTools host 必须启用客户端认证；请移除 VITE_DEVTOOLS_DISABLE_CLIENT_AUTH=true。')
  }
  const clientAssets = resolveDashboardClientAssets(options.cwd)
  if (!clientAssets) {
    throw new Error('Inspector Vite DevTools host 需要已构建的 @weapp-vite/dashboard 原生资源；请先构建 Dashboard。')
  }

  const appRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'wv-inspector-host-'))
  let controller: AnalyzeDashboardDevframeController | undefined
  let server: ViteDevServer | undefined
  let closePromise: Promise<void> | undefined
  let removeForeignState: (() => void) | undefined
  let resolveExit!: () => void
  const exited = new Promise<void>((resolve) => {
    resolveExit = resolve
  })

  function dispose() {
    controller?.dispose()
    removeForeignState?.()
    removeForeignState = undefined
  }

  function close() {
    closePromise ??= (async () => {
      dispose()
      try {
        await server?.close()
      }
      finally {
        try {
          await fs.rm(appRoot, { recursive: true, force: true })
        }
        finally {
          resolveExit()
        }
      }
    })()
    return closePromise
  }

  try {
    // 这是本会话拥有的 Vite 输入，不是小程序或 Dashboard 的构建产物。
    await fs.writeFile(path.join(appRoot, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="UTF-8"><title>Dashboard Inspector · Vite DevTools host</title></head>
  <body><h1>Dashboard Inspector · Vite DevTools host</h1><p>请在 DevTools 中打开 Dashboard；报告场景只通过终端 Inspector 命令切换。</p></body>
</html>
`, 'utf8')
    controller = createAnalyzeDashboardDevframe({
      snapshot: options.snapshot,
      roots: options.roots,
      clientAssets,
      initialEvents: [{
        kind: 'system',
        level: 'info',
        title: 'Inspector Vite DevTools 会话已启动',
        detail: '合成报告与临时源码使用同一 Dashboard 核心；宿主持有认证和共享传输。',
        source: 'dashboard-ui-lab',
      }],
    })

    const appBase = withTrailingSlash(withLeadingSlash(options.appBase ?? '/'))
    const panelBase = withTrailingSlash(withLeadingSlash(options.panelBase ?? controller.definition.basePath ?? `/__${controller.definition.id}/`))
    const urls: string[] = []
    let origin: string | undefined
    function printAuthLinks(code: string) {
      if (!origin) {
        return
      }
      urls[0] = buildOtpAuthUrl(new URL(panelBase, origin).href, code)
      console.log(`Vite DevTools URL (OTP): ${buildOtpAuthUrl(new URL('/__devtools/', origin).href, code)}`)
      console.log(`Dashboard URL (OTP): ${urls[0]}`)
    }

    // 具名 DevToolsConfig 保留认证策略，同时避开上游较窄 DevToolsOptions 的字面量检查。
    const hostOptions: DevToolsConfig = {
      builtinDevTools: false,
      clientAuth: true,
      allowedOrigins: [],
      mcp: false,
      banner: ({ code }) => printAuthLinks(code),
    }
    const foreignScope = 'dashboard-ui-lab-foreign-state'
    const foreignStateKey = `${foreignScope}:probe`
    const foreignStateProbe: DevframeDefinition = {
      id: foreignScope,
      name: 'Inspector foreign-scope sharedState probe',
      icon: 'ph:flask-duotone',
      version: '0.0.0',
      packageName: 'dashboard-ui-lab',
      importMetaUrl: import.meta.url,
      homepage: 'https://github.com/weapp-vite/weapp-vite',
      description: 'QA-only sibling state, independent of Dashboard reports and artifacts.',
      capabilities: { dev: true, build: false },
      async setup(ctx) {
        await ctx.scope(foreignScope).rpc.sharedState('probe', {
          initialValue: { value: 'initial', writes: 0 },
        })
        removeForeignState = () => {
          ctx.rpc.sharedState.delete(foreignStateKey)
        }
      },
    }

    server = await createServer({
      configFile: false,
      envDir: false,
      root: appRoot,
      cacheDir: path.join(appRoot, '.vite'),
      base: appBase,
      server: { host: '127.0.0.1', port: 0, open: false },
      plugins: [
        {
          name: 'dashboard-ui-lab:inspector-host-lifetime',
          enforce: 'pre',
          configureServer(viteServer) {
            // 尽早接管实例，后续插件 setup 失败时也能关闭已创建的 Vite 资源。
            server = viteServer
          },
          closeBundle() {
            dispose()
            resolveExit()
          },
        },
        DevTools(hostOptions),
        createAnalyzeDashboardPlugin(controller, options.panelBase === undefined ? undefined : { base: panelBase }),
        createPluginFromDevframe(foreignStateProbe),
      ],
    })
    await server.listen()
    const address = server.httpServer?.address()
    if (!address || typeof address === 'string') {
      throw new Error('Inspector Vite DevTools host 未获得共享 HTTP 监听地址。')
    }
    origin = `http://127.0.0.1:${address.port}`
    console.log(`Vite input app URL: ${new URL(appBase, origin).href}`)
    printAuthLinks(getTempAuthCodeInfo().code)
    console.log(`[fixture] foreign sharedState probe: ${foreignStateKey}; initial={"value":"initial","writes":0}`)
    console.log('[fixture] QA 请通过已认证 Devframe 客户端读写该探针，验证宿主内置 sharedState 未被 Dashboard 覆盖。')

    return {
      update: controller.update,
      close,
      waitForExit: () => exited,
      urls,
    }
  }
  catch (error) {
    try {
      await close()
    }
    catch (cleanupError) {
      console.error('[fixture] Vite DevTools host 启动失败后的清理失败：', cleanupError)
    }
    throw error
  }
}
