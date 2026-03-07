import { isPlainObject } from '../../utils.ts'
import { mapChooseImageResult } from './helpersUi'

export function mapSetClipboardArgs(args: unknown[]) {
  if (args.length === 0) {
    return args
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return nextArgs
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'text') && Object.prototype.hasOwnProperty.call(nextOptions, 'data')) {
    nextOptions.text = nextOptions.data
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

export function mapClipboardResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (!Object.prototype.hasOwnProperty.call(result, 'data') && Object.prototype.hasOwnProperty.call(result, 'text')) {
    return {
      ...result,
      data: result.text,
    }
  }
  return result
}

function resolveFilePaths(result: any): string[] {
  if (!isPlainObject(result)) {
    return []
  }
  if (typeof result.tempFilePaths === 'string' && result.tempFilePaths) {
    return [result.tempFilePaths]
  }
  if (Array.isArray(result.tempFilePaths)) {
    return result.tempFilePaths.filter((item: unknown): item is string => typeof item === 'string' && item.length > 0)
  }
  if (Array.isArray(result.apFilePaths)) {
    return result.apFilePaths.filter((item: unknown): item is string => typeof item === 'string' && item.length > 0)
  }
  if (Array.isArray(result.tempFiles)) {
    return result.tempFiles
      .map((item: unknown) => {
        if (!isPlainObject(item)) {
          return undefined
        }
        if (typeof item.tempFilePath === 'string' && item.tempFilePath) {
          return item.tempFilePath
        }
        if (typeof item.path === 'string' && item.path) {
          return item.path
        }
        if (typeof item.filePath === 'string' && item.filePath) {
          return item.filePath
        }
        return undefined
      })
      .filter((item): item is string => typeof item === 'string')
  }
  return []
}

export function mapChooseMediaResultFromImage(result: any) {
  const normalized = mapChooseImageResult(result)
  if (!isPlainObject(normalized)) {
    return normalized
  }
  if (Array.isArray(normalized.tempFiles) && normalized.tempFiles.length > 0) {
    return normalized
  }
  const tempFilePaths = resolveFilePaths(normalized)
  if (tempFilePaths.length === 0) {
    return normalized
  }
  return {
    ...normalized,
    tempFilePaths,
    tempFiles: tempFilePaths.map(tempFilePath => ({
      tempFilePath,
      fileType: 'image',
    })),
    type: 'image',
  }
}
