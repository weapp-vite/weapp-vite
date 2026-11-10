import process from 'node:process'
import { MANAGED_PROJECT_JOURNAL_ENV } from '../devtoolsProjectOwnership'
import { readOptionValue } from './automator-argv'

const LOGOUT_COMMANDS = new Set(['logout', 'log-out', 'signout', 'sign-out'])
const LOGOUT_FLAGS = new Set(['--logout', '--log-out', '--sign-out'])
const NESTED_LOGOUT_COMMANDS = new Set(['account', 'auth'])
const ACCOUNT_CACHE_TYPES = new Set(['all', 'auth', 'session'])

/** 在受管 IDE E2E 中阻止会清除用户账号状态的命令。 */
export function assertDevtoolsAccountStatePreserved(argv: readonly string[]) {
  if (!process.env[MANAGED_PROJECT_JOURNAL_ENV]?.trim()) {
    return
  }

  const command = argv[0]?.toLowerCase()
  const nestedCommand = argv[1]?.toLowerCase()
  const requestsLogout = Boolean(command && (
    LOGOUT_COMMANDS.has(command)
    || (NESTED_LOGOUT_COMMANDS.has(command) && LOGOUT_COMMANDS.has(nestedCommand ?? ''))
  )) || argv.some(token => LOGOUT_FLAGS.has(token.toLowerCase()))
  const cleanType = command === 'cache'
    ? readOptionValue(argv, '--clean', '-c')?.toLowerCase()
    : undefined
  if (!command || (!requestsLogout && !ACCOUNT_CACHE_TYPES.has(cleanType ?? ''))) {
    return
  }

  throw new Error('DEVTOOLS_ACCOUNT_STATE_PROTECTED: managed IDE E2E cannot log out or clear global auth/session data.')
}
