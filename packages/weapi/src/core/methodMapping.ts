import { isPlainObject } from './utils'

export interface WeapiMethodMappingRule {
  target: string
  mapArgs?: (args: unknown[]) => unknown[]
  mapResult?: (result: any) => any
}

const PLATFORM_ALIASES: Readonly<Record<string, string>> = {
  alipay: 'my',
}

const METHOD_MAPPINGS: Readonly<Record<string, Readonly<Record<string, WeapiMethodMappingRule>>>> = {
  my: {
    setClipboardData: {
      target: 'setClipboard',
      mapArgs: mapSetClipboardArgs,
    },
    getClipboardData: {
      target: 'getClipboard',
      mapResult: mapClipboardResult,
    },
  },
}

function normalizePlatformName(value?: string) {
  if (!value) {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }
  return PLATFORM_ALIASES[normalized] ?? normalized
}

function mapSetClipboardArgs(args: unknown[]) {
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

function mapClipboardResult(result: any) {
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

/**
 * @description 解析平台 API 映射规则
 */
export function resolveMethodMapping(platform: string | undefined, methodName: string) {
  const normalizedPlatform = normalizePlatformName(platform)
  if (!normalizedPlatform) {
    return undefined
  }
  const platformMappings = METHOD_MAPPINGS[normalizedPlatform]
  if (!platformMappings) {
    return undefined
  }
  return platformMappings[methodName]
}
