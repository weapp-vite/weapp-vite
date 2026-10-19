export const nativeInstanceDefaultsSource = `
const nativeInitialDefinitions = new Map();
const pendingNativeDefaults = new WeakMap();
const initializedNativeInstances = new WeakSet();
function initializeNativeInstanceDefaults(instance, moduleId, render, lifecycleOwned = false) {
  invalidateDevtoolsTemplatePlaceholders();
  if (suppressLifecycles || wevuRefreshes.has(moduleId)) return;
  let pending = pendingNativeDefaults.get(instance);
  const initialized = lifecycleOwned ? initializedNativeInstances.has(instance) : instanceSnapshots.has(instance);
  if (!pending && !initialized) {
    // 生命周期创建状态独立于快照；普通方法和宿主 facade 不能决定是否初始化默认值。
    if (lifecycleOwned) initializedNativeInstances.add(instance);
    const initial = nativeInitialDefinitions.get(moduleId);
    const latest = definitions.get(moduleId);
    if (!initial || !latest || initial === latest) return;
    const initialData = initial.data || {};
    const latestData = latest.data || {};
    const properties = latest.properties || {};
    pending = new Set();
    const data = instance.data || (instance.data = {});
    for (const key of new Set([...Object.keys(initialData), ...Object.keys(latestData)])) {
      // 宿主的 instance.properties 可镜像全部 data，仅声明的 properties 表示父级输入。
      if (Object.prototype.hasOwnProperty.call(properties, key)) continue;
      if (Object.prototype.hasOwnProperty.call(latestData, key)) {
        data[key] = cloneInstanceData(latestData[key]);
      } else {
        delete data[key];
      }
      pending.add(key);
    }
    pendingNativeDefaults.set(instance, pending);
  }
  if (!render || !pending) return;
  pendingNativeDefaults.delete(instance);
  const payload = {};
  for (const key of pending) {
    payload[key] = Object.prototype.hasOwnProperty.call(instance.data, key)
      ? cloneInstanceData(instance.data[key])
      : null;
  }
  if (pending.size > 0 && typeof instance.setData === 'function') instance.setData(payload);
}
`
