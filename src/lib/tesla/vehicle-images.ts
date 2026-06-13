import type { VehicleConfig } from '@/lib/tesla/types';

const MODEL_PLACEHOLDERS: Record<string, string> = {
  model3: '/imgs/product-model3-placeholder.png',
  modely: '/imgs/product-modely-placeholder.png',
  models: '/imgs/product-models-placeholder.png',
  modelx: '/imgs/product-modelx-placeholder.png',
  cybertruck: '/imgs/product-cybertruck-placeholder.png',
  poppyseed: '/imgs/product-poppyseed-placeholder.png',
};

const COLOR_TOP_VIEWS: Record<string, string> = {
  black: '/imgs/vehicle-top-black.png',
  white: '/imgs/vehicle-top-white.png',
  red: '/imgs/vehicle-top-red.png',
  blue: '/imgs/vehicle-top-blue.png',
  silver: '/imgs/vehicle-top-silver.png',
};

function normalizeModel(config?: VehicleConfig): string {
  const carType = (config?.car_type ?? config?.model ?? '').toLowerCase();
  if (carType.includes('cybertruck')) return 'cybertruck';
  if (carType.includes('model3') || carType === 'm3') return 'model3';
  if (carType.includes('modely') || carType === 'my') {
    if (carType.includes('nv36') || carType.includes('juniper')) {
      return 'modely-nv36';
    }
    return 'modely';
  }
  if (carType.includes('models') || carType === 'ms') return 'models';
  if (carType.includes('modelx') || carType === 'mx') return 'modelx';
  if (carType.includes('poppyseed')) return 'poppyseed';
  return 'unknown';
}

export function getVehiclePlaceholder(config?: VehicleConfig, charging = false): string {
  if (charging) {
    const model = normalizeModel(config);
    if (model === 'model3' || model === 'models') {
      return '/imgs/model_3_s_charging.png';
    }
  }

  const model = normalizeModel(config);
  if (model === 'modely-nv36') {
    return '/imgs/product-modely-nv36-placeholder.png';
  }

  return MODEL_PLACEHOLDERS[model] ?? '/imgs/product-nontesla-placeholder.png';
}

export function getTopDownImage(config?: VehicleConfig): string {
  const model = normalizeModel(config);
  if (model === 'cybertruck') {
    return '/imgs/vehicle-top-CT.png';
  }

  const color = (config?.exterior_color ?? '').toLowerCase();
  for (const [key, path] of Object.entries(COLOR_TOP_VIEWS)) {
    if (color.includes(key)) return path;
  }

  return '/imgs/tesla-top-down.png';
}

export function getMapMarker(online: boolean, config?: VehicleConfig): string {
  const model = normalizeModel(config);
  if (model === 'cybertruck') {
    return online
      ? '/imgs/cybertruck/vehicle_mapmarker_online.png'
      : '/imgs/cybertruck/vehicle_mapmarker_stale.png';
  }
  return online ? '/imgs/vehicle_mapmarker_online.png' : '/imgs/vehicle_mapmarker_stale.png';
}
