import fs from 'node:fs/promises'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 只读内核映像的设备号与 inode，避免依赖受保护系统文件的路径访问权限。
import { execa } from 'execa'

function identity(device: bigint, inode: bigint) {
  return `${device}:${inode}`
}

function belongsToInstallation(root: string, file: string) {
  const relative = path.relative(root, file)
  return !relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
}

/** 完整采集所选安装的文件身份；目录或映像不可读取时仍拒绝推断退出。 */
async function installationIdentities(root: string) {
  const files = new Set<string>()
  const directories = new Set<string>()
  const visit = async (file: string): Promise<void> => {
    const resolved = await fs.realpath(file)
    if (!belongsToInstallation(root, resolved)) {
      return
    }
    const stat = await fs.stat(resolved, { bigint: true })
    if (stat.isDirectory()) {
      if (directories.has(resolved)) {
        return
      }
      directories.add(resolved)
      for (const name of await fs.readdir(resolved)) {
        await visit(path.join(resolved, name))
      }
    }
    else if (stat.isFile()) {
      files.add(identity(stat.dev, stat.ino))
    }
  }
  await visit(root)
  return files
}

/** 路径无权解析时独立读取全部映像身份，不把部分 lsof 结果当作完整证明。 */
async function mappedIdentities(pid: number) {
  const result = await execa('/usr/sbin/lsof', ['-nP', '-a', '-p', String(pid), '-d', 'txt', '-F0pftDin'], {
    timeout: 10_000,
    reject: false,
    env: { LC_ALL: 'C' },
  })
  if (result.exitCode !== 0 || result.stderr?.trim()) {
    throw new Error('Installation-exit recovery cannot inspect executable image identities.')
  }
  const fields = result.stdout.split('\0').map(field => field.replace(/^\r?\n/, '')).filter(Boolean)
  if (fields.shift() !== `p${pid}` || !fields.length || fields.length % 5 !== 0) {
    throw new Error('Installation-exit recovery received incomplete executable image identities.')
  }
  const images = new Map<string, string>()
  for (let index = 0; index < fields.length; index += 5) {
    const [descriptor, type, device, inode, name] = fields.slice(index, index + 5)
    if (descriptor !== 'ftxt' || type !== 'tREG' || !/^D0x[\da-f]+$/i.test(device!) || !/^i\d+$/.test(inode!)
      || !name?.startsWith('n/') || /[\r\n]/.test(name)) {
      throw new Error('Installation-exit recovery received unverifiable executable image identities.')
    }
    const file = name.slice(1)
    const value = identity(BigInt(device!.slice(1)), BigInt(inode!.slice(1)))
    if (images.has(file) && images.get(file) !== value) {
      throw new Error('Installation-exit recovery executable image identity changed during inspection.')
    }
    images.set(file, value)
  }
  return images
}

/** 每次安装核验共享一次文件清单和每个 PID 的映像采样；未知身份与安装内映像均阻断。 */
export function createProtectedImageVerifier(installationRoot: string) {
  let files: Promise<Set<string>> | undefined
  const processes = new Map<number, Promise<Map<string, string>>>()
  return async (pid: number, image: string) => {
    let images = processes.get(pid)
    if (!images) {
      images = mappedIdentities(pid)
      processes.set(pid, images)
    }
    const value = (await images).get(image)
    if (!value) {
      throw new Error('Installation-exit recovery has no identity for a protected executable image.')
    }
    files ??= installationIdentities(installationRoot)
    if ((await files).has(value)) {
      throw new Error('The selected WeChat DevTools installation still has a live process; no ownership was recovered.')
    }
  }
}
