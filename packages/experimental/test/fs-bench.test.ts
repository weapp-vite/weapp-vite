import path from 'node:path'
import fs from 'fs-extra'

// 要测试的文件路径
const testFilePath = path.join(__dirname, 'testfile.txt')

describe.skip('item', () => {
// 创建一个测试文件

  // 记录时间差的函数
  function timeTest(fn: () => any, description: string) {
    const start = process.hrtime()
    return fn().then(() => {
      const [seconds, nanoseconds] = process.hrtime(start)
      console.log(`${description} took ${seconds} seconds and ${nanoseconds} nanoseconds`)
    })
  }

  // 1. 使用 fs.exists
  function testFsExists() {
    return fs.exists(testFilePath)
  }

  // 2. 使用 fs.pathExists (fs-extra)
  function testFsPathExists() {
    return fs.pathExists(testFilePath)
  }

  // 3. 使用 fs.promises.access
  function testFsPromisesAccess() {
    return fs.access(testFilePath).then(() => true).catch(() => false)
  }

  // 运行测试
  async function runTests() {
    console.log('Running fs.exists test...')
    await timeTest(testFsExists, 'fs.exists')

    console.log('Running fs.pathExists (fs-extra) test...')
    await timeTest(testFsPathExists, 'fs.pathExists (fs-extra)')

    console.log('Running fs.promises.access test...')
    await timeTest(testFsPromisesAccess, 'fs.promises.access')
  }
  it('should ', async () => {
    fs.writeFileSync(testFilePath, 'Hello, world!')
    // 执行测试
    await runTests()
    // 删除测试文件
    fs.unlinkSync(testFilePath)
  })
})
