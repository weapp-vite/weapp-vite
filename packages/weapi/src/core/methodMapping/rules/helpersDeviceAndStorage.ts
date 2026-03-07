import { createNotSupportedError, isPlainObject } from '../../utils'

const PLATFORM_ALIASES: Readonly<Record<string, string>> = {
  alipay: 'my',
  douyin: 'tt',
}

export function mapSaveFileArgs(args: unknown[]) {
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
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'apFilePath') && Object.prototype.hasOwnProperty.call(nextOptions, 'tempFilePath')) {
    nextOptions.apFilePath = nextOptions.tempFilePath
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

export function mapCreateRewardedVideoAdArgs(args: unknown[]) {
  if (args.length === 0) {
    return args
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return nextArgs
  }
  if (Object.prototype.hasOwnProperty.call(lastArg, 'multiton') && lastArg.multiton === true) {
    throw createNotSupportedError('createRewardedVideoAd', 'my')
  }
  if (Object.prototype.hasOwnProperty.call(lastArg, 'disableFallbackSharePage') && lastArg.disableFallbackSharePage === true) {
    throw createNotSupportedError('createRewardedVideoAd', 'my')
  }
  const adUnitId = lastArg.adUnitId
  if (typeof adUnitId === 'string' && adUnitId.length > 0) {
    nextArgs[lastIndex] = adUnitId
  }
  return nextArgs
}

export function mapRewardedAdInstance(result: any, args: unknown[] = []) {
  if (typeof result !== 'object' || result === null) {
    return result
  }
  const adUnitIdArg = args.length > 0 ? args[args.length - 1] : undefined
  const adUnitId = typeof adUnitIdArg === 'string' ? adUnitIdArg : undefined
  if (!adUnitId) {
    return result
  }
  const rewardedAd = result as Record<string, any>
  const wrapMethod = (name: 'destroy' | 'load' | 'show') => {
    const method = rewardedAd[name]
    if (typeof method !== 'function') {
      return method
    }
    return (options?: unknown) => {
      if (isPlainObject(options)) {
        return method.call(rewardedAd, {
          ...options,
          adUnitId,
        })
      }
      if (options === undefined) {
        return method.call(rewardedAd, {
          adUnitId,
        })
      }
      return method.call(rewardedAd, options)
    }
  }
  const nextRewardedAd = Object.create(rewardedAd) as Record<string, any>
  nextRewardedAd.destroy = wrapMethod('destroy')
  nextRewardedAd.load = wrapMethod('load')
  nextRewardedAd.show = wrapMethod('show')
  return nextRewardedAd
}

export function mapCheckIsSoterEnrolledInDeviceArgs(args: unknown[]) {
  if (args.length === 0) {
    return args
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return nextArgs
  }
  if (lastArg.checkAuthMode === 'speech') {
    throw createNotSupportedError('checkIsSoterEnrolledInDevice', 'my')
  }
  return nextArgs
}

export function mapSoterCheckResult(methodName: string, result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (Object.prototype.hasOwnProperty.call(result, 'errMsg')) {
    return result
  }
  return {
    ...result,
    errMsg: `${methodName}:ok`,
  }
}

function toNumberCode(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

function mapBleConnectionResult(methodName: 'createBLEConnection' | 'closeBLEConnection', codeKey: 'error' | 'errorCode', result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  const nextResult = {
    ...result,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextResult, 'errCode')) {
    const code = toNumberCode(nextResult[codeKey])
    if (typeof code === 'number') {
      nextResult.errCode = code
    }
  }
  if (!Object.prototype.hasOwnProperty.call(nextResult, 'errMsg')) {
    if (typeof nextResult.errorMessage === 'string' && nextResult.errorMessage.length > 0) {
      nextResult.errMsg = nextResult.errorMessage
    }
    else if (nextResult.errCode === 0) {
      nextResult.errMsg = `${methodName}:ok`
    }
  }
  return nextResult
}

export function mapCreateBleConnectionResult(result: any) {
  return mapBleConnectionResult('createBLEConnection', 'error', result)
}

export function mapCloseBleConnectionResult(result: any) {
  return mapBleConnectionResult('closeBLEConnection', 'errorCode', result)
}

export function mapSaveFileResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (!Object.prototype.hasOwnProperty.call(result, 'savedFilePath') && Object.prototype.hasOwnProperty.call(result, 'apFilePath')) {
    return {
      ...result,
      savedFilePath: result.apFilePath,
    }
  }
  return result
}

export function mapDouyinSaveFileResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (!Object.prototype.hasOwnProperty.call(result, 'savedFilePath') && Object.prototype.hasOwnProperty.call(result, 'filePath')) {
    return {
      ...result,
      savedFilePath: result.filePath,
    }
  }
  return result
}

export function normalizePlatformName(value?: string) {
  if (!value) {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }
  return PLATFORM_ALIASES[normalized] ?? normalized
}
