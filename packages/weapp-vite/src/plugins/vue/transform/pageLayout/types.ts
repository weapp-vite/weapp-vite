import type { ConfigService } from '../../../../runtime/config/types'

export interface ResolvedPageLayout {
  file: string
  importPath: string
  kind: 'native' | 'vue'
  layoutName: string
  tagName: string
  props?: Record<string, LayoutPropValue>
}

export interface ResolvedPageLayoutPlan {
  currentLayout?: ResolvedPageLayout
  dynamicSwitch: boolean
  layouts: ResolvedPageLayout[]
  dynamicPropKeys: string[]
}

export interface NativeLayoutAssets {
  json?: string
  template?: string
  style?: string
  script?: string
}

export interface LayoutTransformLikeResult {
  script?: string
  template?: string
  config?: string
}

export interface DiscoveredLayoutFile {
  file: string
  kind: 'native' | 'vue'
  layoutName: string
  tagName: string
}

export type LayoutPropValue = string | number | boolean | null | {
  kind: 'expression'
  expression: string
}

export interface ResolvedLayoutMeta {
  name?: string
  props?: Record<string, LayoutPropValue>
  disabled?: boolean
}

export type PageLayoutConfigService = Pick<ConfigService, 'absoluteSrcRoot' | 'relativeOutputPath' | 'weappViteConfig'>
