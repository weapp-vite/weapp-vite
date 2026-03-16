import type { ProjectConfig } from './types'

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonObject | JsonValue[]

interface JsonObject {
  [key: string]: JsonValue | undefined
}

export interface PackageJsonData extends JsonObject {
  name?: string
  homepage?: string
  type?: string
  scripts?: Record<string, string>
  devDependencies?: Record<string, string>
}

export interface TsConfigData extends JsonObject {}

/**
 * @description init 过程中单个文件的上下文结构
 */
export interface ContextDocument<T> {
  name: string
  path: string
  value: T | null
}

/**
 * @description init 过程的上下文容器
 */
export interface Context {
  projectConfig: ContextDocument<ProjectConfig>
  packageJson: ContextDocument<PackageJsonData>
  viteConfig: ContextDocument<string>
  tsconfig: ContextDocument<TsConfigData>
  tsconfigApp: ContextDocument<TsConfigData>
  tsconfigNode: ContextDocument<TsConfigData>
  dts: ContextDocument<string>
}

function createDocument<T>(): ContextDocument<T> {
  return {
    name: '',
    path: '',
    value: null,
  }
}

/**
 * @description 创建初始化上下文
 */
export function createContext(): Context {
  return {
    projectConfig: createDocument<ProjectConfig>(),
    packageJson: createDocument<PackageJsonData>(),
    viteConfig: createDocument<string>(),
    tsconfig: createDocument<TsConfigData>(),
    tsconfigApp: createDocument<TsConfigData>(),
    tsconfigNode: createDocument<TsConfigData>(),
    dts: createDocument<string>(),
  }
}
