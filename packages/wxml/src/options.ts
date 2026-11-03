/** 共享原始脚本标签列表；调用方需要查询集合时自行建立，避免共享可变 Set。 */
export const defaultRawTags: readonly string[] = Object.freeze(['wxs', 'sjs', 'ks', 'filter', 'script', 'import-sjs'])
