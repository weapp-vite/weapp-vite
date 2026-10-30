import type { LanguagePlatform } from '../types'
import type { ComponentAttribute, ComponentSchema } from './types'
import { getLanguageProfile } from '../profiles'
import alipay from './data/alipay.json'
import jd from './data/jd.json'
import ks from './data/ks.json'
import qq from './data/qq.json'
import swan from './data/swan.json'
import tt from './data/tt.json'
import ty from './data/ty.json'
import weapp from './data/weapp.json'
import xhs from './data/xhs.json'

export type { ComponentAttribute, ComponentEntry, ComponentSchema } from './types'

const snapshots = { weapp, alipay, tt, swan, qq, ty, xhs, jd, ks } as unknown as Partial<Record<LanguagePlatform, ComponentSchema>>

/** 返回平台自己的离线组件数据；缺少来源时明确返回不可用，绝不回退为微信组件表。 */
export function getComponentSchema(platform: LanguagePlatform): ComponentSchema {
  return snapshots[platform] ?? {
    platform,
    availability: 'unavailable',
    version: 'unavailable',
    source: getLanguageProfile(platform).documentation[0].url,
    snapshotDate: '2026-10-30',
    upstreamRetrievedAt: null,
    reason: '尚无经过核实的平台专属离线组件快照；仅提供已登记的模板语法能力。',
    components: [],
  }
}

/** 查询指定平台已登记的组件名，不把未知组件作为错误。 */
export function getComponentNames(platform: LanguagePlatform): string[] {
  return getComponentSchema(platform).components.map(component => component.name)
}

/** 查询组件属性与枚举，供离线补全及悬浮说明使用。 */
export function getComponentAttributes(platform: LanguagePlatform, tagName: string): ComponentAttribute[] {
  return getComponentSchema(platform).components.find(component => component.name === tagName)?.attrs ?? []
}
