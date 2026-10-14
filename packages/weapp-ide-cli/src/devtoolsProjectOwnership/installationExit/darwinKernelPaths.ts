// eslint-disable-next-line e18e/ban-dependencies -- 内核身份查询只依赖跨平台子进程封装，不加载 IDE 或 schema 运行时。
import { execa } from 'execa'

interface DarwinKernelPath {
  pid: number
  executable: string | null
}

const inspectionTimeoutMs = 10_000
// JXA 仅绑定 libSystem 读取内核路径；不访问 Application、System Events 或 UI。
const kernelPathsScript = `
ObjC.import('Foundation');
ObjC.bindFunction('malloc', ['void *', ['unsigned long']]);
ObjC.bindFunction('free', ['void', ['void *']]);
ObjC.bindFunction('proc_pidpath', ['int', ['int', 'void *', 'uint32_t']]);
ObjC.bindFunction('strchr', ['char *', ['void *', 'int']]);
function run(argv) {
  var pids = JSON.parse(argv[0]);
  var buffer = $.malloc(4096);
  if (!buffer) throw new Error('Cannot allocate process path buffer.');
  try {
    return JSON.stringify(pids.map(function(pid) {
      var count = $.proc_pidpath(pid, buffer, 4096);
      return { pid: pid, executable: count > 0 ? $.strchr(buffer, 47) : null };
    }));
  } finally { $.free(buffer); }
}
`

/** 在 JSON 边界严格核验内核响应，不让进程身份查询依赖 schema 运行时。 */
function parseKernelPaths(stdout: string): DarwinKernelPath[] {
  const parsed: unknown = JSON.parse(stdout)
  if (!Array.isArray(parsed)) {
    throw new TypeError('Invalid kernel process paths.')
  }
  const entries: unknown[] = parsed
  return entries.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).length !== 2
      || !('pid' in entry) || typeof entry.pid !== 'number' || !Number.isSafeInteger(entry.pid) || entry.pid <= 0
      || !('executable' in entry) || (entry.executable !== null && typeof entry.executable !== 'string')) {
      throw new TypeError('Invalid kernel process path entry.')
    }
    return { pid: entry.pid, executable: entry.executable }
  })
}

/** 系统 JXA/libproc 不可用时明确拒绝核验，不安装工具或以进程标题降级。 */
export async function readDarwinKernelPaths(pids: number[], timeoutMs: number = inspectionTimeoutMs) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('Installation-exit recovery cannot inspect kernel executable paths.')
  }
  const result = await execa('/usr/bin/osascript', ['-l', 'JavaScript', '-e', kernelPathsScript, JSON.stringify(pids)], {
    timeout: Math.min(inspectionTimeoutMs, timeoutMs),
    reject: false,
    env: { LC_ALL: 'C' },
  })
  if (result.exitCode !== 0 || result.timedOut || result.signal || result.stderr?.trim()) {
    throw new Error('Installation-exit recovery cannot inspect kernel executable paths.')
  }
  let parsed: DarwinKernelPath[]
  try {
    parsed = parseKernelPaths(result.stdout)
  }
  catch {
    throw new Error('Installation-exit recovery received incomplete kernel executable paths.')
  }
  const entries = new Map(parsed.map(entry => [entry.pid, entry.executable]))
  if (entries.size !== pids.length || parsed.length !== pids.length || pids.some(pid => !entries.has(pid))) {
    throw new Error('Installation-exit recovery received incomplete kernel process identities.')
  }
  return entries
}
