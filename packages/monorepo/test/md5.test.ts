import { getFileHash, isFileChanged } from '@/md5'
import fs from 'fs-extra'
import path from 'pathe'

describe('md5', () => {
  const testFilePath = path.resolve(import.meta.dirname, '../.gitignore')
  it('getFileHash', async () => {
    expect(
      getFileHash(await fs.readFile(
        testFilePath,
      )),
    ).toBe('c94e5b2028db1ba639d2fe1593eb6b37')
  })

  it('isFileChanged case 0', async () => {
    const str = await fs.readFile(
      testFilePath,
      'utf8',
    )
    expect(
      isFileChanged(
        str,
        `${str}\n`,
      ),
    ).toBe(true)
  })

  it('isFileChanged case 1', async () => {
    const str = await fs.readFile(
      testFilePath,
      'utf8',
    )
    expect(
      isFileChanged(
        str,
        str,
      ),
    ).toBe(false)
  })

  it('isFileChanged case 2', async () => {
    const str = await fs.readFile(
      testFilePath,
      'utf8',
    )
    const strBuf = await fs.readFile(
      testFilePath,
    )
    expect(
      isFileChanged(
        str,
        strBuf,
      ),
    ).toBe(false)
  })
})
