import type { BoundParser, CoreEntryApi, EntryFixture, RootEntryApi } from './types'

/** 每个冻结 profile 显式编译一次并绑定一次，不从平台名称推导词法配置。 */
export function bindCoreParsers(api: CoreEntryApi, fixtures: readonly EntryFixture[]): Map<string, BoundParser> {
  const parsers = new Map<string, BoundParser>()
  const definitions = new Map<string, string>()
  for (const fixture of fixtures) {
    const { syntax, rawTags } = fixture.options
    if (!syntax || !rawTags) {
      throw new Error('Core entry profiling requires explicit frozen syntax and rawTags')
    }
    const definition = { id: fixture.profileId, syntax, rawTags }
    const identity = JSON.stringify(definition)
    const previous = definitions.get(fixture.profileId)
    if (previous && previous !== identity) {
      throw new Error('One frozen profile id has conflicting lexical definitions')
    }
    if (!parsers.has(fixture.profileId)) {
      definitions.set(fixture.profileId, identity)
      parsers.set(fixture.profileId, api.createParser(api.compileDialect(definition)))
    }
  }
  return parsers
}

/** 根入口保留真实 options 归一化及兼容元数据成本，仅绑定相同的冻结输入选项。 */
export function bindRootParsers(api: RootEntryApi, fixtures: readonly EntryFixture[]): Map<string, BoundParser> {
  const parsers = new Map<string, BoundParser>()
  for (const fixture of fixtures) {
    if (!parsers.has(fixture.profileId)) {
      parsers.set(fixture.profileId, { scan: source => api.scan(source, fixture.options), parse: source => api.parse(source, fixture.options) })
    }
  }
  return parsers
}
