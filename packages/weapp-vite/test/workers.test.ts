import { fdir as Fdir } from 'fdir'
import { ModuleKind, Project, ScriptTarget } from 'ts-morph'
import { getFixture } from './utils'

async function compileDirectoryToCommonJS(inputDir: string, outputDir: string) {
  // 创建 ts-morph 项目
  const project = new Project({
    compilerOptions: {
      target: ScriptTarget.ES5,
      module: ModuleKind.CommonJS,
      outDir: outputDir,
      strict: true,
      allowJs: true, // 允许处理 JavaScript 文件
    },
  })
  // project.addSourceFilesAtPaths(path.resolve(inputDir, '**/*.{js.ts}'))
  const patterns = ['**/*.{js,ts}']// .map(x => `${inputDir}/${x}`)// .map(x => `${inputDir}/${x}`)
  const relFiles = await new Fdir()
    .withFullPaths()
    .globWithOptions(
      patterns,
      {
        // cwd: inputDir,
        windows: true,
        posixSlashes: true,
      },
    )
    .crawl(inputDir)
    .withPromise()
  for (const file of relFiles) {
    project.addSourceFileAtPath(file)
  }

  // 遍历输入目录，添加所有 .ts 和 .js 文件到项目
  // function addFilesFromDirectory(dir: string) {
  //   const files = fs.readdirSync(dir)
  //   for (const file of files) {
  //     const fullPath = path.join(dir, file)
  //     const stat = fs.statSync(fullPath)
  //     if (stat.isDirectory()) {
  //       addFilesFromDirectory(fullPath) // 递归处理子目录
  //     }
  //     else if (file.endsWith('.ts') || file.endsWith('.js')) {
  //       project.addSourceFileAtPath(fullPath)
  //     }
  //   }
  // }

  // // 确保输出目录存在
  // if (!fs.existsSync(outputDir)) {
  //   fs.mkdirSync(outputDir, { recursive: true })
  // }

  // // 添加文件
  // addFilesFromDirectory(inputDir)

  // 获取所有的 SourceFile
  // const sourceFiles = project.getSourceFiles()
  const result = project.emitToMemory()
  const sourceFiles = result.getFiles()
  return sourceFiles
  // 编译并输出文件
  // for (const sourceFile of sourceFiles) {
  //   const emitResult = sourceFile.getEmitOutput({
  //     emitOnlyDtsFiles: false,
  //   })
  //   if (emitResult.getEmitSkipped()) {
  //     console.error(`Failed to compile: ${sourceFile.getFilePath()}`)
  //     continue
  //   }

  //   console.log(`Compiled: ${sourceFile.getFilePath()}`)
  // }

  // console.log('Compilation completed.')
}
describe('workers', () => {
  it('getFixture(workers)', async () => {
    const sourceFiles = await compileDirectoryToCommonJS(getFixture('workers'), getFixture('workers/dist'))
    // console.log(sourceFiles)
    expect(sourceFiles.length).toBe(3)
  })
})
