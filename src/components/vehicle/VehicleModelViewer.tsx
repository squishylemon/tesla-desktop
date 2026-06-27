import { useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import type { VehicleDoorPose } from '@/lib/vehicle-model-nodes';
import {
  DOOR_POSE_TO_NODES,
  MODEL_X_NODES,
  MODEL_X_OPEN_ANGLES,
} from '@/lib/vehicle-model-nodes';

interface Props {
  modelPath: string;
  modelKey: string;
  doorPose?: VehicleDoorPose;
  className?: string;
}

type RestPose = { x: number; y: number; z: number };

function applyDoorPose(
  nodes: Map<string, THREE.Object3D>,
  modelKey: string,
  doorPose?: VehicleDoorPose,
) {
  if (modelKey !== 'modelx') return;

  for (const [poseKey, nodeKeys] of Object.entries(DOOR_POSE_TO_NODES) as [
    keyof VehicleDoorPose,
    (keyof typeof MODEL_X_NODES)[],
  ][]) {
    const open = doorPose?.[poseKey] ?? false;

    for (const nodeKey of nodeKeys) {
      const nodeName = MODEL_X_NODES[nodeKey];
      const node = nodes.get(nodeName);
      if (!node) continue;

      const rest = node.userData.restRotation as RestPose | undefined;
      if (!rest) continue;

      const spec = MODEL_X_OPEN_ANGLES[nodeKey];
      node.rotation.x = rest.x;
      node.rotation.y = rest.y;
      node.rotation.z = rest.z;

      if (open) {
        node.rotation[spec.axis] += spec.angle;
      }
    }
  }
}

export default function VehicleModelViewer({ modelPath, modelKey, doorPose, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const doorNodesRef = useRef(new Map<string, THREE.Object3D>());
  const renderRef = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let modelRoot: THREE.Object3D | null = null;
    const doorNodes = doorNodesRef.current;
    doorNodes.clear();

    const render = () => {
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    };
    renderRef.current = render;

    const resize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      render();
    };

    (async () => {
      try {
        const THREE = await import('three');
        const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js');

        if (disposed) return;

        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera(28, 1, 0.1, 500);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        container.appendChild(renderer.domElement);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1a22, 1.4));

        const key = new THREE.DirectionalLight(0xffffff, 1.8);
        key.position.set(6, 10, 8);
        scene.add(key);

        const fill = new THREE.DirectionalLight(0x8899bb, 0.45);
        fill.position.set(-8, 4, -6);
        scene.add(fill);

        const loader = new ColladaLoader();
        loader.load(
          modelPath,
          (collada) => {
            if (disposed || !scene || !camera || !renderer) return;

            modelRoot = collada.scene;
            modelRoot.traverse((child) => {
              if (!child.name) return;
              if (
                Object.values(MODEL_X_NODES).includes(
                  child.name as (typeof MODEL_X_NODES)[keyof typeof MODEL_X_NODES],
                )
              ) {
                doorNodes.set(child.name, child);
                child.userData.restRotation = {
                  x: child.rotation.x,
                  y: child.rotation.y,
                  z: child.rotation.z,
                };
              }
            });

            const box = new THREE.Box3().setFromObject(modelRoot);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            modelRoot.position.sub(center);
            modelRoot.position.y += size.y * 0.02;

            const maxDim = Math.max(size.x, size.y, size.z);
            const dist = maxDim * 1.35;
            camera.position.set(dist * 0.85, dist * 0.42, dist * 1.05);
            camera.lookAt(0, size.y * 0.12, 0);

            scene.add(modelRoot);
            applyDoorPose(doorNodes, modelKey, doorPose);
            resize();
            setStatus('ready');
          },
          undefined,
          () => {
            if (!disposed) setStatus('error');
          },
        );

        const observer = new ResizeObserver(resize);
        observer.observe(container);

        return () => observer.disconnect();
      } catch {
        if (!disposed) setStatus('error');
      }
    })();

    return () => {
      disposed = true;
      renderRef.current = null;
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
      if (modelRoot) {
        modelRoot.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.geometry?.dispose();
            const mat = mesh.material;
            if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
            else mat?.dispose();
          }
        });
      }
      doorNodes.clear();
    };
  }, [modelPath, modelKey]);

  useEffect(() => {
    if (status !== 'ready') return;
    applyDoorPose(doorNodesRef.current, modelKey, doorPose);
    renderRef.current?.();
  }, [doorPose, modelKey, status]);

  return (
    <div ref={containerRef} className={className ?? 'vehicle-model-viewport'}>
      {status === 'loading' && (
        <div className="vehicle-model-viewport__status">
          <img src="/imgs/mini_spinner.png" alt="" className="h-6 w-6 animate-spin opacity-60" />
        </div>
      )}
      {status === 'error' && (
        <div className="vehicle-model-viewport__status text-sm text-tesla-muted">3D model unavailable</div>
      )}
    </div>
  );
}
