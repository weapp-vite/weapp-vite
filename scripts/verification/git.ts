/** 验证直接读取真实索引与工作区，不依赖外部 fsmonitor，也不修改用户配置。 */
export function verificationGitArgs(args: readonly string[]): string[] {
  return ['-c', 'core.fsmonitor=false', ...args]
}
