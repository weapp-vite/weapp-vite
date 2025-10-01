import type { PackageJson, TSConfig } from 'pkg-types'
import type { ProjectConfig } from './types'

export interface ContextDocument<T> {
  name: string
  path: string
  value: T | null
}

export interface Context {
  projectConfig: ContextDocument<ProjectConfig>
  packageJson: ContextDocument<PackageJson>
  viteConfig: ContextDocument<string>
  tsconfig: ContextDocument<TSConfig>
  tsconfigNode: ContextDocument<TSConfig>
  dts: ContextDocument<string>
}

export function createContext(): Context {
  return {
    projectConfig: createDocument<ProjectConfig>(),
    packageJson: createDocument<PackageJson>(),
    viteConfig: createDocument<string>(),
    tsconfig: createDocument<TSConfig>(),
    tsconfigNode: createDocument<TSConfig>(),
    dts: createDocument<string>(),
  }
}

function createDocument<T>(): ContextDocument<T> {
  return {
    name: '',
    path: '',
    value: null,
  }
}
