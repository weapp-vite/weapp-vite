export interface AutoRoutesSubPackage {
  root: string
  pages: string[]
}

export interface AutoRoutesAppGlobalData {
  __autoRoutesPages?: string[]
  __autoRoutesEntries?: string[]
  __autoRoutesSubPackages?: AutoRoutesSubPackage[]
}

export interface AutoRoutesAppRoutes {
  pages?: string[]
  entries?: string[]
  subPackages?: AutoRoutesSubPackage[]
}

export interface AutoRoutesAppInstance {
  globalData?: AutoRoutesAppGlobalData
  routes?: AutoRoutesAppRoutes
}

export interface WxSubPackageConfig {
  root?: string
  pages?: string[]
}

export interface WxAppConfig {
  pages?: string[]
  subPackages?: WxSubPackageConfig[]
  subpackages?: WxSubPackageConfig[]
}

export interface RouteLink {
  route: string
  title: string
  kind: 'main' | 'subpackage'
  url: string
}
