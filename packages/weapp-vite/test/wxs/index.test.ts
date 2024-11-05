// import path from 'pathe'
import type { ProjectOptions } from 'ts-morph'
// import { defu } from 'defu'
import { ModuleKind, Project, ScriptTarget } from 'ts-morph'

const sharedProjectOptions: ProjectOptions = {
  compilerOptions: {
    target: ScriptTarget.ES5,
    removeComments: true,
    esModuleInterop: false,
    allowSyntheticDefaultImports: false,
    // module: 'CommonJS',
    module: ModuleKind.CommonJS,
    // alwaysStrict: false,
    // strict: false,

  },
  useInMemoryFileSystem: true,
}

// https://github.com/microsoft/TypeScript/issues/30166
// https://github.com/microsoft/TypeScript/pull/32083
describe('wxs', () => {
  it('should ', async () => {
    const project = new Project(sharedProjectOptions)

    // const sourceFile = project.addSourceFileAtPathIfExists(path.resolve(__dirname, '../fixtures/wxs/case0.wxs.ts'))
    //     const sourceFile = project.createSourceFile('file.ts', `export const foo = "'hello world' from comm.wxs";
    // export const bar = function (d: string) {
    //   return d;
    // }
    // `, { overwrite: true })
    const sourceFile = project.createSourceFile('file.ts', `export const foo = "'hello world' from comm.wxs";
export const bar = function (d: string) {
  return d;
}
`)
    // project.getSourceFiles().forEach((sourceFile) => {
    //   const exportsModule = sourceFile.getVariableDeclaration('__esModule')
    //   if (exportsModule) {
    //     exportsModule.remove()
    //   }
    //   sourceFile.saveSync()
    // })
    // await sourceFile?.save()
    // const res = await sourceFile.emit()
    const exportsModule = sourceFile.getVariableDeclaration('__esModule')
    if (exportsModule) {
      exportsModule.remove()
    }
    await sourceFile.save()
    const emitOutput = sourceFile.getEmitOutput()
    // emitOutput.getEmitSkipped() // returns: boolean
    for (const outputFile of emitOutput.getOutputFiles()) {
      // console.log(outputFile.getFilePath(), outputFile.getWriteByteOrderMark(), outputFile.getText())
      expect(outputFile.getFilePath()).toMatchSnapshot('FilePath')
      expect(outputFile.getText()).toMatchSnapshot('Text')
    }
    // console.log(res.compilerObject.emittedFiles)
    // console.log(res)
    // await project.emit()
    // const fs = project.getFileSystem()
    //  expect(await fs.readFile('file.ts')).toBe('console.log(5);')
    // const res = await project.emit()
    // console.log(res)
  })

  it('should 0', () => {
    const project = new Project(sharedProjectOptions)
    const sourceFile = project.createSourceFile('file.ts', `var foo = "'hello world' from comm.wxs";
var bar = function(d) {
  return d;
}
module.exports = {
  foo: foo,
  bar: bar
};
`)

    const emitOutput = sourceFile.getEmitOutput()
    for (const outputFile of emitOutput.getOutputFiles()) {
      expect(outputFile.getFilePath()).toMatchSnapshot('FilePath')
      expect(outputFile.getText()).toMatchSnapshot('Text')
    }
  })

  it('should 1', () => {
    const project = new Project(sharedProjectOptions)
    const sourceFile = project.createSourceFile('file.ts', `var tools = require("./tools.wxs");

console.log(tools.FOO);
console.log(tools.bar("logic.wxs"));
console.log(tools.msg);
`)

    const emitOutput = sourceFile.getEmitOutput()
    for (const outputFile of emitOutput.getOutputFiles()) {
      expect(outputFile.getFilePath()).toMatchSnapshot('FilePath')
      expect(outputFile.getText()).toMatchSnapshot('Text')
    }
  })

  it('should 2', () => {
    const project = new Project(sharedProjectOptions)
    const sourceFile = project.createSourceFile('file.ts', `var some_msg = "hello world";
module.exports = {
  msg : some_msg,
}
`)

    const emitOutput = sourceFile.getEmitOutput()
    for (const outputFile of emitOutput.getOutputFiles()) {
      expect(outputFile.getFilePath()).toMatchSnapshot('FilePath')
      expect(outputFile.getText()).toMatchSnapshot('Text')
    }
  })

  it('should 3', () => {
    const project = new Project(sharedProjectOptions)
    const sourceFile = project.createSourceFile('file.ts', `// 方法一：单行注释

/*
方法二：多行注释
*/

/*
方法三：结尾注释。即从 /* 开始往后的所有 WXS 代码均被注释

var a = 1;
var b = 2;
var c = "fake";
`)

    const emitOutput = sourceFile.getEmitOutput()
    for (const outputFile of emitOutput.getOutputFiles()) {
      expect(outputFile.getFilePath()).toMatchSnapshot('FilePath')
      expect(outputFile.getText()).toMatchSnapshot('Text')
    }
  })

  it('should 4', () => {
    const project = new Project(sharedProjectOptions)
    const sourceFile = project.createSourceFile('file.ts', `const foo = "'hello world' from tools.wxs";
const bar = function (d) {
  return d;
}
module.exports = {
  FOO: foo,
  bar: bar,
};
module.exports.msg = "some msg";
`)

    const emitOutput = sourceFile.getEmitOutput()
    for (const outputFile of emitOutput.getOutputFiles()) {
      expect(outputFile.getFilePath()).toMatchSnapshot('FilePath')
      expect(outputFile.getText()).toMatchSnapshot('Text')
    }
  })

  it('should 5', () => {
    const project = new Project(sharedProjectOptions)
    const sourceFile = project.createSourceFile('file.ts', `export const foo = "'hello world' from tools.wxs";
export const bar = function (d) {
  return d;
}

export const msg = "some msg";
`)

    const emitOutput = sourceFile.getEmitOutput()
    for (const outputFile of emitOutput.getOutputFiles()) {
      expect(outputFile.getFilePath()).toMatchSnapshot('FilePath')
      expect(outputFile.getText()).toMatchSnapshot('Text')
    }
  })
})
