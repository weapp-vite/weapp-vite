import type { CompilerContext } from '../../context'

/** 仅真实的 Vue 入口持有最终 JSON；原生脚本的配对 SFC 仍是配置回退。 */
export function isVueEntryJsonPublisher(
  id: string,
  type: string,
  configService: CompilerContext['configService'],
) {
  if ((type !== 'page' && type !== 'component') || configService.weappViteConfig?.vue?.enable === false) {
    return false
  }
  return id.endsWith('.vue')
    || (!configService.weappViteConfig?.react && /\.(?:jsx|tsx)$/.test(id))
}
