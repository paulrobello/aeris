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
- Added Flight Program 05: a local User slot with explicit save/overwrite status and full simulation, visual, camera, environment, pointer, and time-setting restore across reloads.

## 2026-07-12 multi-flock enhancement

- Request: add options to specify number of flocks, make separate flocks avoid each other with a new avoidance-strength slider, and give separate flocks separate colors.
- Grounded the request in the current simulation, rendering, and controls/configuration seams.
- Added deterministic, balanced flock assignment with same-flock flocking forces and independently tunable cross-flock avoidance.
- Added persisted `Flock count` and `Flock avoidance` sliders with backward-compatible migration for existing saved configurations.
- Added stable per-flock hue rotation across boids, trails, and proximity links while preserving the original single-flock theme shaders.
- `make checkall` passes: formatting, lint, TypeScript, 17 unit tests, production build, and two SSR tests.
- Chrome QA passed at eight flocks with maximum avoidance: controls and text diagnostics agree, distinct flock colors render correctly, and no new console errors were recorded.
- The deterministic Playwright game loop completed two interaction/capture iterations with no error artifacts and confirmed the original single-flock appearance remains intact.

## TODO

- Predator enhancement completed 2026-07-12: added an optional persisted Predator switch, deterministic 10–30 second target cycles, immediate catch/timeout retargeting, swept catch detection, boid avoidance, and temporary escape-speed boosting without removing or harming caught boids.
- Added a distinct forward-aligned red-orange hunter with a bright core, energy ring, and fading afterimages, plus text diagnostics for its target, countdown, catches, and boosting boids.
- `make checkall` passes with 28 unit tests and two SSR tests. Chrome QA verified enable/disable, reload persistence, timeout retargeting, two live catches with all 620 boids preserved, active escape boosts, and no new console errors. The required Playwright game loop also enabled the switch and completed two capture iterations without error artifacts.
