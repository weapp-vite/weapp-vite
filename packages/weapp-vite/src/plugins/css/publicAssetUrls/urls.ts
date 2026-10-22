import { stat } from 'node:fs/promises'
import path from 'pathe'

const CSS_ESCAPE_RE = /\\(?:([a-f\d]{1,6})(?:\r\n|[ \t\n\r\f])?|\r\n|[\n\r\f]|(.))/gi

function unescapeCss(value: string) {
  return value.replace(CSS_ESCAPE_RE, (_escape, hex: string | undefined, character: string | undefined) => {
    if (hex) {
      const code = Number.parseInt(hex, 16)
      return String.fromCodePoint(code === 0 || code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF) ? 0xFFFD : code)
    }
    return character ?? ''
  })
}

/** 仅验证已由编译占位符证明的 public URL，不重编码 URL 或推导 Vite 的内部标识。 */
export async function validatePublicAssetUrl(value: string, publicDir: string | false) {
  if (!publicDir) {
    throw new Error('publicDir 不可用')
  }
  // decodeURI 与 Vite 的 URL 解析一致，保留 %2F、%3F、%23 等路径内保留字符。
  const decoded = decodeURI(unescapeCss(value))
  if (!decoded.startsWith('/') || decoded.startsWith('//')) {
    throw new Error('对应 URL 不是 public 根路径')
  }
  const pathname = decoded.split(/[?#]/, 1)[0]!
  const root = path.resolve(publicDir)
  const file = path.resolve(root, `.${pathname}`)
  const relative = path.relative(root, file)
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error('对应 URL 超出 publicDir')
  }
  if (!(await stat(file)).isFile()) {
    throw new Error('对应 public URL 不是文件')
  }
  return decoded
}
