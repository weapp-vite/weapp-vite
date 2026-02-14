export type AutoRoutesPages = [
  'pages/home/index',
  'pages/logs/index',
]

export type AutoRoutesEntries = [
  'pages/home/index',
  'pages/logs/index',
  'packageA/pages/cat',
]

export type AutoRoutesSubPackages = [
  {
    readonly root: 'packageA'
    readonly pages: ['pages/cat']
  },
]

export type AutoRoutesSubPackage = AutoRoutesSubPackages[number]

export interface AutoRoutes {
  readonly pages: AutoRoutesPages
  readonly entries: AutoRoutesEntries
  readonly subPackages: AutoRoutesSubPackages
}

export declare const routes: AutoRoutes
export declare const pages: AutoRoutesPages
export declare const entries: AutoRoutesEntries
export declare const subPackages: AutoRoutesSubPackages

export default routes
