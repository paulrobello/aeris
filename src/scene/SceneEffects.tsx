import {
  Bloom,
  EffectComposer,
  Noise,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

import type { QualityMode } from "@/src/core/types";

interface SceneEffectsProps {
  bloom: number;
  glow: number;
  motionBlur: number;
  quality: QualityMode;
}

export function SceneEffects({
  bloom,
  glow,
  motionBlur,
  quality,
}: SceneEffectsProps) {
  const multisampling =
    quality === "cinematic" ? 4 : quality === "balanced" ? 2 : 0;

  return (
    <EffectComposer multisampling={multisampling} enableNormalPass={false}>
      <Bloom
        intensity={bloom * (0.88 + glow * 0.18)}
        luminanceThreshold={0.18}
        luminanceSmoothing={0.72}
        mipmapBlur
        radius={0.58 + motionBlur * 0.2}
      />
      <Noise
        premultiply
        blendFunction={BlendFunction.SOFT_LIGHT}
        opacity={
          quality === "performance"
            ? 0
            : quality === "cinematic"
              ? 0.045
              : 0.025
        }
      />
      <Vignette
        eskil={false}
        offset={0.12}
        darkness={quality === "cinematic" ? 0.72 : 0.62}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
}
