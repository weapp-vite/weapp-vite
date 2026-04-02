import type { ExposedPackageId } from './constants'
import type { ResolvedExposedPackage } from './exposedPackages'
import { resolveExposedPackage, resolveExposedPackages } from './exposedPackages'

export interface ExposedPackageSummary extends ResolvedExposedPackage {}

export async function loadPackageSummary(workspaceRoot: string, id: ExposedPackageId): Promise<ExposedPackageSummary> {
  return resolveExposedPackage(workspaceRoot, id)
}

export async function loadExposedCatalog(workspaceRoot: string) {
  return resolveExposedPackages(workspaceRoot)
}
