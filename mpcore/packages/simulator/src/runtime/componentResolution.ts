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
  if (request.startsWith('/') || request.startsWith('.') || hasFile(join(miniprogramRootPath, `${localPath}.js`))) {
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
