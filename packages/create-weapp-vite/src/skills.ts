import type { ChildProcess } from 'node:child_process'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- skills 安装需要跨平台命令解析和进程超时控制。
import { execa } from 'execa'

export const RECOMMENDED_SKILLS_SOURCE = 'sonofmagic/skills'
export const RECOMMENDED_SKILLS_INSTALL_COMMAND = `npx --yes skills add ${RECOMMENDED_SKILLS_SOURCE}`

const SKILLS_INSTALL_TIMEOUT_MS = 60_000

interface SkillsInstallOptions {
  env?: NodeJS.ProcessEnv
}

async function terminateSkillsProcessTree(child: Pick<ChildProcess, 'pid' | 'kill'>) {
  if (!child.pid) {
    return
  }

  if (process.platform === 'win32') {
    try {
      await execa('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
        timeout: 5_000,
        killSignal: 'SIGKILL',
        forceKillAfterDelay: 0,
      })
      return
    }
    catch {
      child.kill('SIGKILL')
      return
    }
  }

  try {
    // 独立进程组包含 npx、skills 及其 git 子进程，避免超时后遗留网络请求。
    process.kill(-child.pid, 'SIGKILL')
  }
  catch {
    child.kill('SIGKILL')
  }
}

/**
 * @description 安装推荐的 AI skills。
 */
export async function installRecommendedSkills(cwd: string, options: SkillsInstallOptions = {}) {
  const child = execa('npx', ['--yes', 'skills', 'add', RECOMMENDED_SKILLS_SOURCE], {
    cwd,
    env: { ...process.env, ...options.env },
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    windowsHide: true,
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  let timeoutError: Error | undefined
  let cleanup: Promise<void> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timeoutError = new Error('AI skills 安装超过 60 秒，已终止安装进程；可稍后手动安装')
      cleanup = terminateSkillsProcessTree(child)
      void cleanup.then(() => reject(timeoutError), reject)
    }, SKILLS_INSTALL_TIMEOUT_MS)
  })

  try {
    await Promise.race([child, deadline])
  }
  catch (error) {
    if (timeoutError) {
      await cleanup
      throw timeoutError
    }
    throw error
  }
  finally {
    clearTimeout(timer)
  }
}
