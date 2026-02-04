import type { PackageJson, TSConfig } from 'pkg-types'
import type { ProjectConfig } from './types'

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
  packageJson: ContextDocument<PackageJson>
  viteConfig: ContextDocument<string>
  tsconfig: ContextDocument<TSConfig>
  tsconfigApp: ContextDocument<TSConfig>
  tsconfigNode: ContextDocument<TSConfig>
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
    packageJson: createDocument<PackageJson>(),
    viteConfig: createDocument<string>(),
    tsconfig: createDocument<TSConfig>(),
    tsconfigApp: createDocument<TSConfig>(),
    tsconfigNode: createDocument<TSConfig>(),
    dts: createDocument<string>(),
  }
}
