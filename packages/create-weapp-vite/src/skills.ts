import { spawn } from 'node:child_process'
import process from 'node:process'

export const RECOMMENDED_SKILLS_SOURCE = 'sonofmagic/skills'
export const RECOMMENDED_SKILLS_INSTALL_COMMAND = `npx skills add ${RECOMMENDED_SKILLS_SOURCE}`

function resolveNpxCommand() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx'
}

/**
 * @description 安装推荐的本地 AI skills。
 */
export async function installRecommendedSkills(cwd: string) {
  const command = resolveNpxCommand()

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, ['skills', 'add', RECOMMENDED_SKILLS_SOURCE], {
      cwd,
      stdio: 'inherit',
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`skills install exited with code ${code ?? 'unknown'}`))
    })
  })
}
