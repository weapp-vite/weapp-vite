import { createNotSupportedError, isPlainObject } from '../../utils'

function mapToastType(type: unknown) {
  if (type === 'error') {
    return 'fail'
  }
  if (type === 'loading') {
    return 'none'
  }
  return type
}

export function mapToastArgs(args: unknown[]) {
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
  if (!Object.hasOwn(nextOptions, 'content') && Object.hasOwn(nextOptions, 'title')) {
    nextOptions.content = nextOptions.title
  }
  if (Object.hasOwn(nextOptions, 'icon')) {
    nextOptions.type = mapToastType(nextOptions.icon)
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

export function mapDouyinToastArgs(args: unknown[]) {
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
  if (nextOptions.icon === 'error') {
    nextOptions.icon = 'fail'
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

export function mapLoadingArgs(args: unknown[]) {
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
  if (!Object.hasOwn(nextOptions, 'content') && Object.hasOwn(nextOptions, 'title')) {
    nextOptions.content = nextOptions.title
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

export function mapActionSheetArgs(args: unknown[]) {
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
  if (!Object.hasOwn(nextOptions, 'items') && Array.isArray(nextOptions.itemList)) {
    nextOptions.items = nextOptions.itemList
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

export function mapActionSheetResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (!Object.hasOwn(result, 'tapIndex') && Object.hasOwn(result, 'index')) {
    return {
      ...result,
      tapIndex: result.index,
    }
  }
  return result
}

export function mapModalArgs(args: unknown[]) {
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
  if (Object.hasOwn(nextOptions, 'showCancel') && nextOptions.showCancel === false) {
    throw createNotSupportedError('showModal', 'my')
  }
  if (Object.hasOwn(nextOptions, 'editable') && nextOptions.editable === true) {
    throw createNotSupportedError('showModal', 'my')
  }
  if (Object.hasOwn(nextOptions, 'placeholderText')) {
    throw createNotSupportedError('showModal', 'my')
  }
  if (!Object.hasOwn(nextOptions, 'confirmButtonText') && Object.hasOwn(nextOptions, 'confirmText')) {
    nextOptions.confirmButtonText = nextOptions.confirmText
  }
  if (!Object.hasOwn(nextOptions, 'cancelButtonText') && Object.hasOwn(nextOptions, 'cancelText')) {
    nextOptions.cancelButtonText = nextOptions.cancelText
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

export function mapModalResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  let changed = false
  const nextResult = {
    ...result,
  } as Record<string, any>
  if (!Object.hasOwn(nextResult, 'cancel') && Object.hasOwn(nextResult, 'confirm')) {
    nextResult.cancel = !nextResult.confirm
    changed = true
  }
  if (!Object.hasOwn(nextResult, 'content')) {
    nextResult.content = ''
    changed = true
  }
  return changed ? nextResult : result
}

export function mapChooseImageResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (!Object.hasOwn(result, 'tempFilePaths') && Array.isArray(result.apFilePaths)) {
    return {
      ...result,
      tempFilePaths: result.apFilePaths,
    }
  }
  return result
}

export function mapDouyinChooseImageResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (typeof result.tempFilePaths === 'string') {
    return {
      ...result,
      tempFilePaths: [result.tempFilePaths],
    }
  }
  if (!Array.isArray(result.tempFilePaths) && Array.isArray(result.tempFiles)) {
    const fallbackPaths = result.tempFiles
      .map((item: unknown) => {
        if (!isPlainObject(item)) {
          return undefined
        }
        const path = item.path
        if (typeof path === 'string' && path) {
          return path
        }
        const filePath = item.filePath
        if (typeof filePath === 'string' && filePath) {
          return filePath
        }
        return undefined
      })
      .filter((item): item is string => typeof item === 'string')
    if (fallbackPaths.length > 0) {
      return {
        ...result,
        tempFilePaths: fallbackPaths,
      }
    }
  }
  return result
}
