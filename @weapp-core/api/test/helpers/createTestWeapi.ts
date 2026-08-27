import { createWeapi } from '@/index'

export type WeapiTestInstance = Record<string, any> & {
  resolveTarget: (method: string) => any
  supports: (method: string, options?: any) => boolean
}

/**
 * @description 创建测试用 weapi 实例（宽松类型，便于覆盖跨端不支持场景）
 */
export function createTestWeapi(options: any = {}): WeapiTestInstance {
  return createWeapi(options as any) as WeapiTestInstance
}
