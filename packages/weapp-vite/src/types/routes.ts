export interface AutoRoutesSubPackage {
  root: string
  pages: string[]
  [k: string]: unknown
}

export interface AutoRoutes {
  pages: string[]
  entries: string[]
  subPackages: AutoRoutesSubPackage[]
}
