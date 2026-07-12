Original prompt: create me a threejs web app boid simulator, it should be highly configurable / tunable with next gen graphics, highly polished dark mode ui, shaders for amazing boid / trails, multiple camera modes, multiple environments. I want peoples minds to be blown away, you need to bring your AAA game on, make me proud

## Product direction

- Build a scene-first cinematic flock laboratory named AERIS.
- Keep all controls live and meaningful: flock behavior, time, pointer force, visuals, cameras, environments, quality, and presets.
- Favor GPU instancing and shader-driven effects while keeping the simulation deterministic and testable.
- Required automation seam: `window.render_game_to_text()` and `window.advanceTime(ms)`.

## Progress

- Initialized the Sites-compatible vinext scaffold and reserved port 4203.
- Confirmed dependency compatibility and pinned a valid Three.js/postprocessing stack.
- Added shared simulator types, defaults, presets, and Zustand state contracts.
- Implemented the deterministic spatial-hash boid engine with collision-safe buckets and six behavioral tests.
- Implemented instanced shader boids, additive trails, proximity links, four environments, four camera modes, post effects, and pointer interaction.
- Implemented the responsive AERIS control surface, telemetry, presets, accessibility, shortcuts, and browser automation hooks.
- Added a bespoke AERIS social card and derived application icon.
- `make checkall` passes: formatting, lint, TypeScript, six simulation tests, production build, and two SSR tests.
- Browser QA passed for desktop and mobile layouts, all presets, live sliders, pause determinism, camera/environment/pointer changes, cinema mode, and control visibility.
- Zero browser console errors; React Three Fiber currently emits one upstream `THREE.Clock` deprecation warning.
- Production dependency audit reports two moderate upstream Next.js/PostCSS advisories and no high or critical findings; the current Sites/vinext-pinned stack has no compatible patched upgrade yet.
- Fixed the hardware-only running-flock blackout by removing the unstable HDR bloom pass while preserving shader intensity, post-process noise/vignette, and additive trails.
- Replaced 1px trail lines with continuous tapered history ribbons, doubled the default visual thickness, and added a live trail-width control.
- Added validated versioned config import/export, automatic local-storage persistence, and a 2,400-boid tuning ceiling.
- Added a persistent cinema-mode exit button plus contextual help for flock, visual, camera, environment, and pointer controls.
- Cinematic quality is now the default; Chrome hardware QA holds 120 FPS at the default 620 boids and stays visually stable with 2,400 imported boids.
- The updated gate passes formatting, lint, TypeScript, nine unit tests, production build, and two SSR tests; import/export and reload persistence passed real Chrome automation.
- Removed ribbon seams and strobing with Catmull-Rom centerline interpolation, per-frame damped history, and temporally stabilized camera-facing vectors.
- Improved paused-state readability with a high-contrast glass panel, stronger type, and a prominent Resume action verified over a dense flock.

## TODO

- None for the requested first release.
