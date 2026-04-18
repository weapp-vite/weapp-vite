import process from 'node:process'

import {
  launchPreparedVscodeScenario,
  prepareVscodeScenario,
  resolveScenarioIds,
} from './vscode-e2e-shared'

async function main() {
  const scenarioArgument = process.argv[2]

  if (!scenarioArgument || scenarioArgument === 'all') {
    throw new Error('launch-vsix-vscode 只支持单个场景，请传入 standalone 或 vue-official')
  }

  const [scenarioId] = resolveScenarioIds(scenarioArgument)
  const prepared = await prepareVscodeScenario(scenarioId)
  await launchPreparedVscodeScenario(prepared)
}

void main()
