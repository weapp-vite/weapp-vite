import { isObject } from '@weapp-core/shared'

interface ExtendedLibDescriptor {
  componentPrefixes: string[]
}

const EXTENDED_LIB_DESCRIPTORS: Record<string, ExtendedLibDescriptor> = {
  weui: {
    componentPrefixes: ['weui-miniprogram/'],
  },
}

export interface ExtendedLibManager {
  syncFromAppJson: (json: any) => void
  shouldIgnoreEntry: (entry: string) => boolean
}

function isBareSpecifier(value: string) {
  return Boolean(value) && !value.startsWith('.') && !value.startsWith('/')
}

export function createExtendedLibManager(): ExtendedLibManager {
  let enabledLibs = new Set<string>()

  return {
    syncFromAppJson(json: any) {
      const nextEnabled = new Set<string>()
      const extendedLib = json?.useExtendedLib
      if (isObject(extendedLib)) {
        for (const [libName, enabled] of Object.entries(extendedLib)) {
          if (!enabled) {
            continue
          }
          if (EXTENDED_LIB_DESCRIPTORS[libName]) {
            nextEnabled.add(libName)
          }
        }
      }
      enabledLibs = nextEnabled
    },

    shouldIgnoreEntry(entry: string) {
      if (!isBareSpecifier(entry) || entry.includes(':') || enabledLibs.size === 0) {
        return false
      }

      for (const libName of enabledLibs) {
        const descriptor = EXTENDED_LIB_DESCRIPTORS[libName]
        if (!descriptor) {
          continue
        }
        if (descriptor.componentPrefixes.some(prefix => entry === prefix || entry.startsWith(prefix))) {
          return true
        }
      }

      return false
    },
  }
}
