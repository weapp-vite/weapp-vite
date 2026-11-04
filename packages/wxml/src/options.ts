import type { Platform } from './types'

/** 共享原始脚本标签列表；调用方需要查询集合时自行建立，避免共享可变 Set。 */
export const defaultRawTags: readonly string[] = Object.freeze(['wxs', 'sjs', 'ks', 'filter', 'script', 'import-sjs'])

const jdRawTags = Object.freeze([...defaultRawTags, 'jds'])
const qqRawTags = Object.freeze([...defaultRawTags, 'qs'])

/** 平台专有脚本只在对应平台启用，不把其他平台同名自定义组件视为脚本。 */
export function defaultRawTagsFor(platform: Platform): readonly string[] {
  return platform === 'jd' ? jdRawTags : platform === 'qq' ? qqRawTags : defaultRawTags
}
