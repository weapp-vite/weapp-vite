import type { SFCBlock, SFCDescriptor } from 'vue/compiler-sfc'
import { createHash } from 'node:crypto'

/** 从本轮已解析的模板输入和最终结构生成注册签名，不混入脚本或样式位置。 */
export function createTemplateRegistrationSignature(
  descriptor: Pick<SFCDescriptor, 'template' | 'customBlocks'>,
  compiledTemplate: string | undefined,
): string {
  const serialize = (block: SFCBlock | null) => block && ({
    attrs: Object.fromEntries(Object.entries(block.attrs).sort(([a], [b]) => a.localeCompare(b))),
    content: block.content,
    type: block.type,
  })
  return createHash('sha256').update(JSON.stringify([
    serialize(descriptor.template),
    descriptor.customBlocks.filter(block => block.type !== 'json' && block.type !== 'config').map(serialize),
    compiledTemplate,
  ])).digest('hex')
}
