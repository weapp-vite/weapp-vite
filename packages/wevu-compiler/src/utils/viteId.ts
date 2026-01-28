import { fileURLToPath } from 'node:url'

export interface NormalizeViteIdOptions {
  /**
   * 是否去掉 `?query`。
   * @default true
   */
  stripQuery?: boolean
  /**
   * 是否将 `file://` URL 转为本地路径。
   * @default true
   */
  fileProtocolToPath?: boolean
  /**
   * 是否将 Vite 的 `/@fs/` 前缀转为真实文件路径。
   * @default true
   */
  stripAtFsPrefix?: boolean
  /**
   * 是否剥离 Vue 虚拟模块前缀（`\0vue:`）。
   * @default false
   */
  stripVueVirtualPrefix?: boolean
  /**
   * 是否剥离最前面的 `\0`（用于部分 bundle 里记录的 facadeModuleId/originalFileName）。
   * @default false
   */
  stripLeadingNullByte?: boolean
}

const VUE_VIRTUAL_MODULE_PREFIX = '\0vue:'
const BACKSLASH_RE = /\\/g

export function normalizeViteId(id: string, options?: NormalizeViteIdOptions) {
  const stripQuery = options?.stripQuery !== false
  const fileProtocolToPathEnabled = options?.fileProtocolToPath !== false
  const stripAtFsPrefix = options?.stripAtFsPrefix !== false
  const stripVueVirtualPrefix = options?.stripVueVirtualPrefix === true
  const stripLeadingNullByte = options?.stripLeadingNullByte === true

  let clean = id

  if (stripVueVirtualPrefix && clean.startsWith(VUE_VIRTUAL_MODULE_PREFIX)) {
    clean = clean.slice(VUE_VIRTUAL_MODULE_PREFIX.length)
  }

  if (clean.includes('\\')) {
    clean = clean.replace(BACKSLASH_RE, '/')
  }

  if (stripQuery) {
    clean = clean.split('?', 1)[0]
  }

  if (fileProtocolToPathEnabled && clean.startsWith('file://')) {
    try {
      clean = fileURLToPath(clean)
    }
    catch {
      // 忽略
    }
  }

  if (stripAtFsPrefix && clean.startsWith('/@fs/')) {
    clean = clean.slice('/@fs'.length)
  }

  if (stripLeadingNullByte && clean.startsWith('\0')) {
    clean = clean.slice(1)
  }

  return clean
}
