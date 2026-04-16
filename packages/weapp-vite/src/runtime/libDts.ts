import type { Options as RolldownDtsOptions } from 'rolldown-plugin-dts'
import type { ConfigService } from './config/types'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { build } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'
import { resolveWeappLibEntries } from './lib'
import { generateVueDtsWithInternal, generateVueDtsWithVueTsc } from './libDts/generateVueDts'
import { getVueCompilerLibOrUndefined, rewriteVueComponentTypeToWevu, shouldRewriteWevuComponentType } from './libDts/rewriteWevuComponent'
import { ensureStub, isBundledDtsEntry, normalizeRolldownDtsOutput, tsconfigHasProjectReferences } from './libDts/shared'

export async function generateLibDts(configService: ConfigService) {
  const libConfig = configService.weappLibConfig
  if (!libConfig) {
    return
  }
  if (!libConfig.enabled) {
    return
  }
  const dtsOptions = libConfig.dts
  if (dtsOptions?.enabled === false) {
    return
  }

  const entries = await resolveWeappLibEntries(configService, libConfig)
  if (entries.length === 0) {
    return
  }

  const vueEntries = entries.filter(entry => entry.input.endsWith('.vue'))
  const tsEntries = entries.filter(entry => !entry.input.endsWith('.vue') && isBundledDtsEntry(entry.input))

  const input: Record<string, string> = {}

  for (const entry of tsEntries) {
    input[entry.outputBase] = entry.input
  }

  const inputNames = Object.keys(input)
  if (inputNames.length > 0) {
    const tsconfigPath = path.resolve(configService.cwd, 'tsconfig.json')
    const hasTsconfig = await fs.pathExists(tsconfigPath)
    const userRolldownOptions: RolldownDtsOptions = dtsOptions?.rolldown ?? {}
    const hasUserTsconfig = Object.hasOwn(userRolldownOptions, 'tsconfig')
    const hasUserBuild = Object.hasOwn(userRolldownOptions, 'build')
    const userTsconfig = userRolldownOptions.tsconfig
    const resolvedTsconfig = hasUserTsconfig
      ? (typeof userTsconfig === 'string' || userTsconfig === false
          ? userTsconfig
          : (hasTsconfig ? tsconfigPath : false))
      : hasTsconfig
        ? tsconfigPath
        : false
    const shouldUseBuildMode = !hasUserBuild && await tsconfigHasProjectReferences(resolvedTsconfig)
    const compilerOptions: NonNullable<RolldownDtsOptions['compilerOptions']> = {
      allowImportingTsExtensions: true,
      allowJs: true,
      ...userRolldownOptions.compilerOptions,
    }
    await build({
      input,
      plugins: dts({
        ...userRolldownOptions,
        tsconfig: resolvedTsconfig,
        build: shouldUseBuildMode ? true : userRolldownOptions.build,
        compilerOptions,
        cwd: configService.cwd,
        emitDtsOnly: true,
        vue: false,
      }),
      output: {
        dir: configService.outDir,
        entryFileNames: '[name].d.ts',
      },
      write: true,
    })
    await normalizeRolldownDtsOutput(tsEntries, configService.outDir)
  }

  if (vueEntries.length > 0) {
    if (dtsOptions?.mode === 'vue-tsc') {
      await generateVueDtsWithVueTsc(configService, libConfig, vueEntries, dtsOptions)
    }
    else {
      await generateVueDtsWithInternal(configService, vueEntries, dtsOptions)
    }
  }

  await Promise.all(entries.map(entry => ensureStub(entry, configService.outDir)))

  if (vueEntries.length > 0) {
    const preferLib = dtsOptions?.mode === 'vue-tsc'
      ? getVueCompilerLibOrUndefined(dtsOptions?.vueTsc?.vueCompilerOptions?.lib)
      : getVueCompilerLibOrUndefined(dtsOptions?.internal?.vueCompilerOptions?.lib)
    if (shouldRewriteWevuComponentType(preferLib)) {
      await Promise.all(vueEntries.map(async (entry) => {
        const outputPath = path.resolve(configService.outDir, `${entry.outputBase}.d.ts`)
        if (!await fs.pathExists(outputPath)) {
          return
        }
        const content = await fs.readFile(outputPath, 'utf8')
        const normalized = rewriteVueComponentTypeToWevu(content)
        if (normalized !== content) {
          await fs.writeFile(outputPath, normalized)
        }
      }))
    }
  }
}
