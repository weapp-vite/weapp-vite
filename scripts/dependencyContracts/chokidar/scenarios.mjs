export const scenarios = [
  { id: 'recover-recursive-win32', kind: 'recover', platform: 'win32', scope: 'recursive' },
  { id: 'recover-root-win32', kind: 'recover', platform: 'win32', scope: 'root' },
  { id: 'recover-cwd-depth-ignore-initial-win32', kind: 'recover', platform: 'win32', scope: 'recursive', cwd: true, depth: 1, ignoreInitial: true },
  { id: 'removed-exact-native-classification', kind: 'classify', platform: 'native', remove: true },
  { id: 'removed-exact-nonwindows-propagates', kind: 'classify', platform: 'linux', remove: true },
  { id: 'permission-existing-win32-propagates', kind: 'classify', platform: 'win32', remove: false },
  { id: 'removed-wrong-syscall-win32-propagates', kind: 'classify', platform: 'win32', remove: true, syscall: 'scandir' },
  { id: 'removed-wrong-path-win32-propagates', kind: 'classify', platform: 'win32', remove: true, wrongPath: true },
  { id: 'case-only-wrong-path-win32-propagates-original', kind: 'classify', platform: 'win32', remove: true, wrongPath: 'case-only' },
  { id: 'removed-eacces-win32-propagates', kind: 'classify', platform: 'win32', remove: true, code: 'EACCES' },
  { id: 'missing-probe-error-win32-propagates-original', kind: 'classify', platform: 'win32', remove: true, probeError: true },
  { id: 'close-during-root-readdir', kind: 'close', platform: 'win32', block: 'readdir' },
  { id: 'close-during-child-stat', kind: 'close', platform: 'win32', block: 'stat' },
  { id: 'remove-parent-during-child-stat', kind: 'remove-during-stat', platform: 'win32' },
  { id: 'recreate-before-old-target-read-returns', kind: 'replacement-read', platform: 'win32' },
  { id: 'shared-native-owner-survives-close', kind: 'shared', platform: 'win32' },
  { id: 'shared-owner-survives-failed-sibling-registration', kind: 'shared-failure', platform: 'win32' },
  { id: 'file-generation-before-remove-cooldown', kind: 'remove-cooldown', platform: 'win32', entryType: 'file' },
  { id: 'directory-generation-before-remove-cooldown', kind: 'remove-cooldown', platform: 'win32', entryType: 'directory' },
  { id: 'atomic-readd-coalesces-with-held-remove-cooldown', kind: 'remove-cooldown', platform: 'win32', entryType: 'atomic' },
  { id: 'old-file-listener-enoent-after-replacement', kind: 'stale-file-read', platform: 'win32' },
  { id: 'native-inode-rebind-observes-next-change', kind: 'file-branches', platform: 'native', branch: 'inode' },
  { id: 'shared-native-inode-direct-file', kind: 'shared-inode', platform: 'native', branch: 'inode' },
  { id: 'polling-file-events-and-exact-stop', kind: 'file-branches', platform: 'native', branch: 'polling' },
  { id: 'synchronous-add-cancel-preserves-shared-owner', kind: 'file-branches', platform: 'native', branch: 'sync-add-cancel' },
  { id: 'shared-native-inode-late-sibling-enoent', kind: 'shared-inode-late-error', platform: 'native', branch: 'inode' },
  { id: 'shared-native-inode-survivor-after-close', kind: 'shared-inode-survivor', platform: 'native', branch: 'inode' },
]

export function nonApplicableReason(scenario, nativePlatform) {
  if (scenario.branch === 'inode' && !['darwin', 'linux', 'freebsd'].includes(nativePlatform)) {
    return `Native inode rebinding is not applicable on ${nativePlatform}; this branch requires darwin, linux, or freebsd.`
  }
}
