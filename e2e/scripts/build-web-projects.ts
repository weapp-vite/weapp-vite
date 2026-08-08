/* eslint-disable e18e/ban-dependencies -- Web 构建矩阵需要 execa 提供跨平台子进程结果与合并输出。 */
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { discoverWebProjects } from '../../scripts/web-project-matrix'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const CLI_PATH = fileURLToPath(new URL('../../packages/weapp-vite/dist/cli.mjs', import.meta.url))
const EXPECTED_ERROR_PATTERN = /withDefaults|defineProps|编译|compile/i

interface BuildFailure {
  project: string
  output: string
}

async function buildProject(project: Awaited<ReturnType<typeof discoverWebProjects>>[number]) {
  const result = await execa(
    process.execPath,
    [CLI_PATH, 'build', project.root, '--platform', 'web'],
    {
      all: true,
      cwd: ROOT,
      reject: false,
    },
  )
  const output = result.all ?? ''

  if (project.expectation === 'startup-error') {
    if (result.exitCode !== 0 && EXPECTED_ERROR_PATTERN.test(output)) {
      console.log(`✓ ${project.relativeRoot} (expected startup error)`)
      return undefined
    }
    return {
      project: project.relativeRoot,
      output: `Expected a compile error, received exit code ${result.exitCode}.\n${output}`,
    }
  }

  if (result.exitCode === 0) {
    console.log(`✓ ${project.relativeRoot}`)
    return undefined
  }
  return {
    project: project.relativeRoot,
    output,
  }
}

async function main() {
  const projects = await discoverWebProjects(ROOT)
  const failures: BuildFailure[] = []
  for (const project of projects) {
    const failure = await buildProject(project)
    if (failure) {
      failures.push(failure)
      console.error(`✗ ${project.relativeRoot}`)
    }
  }

  if (failures.length === 0) {
    console.log(`Web project build matrix passed (${projects.length} projects).`)
    return
  }

  const details = failures
    .map(({ project, output }) => `\n[${project}]\n${output}`)
    .join('\n')
  throw new Error(`Web project build matrix failed (${failures.length}/${projects.length}).${details}`)
}

await main()
