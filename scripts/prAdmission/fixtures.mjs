import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stringify } from 'yaml'
import { readLocalAdmission } from './local.mjs'

const baseline = await readLocalAdmission(fileURLToPath(new URL('../../', import.meta.url)))

export const localFixture = () => structuredClone(baseline)

export function liveFixture() {
  const { policy } = localFixture()
  const environment = {
    name: policy.environment,
    can_admins_bypass: policy.canAdminsBypass,
    deployment_branch_policy: policy.deploymentBranchPolicy,
    protection_rules: [{
      type: 'required_reviewers',
      prevent_self_review: policy.preventSelfReview,
      reviewers: policy.reviewers.map(login => ({ type: 'User', reviewer: { login } })),
    }],
  }
  return { policy, environment, fork: { approval_policy: policy.forkApprovalPolicy } }
}

export async function writeLocalFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'pr-admission-'))
  const github = path.join(root, '.github')
  await mkdir(path.join(github, 'workflows'), { recursive: true })
  const { policy, profiles, workflows } = localFixture()
  await writeFile(path.join(github, 'pr-admission.json'), JSON.stringify(policy))
  await writeFile(path.join(github, 'pr-checks.json'), JSON.stringify(profiles))
  for (const [name, workflow] of Object.entries(workflows)) {
    await writeFile(path.join(github, 'workflows', name), stringify(workflow))
  }
  return root
}
