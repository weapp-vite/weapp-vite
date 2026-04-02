import type { TemplateResult } from 'lit'
import type { RenderContext } from './renderContext'

export type TemplateScope = Record<string, any>
export type TemplateRenderer = (scope: TemplateScope, ctx: RenderContext) => TemplateResult | string | unknown

export { createTemplate, renderTemplate } from './legacyTemplate'
