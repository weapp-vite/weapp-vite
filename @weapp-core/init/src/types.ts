import type { set } from '@weapp-core/shared'
// import type { Context } from './context'

/**
 * @description set-value 的写入方法签名
 */
export interface SetMethod {
  (path: set.InputType, value: any, options?: set.Options): void
}

/**
 * @description 共享更新参数
 */
export interface SharedUpdateOptions {
  root: string
  dest?: string
  write?: boolean
  cb?: (set: SetMethod) => void
  // ctx: Context
}

/**
 * @description project.config 更新参数
 */
export interface UpdateProjectConfigOptions extends SharedUpdateOptions {
  filename?: string
}

/**
 * @description package.json 更新参数
 */
export interface UpdatePackageJsonOptions extends SharedUpdateOptions {
  command?: 'weapp-vite'
  filename?: string
}

/**
 * @description project.config.json 的核心字段类型
 */
export interface ProjectConfig {
  miniprogramRoot?: string
  srcMiniprogramRoot?: string
  setting: {
    packNpmManually: boolean
    packNpmRelationList: {
      packageJsonPath: string
      miniprogramNpmDistDir: string
    }[]
  }
}
