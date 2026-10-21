import { WEAPP_VITE_STATEFUL_HMR_REGISTRATION_CONTRACT_VERSION, WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE } from '@weapp-core/constants'

/** 原生注册只发生一次，新增宿主入口和属性契约必须交给 classic 重新注册。 */
export const nativeRegistrationSource = `
const nativeRegistrationShapes = new Map();
const nativeRegistrationIdentities = new WeakMap();
const nativeRegistrationSymbols = new Map();
let nextNativeRegistrationIdentity = 0;
function nativeRegistrationIdentity(value) {
  const identities = typeof value === 'symbol' ? nativeRegistrationSymbols : nativeRegistrationIdentities;
  if (!identities.has(value)) identities.set(value, ++nextNativeRegistrationIdentity);
  return identities.get(value);
}
function nativeRegistrationOpaque(value) {
  if ((value && typeof value === 'object') || typeof value === 'function' || typeof value === 'symbol') {
    return ['identity', nativeRegistrationIdentity(value)];
  }
  return nativeRegistrationValue(value);
}
function nativeRegistrationValue(value, relation = false, active = new Set()) {
  if (typeof value === 'function' || typeof value === 'symbol') return nativeRegistrationOpaque(value);
  if (typeof value === 'bigint') return ['bigint', String(value)];
  if (value === undefined) return ['undefined'];
  if (!value || typeof value !== 'object') return value;
  if (Object.prototype.toString.call(value) === '[object RegExp]') return ['regexp', String(value)];
  if (active.has(value)) return nativeRegistrationOpaque(value);
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype && Object.getPrototypeOf(prototype) !== null) return nativeRegistrationOpaque(value);
  active.add(value);
  let result;
  if (Array.isArray(value)) result = value.map(item => nativeRegistrationValue(item, relation, active));
  else {
    result = Object.create(null);
    for (const key of Object.keys(value).sort()) {
      result[key] = relation && key === 'target'
        ? nativeRegistrationOpaque(value[key])
        : nativeRegistrationValue(value[key], relation, active);
    }
  }
  active.delete(value);
  return result;
}
function unsupportedNativeRegistration(message) {
  const error = new Error(message);
  error.code = ${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE)};
  return error;
}
function assertNativeRegistrationShape(moduleId, definition, wevuContract) {
  if (wevuContract && wevuContract.version !== ${WEAPP_VITE_STATEFUL_HMR_REGISTRATION_CONTRACT_VERSION}) {
    throw unsupportedNativeRegistration('Wevu registration contract is unavailable; classic rebuild is required.');
  }
  const keys = value => Object.keys(value || {}).sort();
  const slots = value => keys(value).map(key => [key, typeof value[key]]);
  const shape = JSON.stringify({
    entrypoints: keys(definition).filter(key => typeof definition[key] === 'function'),
    methods: slots(definition.methods),
    lifetimes: slots(definition.lifetimes),
    pageLifetimes: slots(definition.pageLifetimes),
    observers: wevuContract ? slots(definition.observers) : nativeRegistrationValue(definition.observers),
    properties: nativeRegistrationValue(definition.properties),
    options: nativeRegistrationValue(definition.options),
    externalClasses: nativeRegistrationValue(definition.externalClasses),
    relations: nativeRegistrationValue(definition.relations, true),
    behaviors: Array.isArray(definition.behaviors) ? definition.behaviors.map(nativeRegistrationOpaque) : nativeRegistrationOpaque(definition.behaviors),
    definitionFilter: nativeRegistrationValue(definition.definitionFilter),
    export: nativeRegistrationValue(wevuContract ? wevuContract.userExport : definition.export),
    wevuContract: nativeRegistrationValue(wevuContract),
  });
  const previous = nativeRegistrationShapes.get(moduleId);
  if (runtime.applyingPatch && previous !== undefined && previous !== shape) {
    throw unsupportedNativeRegistration('Native registration shape changed; classic rebuild is required.');
  }
  nativeRegistrationShapes.set(moduleId, shape);
}
`
