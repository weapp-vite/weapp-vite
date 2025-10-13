import type { AutoRoutes, AutoRoutesSubPackage } from './types/routes'
import { getCompilerContext } from './context'

function createGetter<T>(resolver: () => T) {
  return {
    configurable: false,
    enumerable: true,
    get: resolver,
  } as const
}

const ctx = getCompilerContext()
const service = ctx.autoRoutesService

const routes = {} as AutoRoutes
Object.defineProperties(routes, {
  pages: createGetter(() => {
    return service?.getReference().pages ?? []
  }),
  entries: createGetter(() => {
    return service?.getReference().entries ?? []
  }),
  subPackages: createGetter(() => {
    return service?.getReference().subPackages ?? []
  }),
})

const pages = routes.pages
const entries = routes.entries
const subPackages = routes.subPackages

export type { AutoRoutes, AutoRoutesSubPackage }
export { entries, pages, routes, subPackages }
export default routes
