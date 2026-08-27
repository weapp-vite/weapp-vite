import fs from 'node:fs'
import path from 'node:path'

const NOT_DETECTED = '未检测到'
const PACKAGE_JSON_RELATIVE_PATHS = [
  'Contents/Resources/app.asar.unpacked/package.json',
  'Contents/Resources/package.nw/package.json',
] as const

export interface WechatDevtoolsMetadata {
  appPath: string
  buildTime: string
  packageJsonPath: string
  productName: string
  version: string
}

function readJsonObject(filePath: string) {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined
  }
  catch {
    return undefined
  }
}

function readString(object: Record<string, unknown>, key: string) {
  const value = object[key]
  return typeof value === 'string' ? value : ''
}

export function resolveWechatDevtoolsPackageJsonPath(appPath: string) {
  if (path.basename(appPath) === 'package.json') {
    return appPath
  }

  const candidates = PACKAGE_JSON_RELATIVE_PATHS.map(relativePath => path.join(appPath, relativePath))
  return candidates.find(candidate => fs.existsSync(candidate)) ?? candidates[0]
}

export function resolveWechatDevtoolsMetadata(appPath: string): WechatDevtoolsMetadata {
  const packageJsonPath = resolveWechatDevtoolsPackageJsonPath(appPath)
  const json = readJsonObject(packageJsonPath)
  if (!json) {
    return {
      appPath,
      buildTime: NOT_DETECTED,
      packageJsonPath,
      productName: NOT_DETECTED,
      version: NOT_DETECTED,
    }
  }

  const rawBuildTime = json.buildTime
  const buildTime = typeof rawBuildTime === 'number'
    ? `${rawBuildTime} (${new Date(rawBuildTime).toISOString()})`
    : String(rawBuildTime ?? NOT_DETECTED)

  return {
    appPath,
    buildTime,
    packageJsonPath,
    productName: readString(json, 'productName') || readString(json, 'name') || NOT_DETECTED,
    version: readString(json, 'version') || NOT_DETECTED,
  }
}
