import { dirname, join, relative } from 'pathe'
import { resolveMiniProgramModule } from './moduleResolution'

export function resolveMiniProgramComponent(
  ownerFilePath: string,
  request: string,
  miniprogramRootPath: string,
  hasFile: (filePath: string) => boolean,
): string {
  const localPath = request.startsWith('/')
    ? request.replace(/^\/+/, '')
    : join(dirname(ownerFilePath), request)
  if (request.startsWith('/') || request.startsWith('.')) {
    const hasComponentArtifact = (basePath: string) => ['js', 'json', 'wxml', 'wxss']
      .some(extension => hasFile(join(miniprogramRootPath, `${basePath}.${extension}`)))
    // 显式入口的任一产物存在时保持该入口，让缺失文件仍由正常加载流程报错。
    if (hasComponentArtifact(localPath)) {
      return localPath
    }
    const directoryPath = join(localPath, 'index')
    return hasComponentArtifact(directoryPath) ? directoryPath : localPath
  }
  if (hasFile(join(miniprogramRootPath, `${localPath}.js`))) {
    return localPath
  }

  const npmPath = resolveMiniProgramModule(
    join(miniprogramRootPath, ownerFilePath),
    request,
    miniprogramRootPath,
    candidate => candidate.endsWith('.js') && hasFile(candidate),
  )
  return npmPath
    ? relative(miniprogramRootPath, npmPath).slice(0, -3)
    : localPath
}
