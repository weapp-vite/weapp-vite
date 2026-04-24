import type { getPackageInfo, getPackageInfoSync, resolveModule } from 'local-pkg'
import process from 'node:process'
import {
  getPackageInfoSync as getPackageInfoSyncUnsafe,
  getPackageInfo as getPackageInfoUnsafe,
  resolveModule as resolveModuleUnsafe,
} from 'local-pkg'

type PackageInfoSync = ReturnType<typeof getPackageInfoSync>
type PackageInfoAsync = Awaited<ReturnType<typeof getPackageInfo>>
type ResolvedModulePath = ReturnType<typeof resolveModule>

function captureConsoleError<T>(runner: () => T) {
  // eslint-disable-next-line no-console -- 这里需要暂存并恢复原始 console.error
  const originalConsoleError = console.error
  const capturedErrors: unknown[][] = []

  // eslint-disable-next-line no-console -- 这里需要暂时拦截 local-pkg 内部的 console.error 噪音
  console.error = (...args: unknown[]) => {
    capturedErrors.push(args)
  }

  try {
    return {
      value: runner(),
      capturedErrors,
    }
  }
  finally {
    // eslint-disable-next-line no-console -- 恢复原始 console.error
    console.error = originalConsoleError
  }
}

function shouldLogSuppressedResolutionError() {
  return process.env.WEAPP_VITE_DEBUG_PACKAGE_RESOLVE === '1'
}

function formatCapturedErrorMessage(args: unknown[]) {
  return args
    .map((value) => {
      if (value instanceof Error) {
        return value.stack ?? value.message
      }
      if (typeof value === 'string') {
        return value
      }
      try {
        return JSON.stringify(value)
      }
      catch {
        return String(value)
      }
    })
    .join(' ')
}

/**
 * @description 安全执行 local-pkg 同步解析，避免其内部 console.error 污染 CLI 输出
 */
export function safeGetPackageInfoSync(
  packageName: string,
  options?: Parameters<typeof getPackageInfoSyncUnsafe>[1],
): PackageInfoSync | undefined {
  const { value, capturedErrors } = captureConsoleError(() => {
    try {
      return getPackageInfoSyncUnsafe(packageName, options)
    }
    catch {
      return undefined
    }
  })

  if (capturedErrors.length > 0 && shouldLogSuppressedResolutionError()) {
    for (const entry of capturedErrors) {
      process.stderr.write(`[weapp-vite:package-resolve] ${packageName}: ${formatCapturedErrorMessage(entry)}\n`)
    }
  }

  return value ?? undefined
}

/**
 * @description 安全执行 local-pkg 异步解析，避免其内部 console.error 污染 CLI 输出
 */
export async function safeGetPackageInfo(
  packageName: string,
  options?: Parameters<typeof getPackageInfoUnsafe>[1],
): Promise<PackageInfoAsync | undefined> {
  // eslint-disable-next-line no-console -- 这里需要暂存并恢复原始 console.error
  const originalConsoleError = console.error
  const capturedErrors: unknown[][] = []

  // eslint-disable-next-line no-console -- 这里需要暂时拦截 local-pkg 内部的 console.error 噪音
  console.error = (...args: unknown[]) => {
    capturedErrors.push(args)
  }

  try {
    const value = await Promise.resolve(getPackageInfoUnsafe(packageName, options)).catch(() => undefined)
    if (capturedErrors.length > 0 && shouldLogSuppressedResolutionError()) {
      for (const entry of capturedErrors) {
        process.stderr.write(`[weapp-vite:package-resolve] ${packageName}: ${formatCapturedErrorMessage(entry)}\n`)
      }
    }
    return value ?? undefined
  }
  finally {
    // eslint-disable-next-line no-console -- 恢复原始 console.error
    console.error = originalConsoleError
  }
}

/**
 * @description 安全执行 local-pkg 模块解析，避免其内部 console.error 污染 CLI 输出
 */
export function safeResolveModule(
  moduleId: string,
  options?: Parameters<typeof resolveModuleUnsafe>[1],
): ResolvedModulePath | undefined {
  const { value, capturedErrors } = captureConsoleError(() => {
    try {
      return resolveModuleUnsafe(moduleId, options)
    }
    catch {
      return undefined
    }
  })

  if (capturedErrors.length > 0 && shouldLogSuppressedResolutionError()) {
    for (const entry of capturedErrors) {
      process.stderr.write(`[weapp-vite:module-resolve] ${moduleId}: ${formatCapturedErrorMessage(entry)}\n`)
    }
  }

  return value ?? undefined
}
