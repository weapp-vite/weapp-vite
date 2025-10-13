export interface AutoRoutesSubPackage {
  root: string
  pages: string[]
}

export interface AutoRoutes {
  pages: string[]
  entries: string[]
  subPackages: AutoRoutesSubPackage[]
}
