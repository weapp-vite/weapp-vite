import type { Plugin, ViteDevServer } from 'vite'
import type { MutableCompilerContext } from '../context'
import { build, createServer } from 'vite'

export interface WebService {
  readonly devServer?: ViteDevServer
  isEnabled: () => boolean
  startDevServer: () => Promise<ViteDevServer | undefined>
  build: () => Promise<Awaited<ReturnType<typeof build>> | undefined>
  close: () => Promise<void>
}

function createWebService(ctx: MutableCompilerContext): WebService {
  if (!ctx.configService) {
    throw new Error('web service requires configService to be initialized')
  }
  let devServer: ViteDevServer | undefined

  function isEnabled() {
    return Boolean(ctx.configService?.weappWebConfig?.enabled)
  }

  async function startDevServer() {
    if (!ctx.configService?.isDev) {
      return undefined
    }
    if (!isEnabled()) {
      return undefined
    }
    if (devServer) {
      return devServer
    }
    const inlineConfig = ctx.configService?.mergeWeb()
    if (!inlineConfig) {
      return undefined
    }
    const server = await createServer(inlineConfig)
    await server.listen()
    devServer = server
    return devServer
  }

  async function buildWeb() {
    if (!isEnabled()) {
      return undefined
    }
    const inlineConfig = ctx.configService?.mergeWeb()
    if (!inlineConfig) {
      return undefined
    }
    return await build(inlineConfig)
  }

  async function close() {
    if (!devServer) {
      return
    }
    const server = devServer
    devServer = undefined
    await server.close()
  }

  return {
    get devServer() {
      return devServer
    },
    isEnabled,
    startDevServer,
    build: buildWeb,
    close,
  }
}

export function createWebServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createWebService(ctx)
  ctx.webService = service

  return {
    name: 'weapp-runtime:web-service',
    async closeBundle() {
      if (!ctx.configService?.isDev) {
        await service.close()
      }
    },
  }
}
