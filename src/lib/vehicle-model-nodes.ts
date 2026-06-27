/** Named nodes in public/mdls/modelX.dae — used for door / panel animation */
export const MODEL_X_NODES = {
  hood: 'X_hood',
  tailgate: 'X_tailgate',
  doorFL: 'X_door_FL',
  doorFR: 'X_door_FR',
  doorRL: 'X_door_RL',
  doorRR: 'X_door_RR',
  doorglassFL: 'X_doorglass_FL',
  doorglassFR: 'X_doorglass_FR',
  doorglassRL: 'X_doorglass_RL',
  doorglassRR: 'X_doorglass_RR',
} as const;

/** Door open state — wire to Tesla vehicle_state when API fields are available */
export interface VehicleDoorPose {
  hood?: boolean;
  tailgate?: boolean;
  doorFL?: boolean;
  doorFR?: boolean;
  doorRL?: boolean;
  doorRR?: boolean;
}

/** Resting rotation offsets (radians) when a panel is open — tune per mesh */
export const MODEL_X_OPEN_ANGLES: Record<keyof typeof MODEL_X_NODES, { axis: 'x' | 'y' | 'z'; angle: number }> = {
  hood: { axis: 'x', angle: -0.55 },
  tailgate: { axis: 'x', angle: 0.75 },
  doorFL: { axis: 'y', angle: 0.65 },
  doorFR: { axis: 'y', angle: -0.65 },
  doorRL: { axis: 'x', angle: 1.1 },
  doorRR: { axis: 'x', angle: 1.1 },
  doorglassFL: { axis: 'y', angle: 0.65 },
  doorglassFR: { axis: 'y', angle: -0.65 },
  doorglassRL: { axis: 'x', angle: 1.1 },
  doorglassRR: { axis: 'x', angle: 1.1 },
};

export const DOOR_POSE_TO_NODES: Record<keyof VehicleDoorPose, (keyof typeof MODEL_X_NODES)[]> = {
  hood: ['hood'],
  tailgate: ['tailgate'],
  doorFL: ['doorFL', 'doorglassFL'],
  doorFR: ['doorFR', 'doorglassFR'],
  doorRL: ['doorRL', 'doorglassRL'],
  doorRR: ['doorRR', 'doorglassRR'],
};
