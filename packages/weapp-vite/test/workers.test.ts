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
    skipAddingFilesFromTsConfig: true,
  })

  const patterns = ['**/*.{js,ts}']
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

  const result = project.emitToMemory()
  const sourceFiles = result.getFiles()
  return sourceFiles
}
describe('workers', () => {
  it('getFixture(workers)', async () => {
    const sourceFiles = await compileDirectoryToCommonJS(getFixture('workers'), getFixture('workers/dist'))
    // console.log(sourceFiles)
    expect(sourceFiles.length).toBe(3)
  })

  it('getFixture(workers0)', async () => {
    const sourceFiles = await compileDirectoryToCommonJS(getFixture('workers0'), getFixture('workers/dist'))
    // console.log(sourceFiles)
    expect(sourceFiles.length).toBe(1)
  })
})
