# Interactive body map

## Application placement

The accepted Body Map is used inside the shared `TrainingSetupForm`, available from standalone Training and the optional training onboarding step. Food and Profile do not own target-muscle selection.

Sprint 8B Batch 1 does not alter SVG geometry, PNG/SVG alignment, path mappings, bilateral selection, legacy broad-group expansion, the outer `4 / 5` card ratio, or selected color `#FF2D55`.

The target-muscle progressive prompt uses matched front and back PNG/SVG assets. Each image and SVG uses the same `600 x 1220` coordinate space. Runtime rendering applies no scale, translation, or calibration transform between the image and its paths.

Source assets live in `apps/mobile/assets/body-map`. Run `pnpm --filter @optime/mobile body-map:generate` after replacing an SVG. The generator preserves every source path's `d` value and creates stable interaction IDs and metadata. Run `pnpm --filter @optime/mobile body-map:validate` to confirm geometry identity and the coordinate contract.

The PNG is rendered with `SvgImage` inside the same `react-native-svg` root as the interactive paths. This gives both layers one viewport, one `viewBox`, and one native scaling pipeline. The responsive outer card uses a fixed 4:5 portrait ratio with a maximum width of 360 points. Inside it, the body-map stage is centered and sized with contain math from the active asset dimensions, preserving the complete anatomy and its original aspect ratio.

The overlay is transparent by default. Selected groups use `#FF2D55` at 50% opacity and pressed paths use 25%. The optional development-only `debugBodyMapLayout` prop shows the shared viewport border and measured size without tinting any muscle.

Each path maps to one specific `TargetMuscleGroup`. Left and right path IDs share the same group, so bilateral highlighting comes from business state rather than stored SVG IDs. Exact groups include `BICEPS`, `TRICEPS`, `FOREARMS`, `ABS`, `OBLIQUES`, `QUADRICEPS`, `ADDUCTORS`, `ABDUCTORS`, `HAMSTRINGS`, `CALVES`, `TRAPS`, `LATS`, and `LOWER_BACK`.

Legacy `ARMS`, `BACK`, `CORE`, `LEGS`, and `FULL_BODY` values remain valid for old records. `BodyMapSelector` expands them once when initializing its display state, but taps and saves produce only specific groups. Parent SVG groups have no handlers. Each region has one modest 8-unit transparent hit path and one noninteractive visual path.

The selector changes only the existing progressive target-muscle prompt; Today plan content and Plan Details remain unchanged.
