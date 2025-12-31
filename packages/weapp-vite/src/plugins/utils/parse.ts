import { changeFileExtension } from '../../utils'

export interface ParseRequestResponse {
  filename: string
  query: { wxss?: boolean }
}

/**
 * 参考：https://github.com/tailwindlabs/tailwindcss/blob/main/packages/%40tailwindcss-vite/src/index.ts
 * 解析请求ID，返回包含文件名和查询参数的对象。
 * 如果查询参数中包含'wxss'，则将其值设置为true。
 * @param id - 请求ID，格式为'filename?query'
 * @returns 解析后的请求响应对象
 */
export function parseRequest(id: string): ParseRequestResponse {
  const [filename, rawQuery] = id.split(`?`, 2)
  const query = Object.fromEntries(new URLSearchParams(rawQuery)) as { wxss?: true }
  if (Reflect.has(query, 'wxss')) {
    query.wxss = true
  }
  return {
    filename,
    query,
  }
}

/**
 * 根据请求响应获取 CSS 文件的真实路径。
 * 如果请求中包含 wxss 查询参数，则将文件扩展名更改为 'wxss'。
 * @param res - 解析请求的响应对象，包含文件名和查询参数。
 * @returns 返回文件的真实路径。
 */
export function getCssRealPath(res: ParseRequestResponse) {
  if (res.query.wxss) {
    return changeFileExtension(res.filename, 'wxss')
  }
  return res.filename
}
