import VehicleModelViewer from '@/components/vehicle/VehicleModelViewer';
import type { VehicleDoorPose } from '@/lib/vehicle-model-nodes';
import {
  getVehicleModelKey,
  getVehicleModelPath,
  getVehiclePlaceholder,
} from '@/lib/tesla/vehicle-images';
import type { VehicleConfig } from '@/lib/tesla/types';

interface Props {
  config?: VehicleConfig;
  charging?: boolean;
  name: string;
  doorPose?: VehicleDoorPose;
}

export default function VehicleHero({ config, charging, name, doorPose }: Props) {
  const modelPath = getVehicleModelPath(config);
  const modelKey = getVehicleModelKey(config);

  if (modelPath) {
    return (
      <VehicleModelViewer
        modelPath={modelPath}
        modelKey={modelKey}
        doorPose={doorPose}
        className="vehicle-hero-viewport"
      />
    );
  }

  const image = getVehiclePlaceholder(config, charging);
  return (
    <div className="vehicle-hero-viewport vehicle-hero-viewport--image">
      <img src={image} alt={name} className="max-h-full max-w-full object-contain animate-float" />
    </div>
  );
}
