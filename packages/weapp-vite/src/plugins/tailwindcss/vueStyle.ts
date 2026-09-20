import type { PluginContext } from 'rolldown'
import type { WeappVueStyleRequest } from '../vue/transform/styleRequest'
import fs from 'node:fs/promises'
import path from 'pathe'
import { parse } from 'vue/compiler-sfc'

/** 根据 SFC 外部样式的文件身份解析入口，避免依赖编译前后 CSS 文本一致。 */
export async function resolveVueStyleSource(
  request: WeappVueStyleRequest,
  resolve: PluginContext['resolve'],
): Promise<string | undefined> {
  let source: string
  try {
    source = await fs.readFile(request.filename, 'utf8')
  }
  catch {
    // 文件删除与无效 SFC 的诊断仍由 Vue loader 负责。
    return
  }
  const block = parse(source, { filename: request.filename }).descriptor.styles[request.index]
  if (!block?.src) {
    return
  }
  const resolved = await resolve(block.src, request.filename, { skipSelf: true })
  if (resolved) {
    return resolved.external ? undefined : resolved.id
  }
  if (block.src.startsWith('.') || path.isAbsolute(block.src)) {
    return path.resolve(path.dirname(request.filename), block.src)
  }
}
