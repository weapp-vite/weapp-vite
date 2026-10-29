import process from 'node:process'
import { verifyCommitMsg } from 'repoctl'

const editFile = process.env.WEAPP_VITE_GIT_COMMIT_MESSAGE_FILE
if (!editFile) {
  throw new Error('Use the native Git commit-msg hook so the original message file argument is preserved.')
}

await verifyCommitMsg({ cwd: process.cwd(), editFile })
