import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearFileCaches, readFile } from './cache'

describe('file cache readFile line endings', () => {
  let tempDir = ''

  beforeEach(async () => {
    clearFileCaches()
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wevu-compiler-cache-'))
  })

  afterEach(async () => {
    clearFileCaches()
    if (tempDir) {
      await fs.remove(tempDir)
    }
  })

  it('normalizes CRLF to LF', async () => {
    const filePath = path.join(tempDir, 'sample-crlf.vue')
    await fs.writeFile(filePath, '<template>\r\n  <view />\r\n</template>\r\n', 'utf8')

    const content = await readFile(filePath, { checkMtime: false })
    expect(content).toBe('<template>\n  <view />\n</template>\n')
  })

  it('normalizes legacy CR to LF', async () => {
    const filePath = path.join(tempDir, 'sample-cr.vue')
    await fs.writeFile(filePath, '<template>\r  <view />\r</template>\r', 'utf8')

    const content = await readFile(filePath, { checkMtime: true })
    expect(content).toBe('<template>\n  <view />\n</template>\n')
  })
})
