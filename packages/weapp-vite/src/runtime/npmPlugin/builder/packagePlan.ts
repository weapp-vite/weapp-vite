import type { PackageJson } from 'pkg-types'
import type { PackageBuildOutput } from './output'
import type { BuildPackageArgs } from './packageBuilder'
import { isBuiltin } from 'node:module'
import { getPackageInfo } from 'local-pkg'
import path from 'pathe'
import { parseNpmPackageSpecifier } from '../../../utils/npmImport'
import { packageSearchOptions } from '../packageResolution'
import { settlePackageBuilds } from './output'
import { collectCopiedPackageRequests } from './packageRequests'

export interface PlannedPackage {
  args: BuildPackageArgs
  packageInfo: NonNullable<Awaited<ReturnType<typeof getPackageInfo>>>
  requests: Map<string, string>
  mini: boolean
  copied?: { directory: string, logicalDirectory: string, sourceDirectory: string, esDirectory?: string }
}

interface PackagePlanOperations {
  output?: PackageBuildOutput
  npmDirectories: string[]
  isMiniprogramPackage: (pkg: PackageJson) => boolean
  prepareMini: (node: PlannedPackage) => Promise<PlannedPackage['copied']>
  buildOrdinary: (node: PlannedPackage) => Promise<boolean>
  complete: (dep: string) => void
}

/** 先完成本批原生包，再扫描实际保留源码；普通依赖只按汇总后的入口集合发布一次。 */
export async function runPackageBuildPlan(args: BuildPackageArgs[], operations: PackagePlanOperations) {
  const nodes = new Map<string, PlannedPackage>()
  const scanned = new Set<PlannedPackage>()
  const preparedOutdated = new Map<PlannedPackage, boolean>()

  async function visit(input: BuildPackageArgs, request?: { specifier: string, resolveFrom: string }) {
    const packageInfo = await getPackageInfo(input.dep, packageSearchOptions(input.resolveFrom))
    if (!packageInfo) {
      if (request) {
        throw new Error(`[npm] 无法解析原生包依赖：${request.specifier}`)
      }
      return
    }
    // buffer/ 等请求只用于绕过 Node 内置模块解析；其逻辑 alias 仍与 buffer 相同。
    input = { ...input, dep: input.dep.replace(/\/+$/, '') }
    const key = `${path.resolve(input.outDir)}\0${packageInfo.rootPath}\0${input.dep}`
    let node = nodes.get(key)
    if (node) {
      const becameOutdated = !node.args.isDependenciesCacheOutdate && input.isDependenciesCacheOutdate
      node.args.isDependenciesCacheOutdate ||= input.isDependenciesCacheOutdate
      if (input.options !== node.args.options) {
        throw new Error(`[npm] 同一依赖目标收到不同构建配置：${input.dep}`)
      }
      if (request) {
        node.requests.set(request.specifier, request.resolveFrom)
      }
      if (becameOutdated) {
        scanned.delete(node)
      }
      // 节点在递归前登记；共享依赖和环不会等待各自的祖先 Promise。
      return
    }
    node = {
      args: { ...input },
      packageInfo,
      requests: new Map(request ? [[request.specifier, request.resolveFrom]] : []),
      mini: operations.isMiniprogramPackage(packageInfo.packageJson),
    }
    nodes.set(key, node)
    operations.output?.watchFile?.(path.join(packageInfo.rootPath, 'package.json'))
    if (node.mini) {
      preparedOutdated.set(node, node.args.isDependenciesCacheOutdate)
      node.copied = await operations.prepareMini(node)
      if (!node.copied) {
        return
      }
    }
    const dependencies = Object.keys(packageInfo.packageJson.dependencies ?? {})
    await settlePackageBuilds((node.mini ? dependencies : dependencies.filter(dep => isBuiltin(dep))).map(dep => visit({
      ...input,
      dep: node!.mini ? dep : `${dep}/`,
      resolveFrom: packageInfo.rootPath,
    })))
  }

  await settlePackageBuilds(args.map(input => visit(input)))
  while (true) {
    const pending = [...nodes.values()].filter(node => node.mini && node.copied && !scanned.has(node))
    if (!pending.length) {
      break
    }
    // 所有本轮原生节点已准备完成，解析过程中不同时改变另一份正在扫描的原生集合。
    await settlePackageBuilds(pending.map(async (node) => {
      if (preparedOutdated.get(node) !== node.args.isDependenciesCacheOutdate) {
        node.copied = await operations.prepareMini(node)
        preparedOutdated.set(node, node.args.isDependenciesCacheOutdate)
      }
    }))
    const requests: { node: PlannedPackage, requests: Awaited<ReturnType<typeof collectCopiedPackageRequests>> }[] = []
    await settlePackageBuilds(pending.map(async (node) => {
      requests.push({ node, requests: node.copied ? await collectCopiedPackageRequests(node.copied.directory, operations.npmDirectories) : [] })
    }))
    for (const { node } of requests) {
      scanned.add(node)
    }
    await settlePackageBuilds(requests.flatMap(({ node, requests }) => requests.map(({ specifier, relativeFile }) => {
      const parsed = parseNpmPackageSpecifier(specifier)!
      const source = relativeFile.startsWith('es/') && node.copied?.esDirectory
        ? path.join(node.copied.esDirectory, relativeFile.slice('es/'.length))
        : path.join(node.copied!.sourceDirectory, relativeFile)
      const resolveFrom = path.dirname(source)
      return visit({ ...node.args, dep: parsed.packageName, resolveFrom }, { specifier, resolveFrom })
    })))
  }
  const completed = new Set<PlannedPackage>()
  await settlePackageBuilds([...nodes.values()].filter(node => !node.mini).map(async (node) => {
    if (await operations.buildOrdinary(node)) {
      completed.add(node)
    }
  }))
  for (const node of nodes.values()) {
    if (completed.has(node) || node.copied) {
      operations.complete(node.args.dep)
    }
  }
}

/** 同一构建器的公开入口共用串行批次，兼容同期单项调用且禁止并发覆盖同一输出。 */
export function createPackageBatchQueue(run: (args: BuildPackageArgs[]) => Promise<void>) {
  const pending: { args: BuildPackageArgs[], resolve: () => void, reject: (error: unknown) => void }[] = []
  let scheduled = false
  return (args: BuildPackageArgs[]): Promise<void> => new Promise((resolve, reject) => {
    pending.push({ args, resolve, reject })
    if (scheduled) {
      return
    }
    scheduled = true
    queueMicrotask(async () => {
      try {
        while (pending.length) {
          const batch = pending.splice(0)
          try {
            await run(batch.flatMap(entry => entry.args))
            for (const entry of batch) {
              entry.resolve()
            }
          }
          catch (error) {
            for (const entry of batch) {
              entry.reject(error)
            }
          }
        }
      }
      finally {
        scheduled = false
      }
    })
  })
}
