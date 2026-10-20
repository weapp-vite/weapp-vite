import type { ConfigService, ResolvedWeappLibConfig } from '../src/runtime/config/types'
import { fs } from '@weapp-core/shared/fs'
import { getPackageInfoSync } from 'local-pkg'
import path from 'pathe'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { generateVueDtsWithInternal, generateVueDtsWithVueTsc } from '../src/runtime/libDts/generateVueDts'
import { getFixture } from './utils'

const sourceFixture = path.join(getFixture('lib-mode'), 'type-regression')
const reportRoot = path.join(getFixture('lib-mode'), '.tmp', 'template-ref-consumer-contract')

describe('lib mode template ref declaration consumer contracts', () => {
  it.each(['internal', 'vue-tsc'] as const)('checks native and browser ref consumer contracts after real %s declaration output', async (mode) => {
    await fs.ensureDir(reportRoot)
    const reportDir = await fs.mkdtemp(path.join(reportRoot, `${mode}-`))
    const evidence: Record<string, unknown> = {
      mode,
      scope: 'consumer-source-contract',
      consumerContractStatus: 'not-run',
      strictProgramStatus: 'not-run',
      compiler: { status: 'not-created', version: ts.version },
    }
    const root = await fs.mkdtemp(path.join(getFixture('lib-mode'), '.tmp-template-refs-'))
    try {
      await fs.copy(sourceFixture, root)
      await fs.ensureDir(path.join(root, 'node_modules'))
      for (const name of ['wevu', 'vue']) {
        const info = getPackageInfoSync(name, { paths: [import.meta.dirname] })
        expect(info, `Missing fixture dependency: ${name}`).toBeDefined()
        await fs.symlink(info!.rootPath, path.join(root, 'node_modules', name), 'junction')
      }

      async function generate(lib: 'wevu' | 'vue', files: string[]) {
        const tsconfigPath = path.join(root, `tsconfig.${lib}.json`)
        const configFiles = lib === 'wevu' ? [...files, 'platform.d.ts'] : files
        await fs.writeJson(tsconfigPath, {
          compilerOptions: {
            strict: true,
            module: 'ESNext',
            moduleResolution: 'Bundler',
            target: 'ESNext',
            lib: ['ESNext', 'DOM'],
          },
          files: configFiles,
        })
        const libConfig: ResolvedWeappLibConfig = {
          enabled: true,
          root,
          entry: files,
          preservePath: true,
          componentJson: 'auto',
          dts: {
            mode,
            internal: { tsconfig: tsconfigPath, vueCompilerOptions: { lib } },
            vueTsc: {
              tsconfig: { files: configFiles.map(file => path.join(root, file)) },
              compilerOptions: { strict: true },
              vueCompilerOptions: { lib },
            },
          },
        }
        const config = {
          cwd: root,
          absoluteSrcRoot: root,
          outDir: path.join(root, 'dist'),
          weappLibConfig: libConfig,
        } as ConfigService
        const entries = files.map(file => ({
          input: path.join(root, file),
          outputBase: file.replace(/\.vue$/, ''),
        }))
        if (mode === 'vue-tsc') {
          await generateVueDtsWithVueTsc(config, libConfig, entries, libConfig.dts)
        }
        else {
          await generateVueDtsWithInternal(config, entries, libConfig.dts)
        }
      }

      await generate('wevu', ['TemplateRefs.vue', 'Child.vue'])
      await generate('vue', ['VueMap.vue'])
      for (const name of ['TemplateRefs', 'Child', 'VueMap']) {
        expect(await fs.pathExists(path.join(root, 'dist', `${name}.d.ts`))).toBe(true)
      }

      const consumerPath = path.join(root, 'consumer.ts')
      const program = ts.createProgram([consumerPath], {
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        types: [],
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ESNext,
        lib: ['lib.esnext.d.ts', 'lib.dom.d.ts'],
      })
      const compilerState: Record<string, unknown> = {
        status: 'created',
        version: ts.version,
        options: program.getCompilerOptions(),
        rootFileNames: program.getRootFileNames(),
        sourceFileNames: program.getSourceFiles().map(file => file.fileName),
      }
      evidence.compiler = compilerState
      const host: ts.FormatDiagnosticsHost = {
        getCurrentDirectory: () => root,
        getCanonicalFileName: file => file,
        getNewLine: () => '\n',
      }
      const sourceTexts: Record<string, string> = {}
      evidence.diagnosticSourceTexts = sourceTexts
      function serializeDiagnostic(diagnostic: ts.Diagnostic): Record<string, unknown> {
        const { file, relatedInformation, ...details } = diagnostic
        if (file) {
          sourceTexts[file.fileName] = file.text
        }
        // SourceFile 含循环 AST；原样保留诊断字段、消息链和关联诊断，源码单独存档。
        return {
          ...details,
          fileName: file?.fileName,
          relatedInformation: relatedInformation?.map(serializeDiagnostic),
        }
      }

      const fullDiagnostics = ts.getPreEmitDiagnostics(program)
      compilerState.optionsDiagnostics = program.getOptionsDiagnostics().map(serializeDiagnostic)
      compilerState.globalDiagnostics = program.getGlobalDiagnostics().map(serializeDiagnostic)
      evidence.strictProgramStatus = fullDiagnostics.length === 0 ? 'passed' : 'failed'
      evidence.fullProgramDiagnostics = fullDiagnostics.map(serializeDiagnostic)
      await fs.outputFile(path.join(reportDir, 'program-diagnostics.txt'), ts.formatDiagnostics(fullDiagnostics, host))

      const consumer = program.getSourceFile(consumerPath)
      expect(consumer, 'Missing declaration consumer source').toBeDefined()
      const syntacticDiagnostics = program.getSyntacticDiagnostics(consumer!)
      const semanticDiagnostics = program.getSemanticDiagnostics(consumer!)
      const contractDiagnostics = [...syntacticDiagnostics, ...semanticDiagnostics]
      evidence.consumerSyntacticDiagnostics = syntacticDiagnostics.map(serializeDiagnostic)
      evidence.consumerSemanticDiagnostics = semanticDiagnostics.map(serializeDiagnostic)
      evidence.consumerContractStatus = contractDiagnostics.length === 0 ? 'passed' : 'failed'

      // 此处只验消费源码的 ref/API 契约；完整 SDK/DOM 诊断另存，不代表发布级 strict 全绿。
      const reportPath = path.relative(getFixture('lib-mode'), reportDir)
      expect(contractDiagnostics, `${ts.formatDiagnostics(contractDiagnostics, host)}\nFull program evidence: ${reportPath}`).toEqual([])
    }
    catch (error) {
      evidence.error = error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { message: String(error) }
      throw error
    }
    finally {
      try {
        await fs.writeJson(path.join(reportDir, 'compiler-state.json'), evidence, { spaces: 2 })
      }
      finally {
        await fs.remove(root)
      }
    }
  })
})
