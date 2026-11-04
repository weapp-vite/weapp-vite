import type { MpPlatform } from '@weapp-core/shared'
import path from 'node:path'
import { getMiniProgramPlatformDescriptor } from '@weapp-core/shared'

/** 发布检查只解析快照中的文件，目录和优先级均服从目标平台的 npm 规则。 */
export function createClassicPublicationResolver(platform: MpPlatform, hasFile: (file: string) => boolean) {
  const descriptor = getMiniProgramPlatformDescriptor(platform)
  const npmDirectories = [...new Set([
    descriptor.npm?.distDirName?.(),
    descriptor.npm?.distDirName?.({ alipayNpmMode: 'miniprogram_npm' }),
  ].filter((directory): directory is string => directory !== undefined))]

  const resolveLocal = (owner: string, request: string) => {
    if (request.includes('\\') || request.includes(':')) {
      throw new Error(`Classic publication has an unsupported dependency path: ${request}`)
    }
    const resolved = path.posix.normalize(request.startsWith('/') ? request.replace(/^\/+/, '') : path.posix.join(path.posix.dirname(owner), request))
    if (resolved === '..' || resolved.startsWith('../') || path.posix.isAbsolute(resolved)) {
      throw new Error(`Classic publication dependency escapes its output: ${owner}`)
    }
    return resolved
  }
  const resolveFile = (base: string, contains: (file: string) => boolean) => {
    return [base, `${base}.js`, `${base}.json`, path.posix.join(base, 'index.js')].find(contains)
  }
  const resolveModule = (owner: string, request: string, contains = hasFile): string | undefined => {
    if (request.startsWith('.') || request.startsWith('/')) {
      return resolveFile(resolveLocal(owner, request), contains)
    }
    if (request.includes('\\') || request.includes(':') || request.split('/').some(part => !part || part === '.' || part === '..')) {
      return undefined
    }
    let directory = path.posix.dirname(owner)
    while (true) {
      for (const npmDirectory of npmDirectories) {
        const resolved = resolveFile(path.posix.join(directory, npmDirectory, request), contains)
        if (resolved) {
          return resolved
        }
      }
      if (directory === '.') {
        return undefined
      }
      directory = path.posix.dirname(directory)
    }
  }
  const resolveComponent = (owner: string, request: string) => {
    const local = resolveLocal(owner, request)
    if (hasFile(`${local}.js`)) {
      return local
    }
    if (request.startsWith('.') || request.startsWith('/')) {
      const index = path.posix.join(local, 'index')
      return platform === 'alipay' && hasFile(`${index}.js`) ? index : local
    }
    const resolved = resolveModule(owner, request, file => file.endsWith('.js') && hasFile(file))
    return resolved ? resolved.slice(0, -3) : local
  }
  return { resolveLocal, resolveModule, resolveComponent }
}
