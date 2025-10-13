import './level-one'

export async function load() {
  const mod = await import('./level-dynamic')
  return mod.dynamicValue
}

export default 'entry'
