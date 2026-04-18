import path from 'node:path'
import process from 'node:process'

import {
  getScenarioRunnerEnv,
  prepareVscodeScenario,
  resolveScenarioIds,
  resolveVscodeTestElectron,
} from './vscode-e2e-shared'

async function main() {
  const extensionRoot = path.resolve(process.cwd())
  const runnerPath = path.join(extensionRoot, 'scripts', 'vsix-e2e-runner.cjs')
  const { runTests } = await resolveVscodeTestElectron()

  for (const scenarioId of resolveScenarioIds(process.argv[2])) {
    const prepared = await prepareVscodeScenario(scenarioId)

    try {
      await runTests({
        vscodeExecutablePath: prepared.vscodeExecutablePath,
        extensionDevelopmentPath: prepared.harnessPath,
        extensionTestsPath: runnerPath,
        extensionTestsEnv: getScenarioRunnerEnv(scenarioId),
        launchArgs: [
          prepared.fixturePath,
          `--extensions-dir=${prepared.extensionsDir}`,
          `--user-data-dir=${prepared.userDataDir}`,
          '--skip-welcome',
          '--skip-release-notes',
        ],
      })
    }
    finally {
      await prepared.cleanup()
    }
  }
}

void main()
