import fsPromises from 'node:fs/promises'
import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { Templates } from './constants'

const templates = Templates.map((x) => {
  return {
    target: `../../../templates/${x.target}`,
    dest: `../templates/${x.dest}`,
  }
})

async function ensureGitignoreForTemplate(templateRoot: string) {
  const dotGitignore = path.resolve(templateRoot, '.gitignore')
  const plainGitignore = path.resolve(templateRoot, 'gitignore')

  if (await fs.pathExists(dotGitignore)) {
    await fs.move(dotGitignore, plainGitignore, { overwrite: true })
  }
}

export async function main() {
  const lockFile = path.join(os.tmpdir(), 'weapp-core-init-templates.lock')
  let lockHandle: fsPromises.FileHandle | undefined

  for (let i = 0; i < 200; i++) {
    try {
      lockHandle = await fsPromises.open(lockFile, 'wx')
      break
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') {
        throw error
      }
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  if (!lockHandle) {
    throw new Error('同步模板失败：等待锁超时')
  }

  try {
    for (const { dest, target } of templates) {
      const absDest = path.resolve(import.meta.dirname, dest)
      await fs.emptyDir(
        absDest,
      )
      await fs.copy(
        path.resolve(import.meta.dirname, target),
        absDest,
        {
          filter(src: string) {
            if (
              src.includes('node_modules')
              || src.includes('vite.config.ts.timestamp')
              || src.includes('dist')
              || src.includes('CHANGELOG.md')
              || src.includes('.turbo')
              || src.includes('.DS_Store')
            ) {
              return false
            }
            return true
          },
        },
      )

      await ensureGitignoreForTemplate(absDest)
    }
  }
  finally {
    await lockHandle.close()
    await fsPromises.unlink(lockFile).catch(() => {})
  }
}
