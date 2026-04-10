import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'
import { createWxmlService } from './wxmlPlugin/service'

export type { WxmlService } from './wxmlPlugin/types'

export function createWxmlServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createWxmlService(ctx)
  ctx.wxmlService = service

  return {
    name: 'weapp-runtime:wxml-service',
    buildStart() {
      service.clearAll({
        clearEmittedCode: !ctx.configService?.isDev,
      })
    },
  }
}
