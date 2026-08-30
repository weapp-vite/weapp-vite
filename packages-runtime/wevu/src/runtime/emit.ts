import type { TriggerEventOptions } from './types'
import { hasOwn, hyphenate } from '../utils'

function isTriggerEventOptions(value: unknown): value is TriggerEventOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  return (
    hasOwn(value, 'bubbles')
    || hasOwn(value, 'composed')
    || hasOwn(value, 'capturePhase')
  )
}

export function normalizeEmitEventName(eventName: string) {
  return eventName.includes(':') ? eventName.replaceAll(':', '-').toLowerCase() : hyphenate(eventName)
}

export function normalizeEmitPayload(args: any[]): { detail: any, options: TriggerEventOptions | undefined } {
  if (args.length === 0) {
    return {
      detail: undefined,
      options: undefined,
    }
  }

  if (args.length === 1) {
    return {
      detail: args[0],
      options: undefined,
    }
  }

  const maybeOptions = args[args.length - 1]
  if (isTriggerEventOptions(maybeOptions)) {
    const detailArgs = args.slice(0, -1)
    return {
      detail: detailArgs.length <= 1 ? detailArgs[0] : detailArgs,
      options: maybeOptions,
    }
  }

  return {
    detail: args,
    options: undefined,
  }
}
