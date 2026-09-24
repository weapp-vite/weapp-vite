import type { WxmlElementInfo, WxmlSourceLocation, WxmlTransformContext } from './wxmlTransform'

/** 诊断位置对应最终输出模板；不映射回 Vue 等源文件。 */
export interface WxmlValidationDiagnostic {
  severity: 'warning' | 'error'
  code?: string
  message: string
  location?: WxmlSourceLocation
}

/** 校验只观察模板，不能通过节点改写产物。 */
export type WxmlValidationVisitor = (node: WxmlElementInfo) => void | Promise<void>

/** 所有回调观察同一份完成输出转换的模板。 */
export interface WxmlValidationContext extends Pick<WxmlTransformContext, 'fileName' | 'root' | 'platform' | 'mode' | 'isDev' | 'subPackageRoot' | 'addWatchFile'> {
  walk: (visitor: WxmlValidationVisitor) => Promise<void>
  report: (diagnostic: WxmlValidationDiagnostic) => void
}

/** 返回值不用于转换；非 undefined 返回值会作为配置错误报告。 */
export type WxmlValidate = (code: string, context: WxmlValidationContext) => void | Promise<void>
