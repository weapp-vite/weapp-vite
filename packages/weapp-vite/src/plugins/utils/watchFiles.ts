import { normalizeWatchPath } from '../../utils/path'

export function addNormalizedWatchFile(
  pluginCtx: {
    addWatchFile?: (id: string) => void
  },
  file: string | undefined,
) {
  if (!file || typeof pluginCtx.addWatchFile !== 'function') {
    return false
  }

  pluginCtx.addWatchFile(normalizeWatchPath(file))
  return true
}

export function addNormalizedWatchFiles(
  pluginCtx: {
    addWatchFile?: (id: string) => void
  },
  files: Iterable<string | undefined>,
) {
  let count = 0
  for (const file of files) {
    if (addNormalizedWatchFile(pluginCtx, file)) {
      count += 1
    }
  }
  return count
}
