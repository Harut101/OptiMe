import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'assets', 'body-map');
const component = await readFile(path.join(root, 'src', 'features', 'body-map', 'BodyMapSelector.tsx'), 'utf8');
const assetConfig = await readFile(path.join(root, 'src', 'features', 'body-map', 'body-map-assets.ts'), 'utf8');
const selection = await readFile(path.join(root, 'src', 'features', 'body-map', 'body-map-selection.ts'), 'utf8');
const generated = await readFile(path.join(root, 'src', 'features', 'body-map', 'body-map-paths.generated.ts'), 'utf8');
const broadGroups = new Set(['ARMS', 'BACK', 'CORE', 'LEGS', 'FULL_BODY']);
const supportedSpecificGroups = new Set([
  'CHEST', 'TRAPS', 'LATS', 'LOWER_BACK', 'ABS', 'OBLIQUES', 'BICEPS', 'TRICEPS',
  'FOREARMS', 'QUADRICEPS', 'HAMSTRINGS', 'ADDUCTORS', 'ABDUCTORS', 'CALVES',
  'GLUTES', 'SHOULDERS'
]);
const allRegions = [];

for (const [view, expectedCount] of Object.entries({ front: 25, back: 18 })) {
  const source = await readFile(path.join(assets, `${view}.svg`), 'utf8');
  const overlay = await readFile(path.join(assets, `${view}.overlay.svg`), 'utf8');
  const png = await readFile(path.join(assets, `${view}.png`));
  const sourcePaths = [...source.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map((match) => match[1]);
  const overlayPaths = [...overlay.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map((match) => match[1]);
  const regions = [...overlay.matchAll(/<path\b[^>]*\bid="([^"]+)"[^>]*data-muscle="([^"]+)"[^>]*data-side="([^"]+)"/g)]
    .map((match) => ({ id: match[1], muscleGroup: match[2], side: match[3] }));
  allRegions.push(...regions);

  if (!source.includes('viewBox="0 0 600 1220"') || !overlay.includes('viewBox="0 0 600 1220"')) throw new Error(`${view}: invalid viewBox.`);
  if (png.readUInt32BE(16) !== 600 || png.readUInt32BE(20) !== 1220) throw new Error(`${view}: PNG must be 600 x 1220.`);
  if (sourcePaths.length !== expectedCount || overlayPaths.length !== expectedCount) throw new Error(`${view}: expected ${expectedCount} paths.`);
  if (sourcePaths.some((item, index) => item !== overlayPaths[index])) throw new Error(`${view}: path geometry changed.`);
  if (/fill="red"|mix-blend-mode|<image\b|<text\b/i.test(overlay)) throw new Error(`${view}: presentation content found.`);

  for (const attribute of ['id', 'data-muscle', 'data-label', 'data-side']) {
    if ([...overlay.matchAll(new RegExp(`\\b${attribute}=`, 'g'))].length !== expectedCount) throw new Error(`${view}: missing ${attribute}.`);
  }
}

const ids = allRegions.map((region) => region.id);
if (new Set(ids).size !== ids.length) throw new Error('Body map contains duplicate region IDs.');
for (const region of allRegions) {
  if (broadGroups.has(region.muscleGroup)) throw new Error(`${region.id}: broad group ${region.muscleGroup} is forbidden.`);
  if (!supportedSpecificGroups.has(region.muscleGroup)) throw new Error(`${region.id}: unsupported group ${region.muscleGroup}.`);
  if (region.side === 'left') {
    const opposite = allRegions.find((candidate) => candidate.id === region.id.replace(/_left$/, '_right'));
    if (!opposite || opposite.muscleGroup !== region.muscleGroup) throw new Error(`${region.id}: bilateral mapping mismatch.`);
  }
}

const expectedMappings = {
  front_biceps_left: 'BICEPS',
  front_obliques_left: 'OBLIQUES',
  front_quadriceps_left: 'QUADRICEPS',
  front_adductors_left: 'ADDUCTORS',
  front_abductors_left: 'ABDUCTORS',
  back_triceps_left: 'TRICEPS',
  back_lower_back_center: 'LOWER_BACK',
  back_glutes_left: 'GLUTES',
  back_hamstrings_left: 'HAMSTRINGS',
  back_calves_left: 'CALVES'
};
for (const [id, muscleGroup] of Object.entries(expectedMappings)) {
  if (!allRegions.some((region) => region.id === id && region.muscleGroup === muscleGroup)) throw new Error(`${id}: expected ${muscleGroup}.`);
}

const generatedIds = [...generated.matchAll(/"id": "([^"]+)"/g)].map((match) => match[1]);
if (generatedIds.length !== ids.length || generatedIds.some((id) => !ids.includes(id))) throw new Error('Generated path IDs and SVG IDs differ.');

if (!component.includes('Image as SvgImage') || component.includes("import { Image,")) throw new Error('PNG and paths must render in one Svg root.');
if (!component.includes("const BODY_MAP_SELECTED_COLOR = '#FF2D55'")) throw new Error('Selected paths must use the body-map red.');
if (component.includes('fill={colors.primary}')) throw new Error('Selected paths must not use product green.');
if (!component.includes("fill={selected || pressed ? BODY_MAP_SELECTED_COLOR : 'transparent'}")) throw new Error('Unselected paths must be transparent.');
if (!component.includes('toggleSpecificMuscleGroup(selectedMuscles, muscleGroup)')) throw new Error('Body map must toggle one specific group.');
if (!component.includes('strokeWidth={8}') || !component.includes('pointerEvents="none"')) throw new Error('Hit and visual paths must be separate.');
if (/<G[^>]+onPress=/.test(component)) throw new Error('Parent groups must not process selection.');
if (!component.includes('viewBox={asset.viewBox}')) throw new Error('SVG must use the active asset viewBox.');
if (!component.includes('href={asset.image}') || !component.includes('width={asset.width}') || !component.includes('height={asset.height}')) throw new Error('SvgImage must use active asset dimensions.');
if ((assetConfig.match(/width: 600/g) ?? []).length !== 2 || (assetConfig.match(/height: 1220/g) ?? []).length !== 2) throw new Error('Front/back asset dimensions are missing.');
if (/translate[XY]?|scale[XY]?|resizeMode="cover"/.test(component)) throw new Error('Body map contains a prohibited sizing transform.');
if (!component.includes('const BODY_MAP_CARD_ASPECT_RATIO = 4 / 5')) throw new Error('Outer card must use a 4:5 aspect ratio.');
if (!component.includes('const BODY_MAP_CARD_MAX_WIDTH = 360')) throw new Error('Outer card max width must be 360.');
if (!component.includes('screenWidth - HORIZONTAL_PAGE_PADDING * 2')) throw new Error('Outer card must respect horizontal screen padding.');
if (!component.includes('width: cardWidth, aspectRatio: BODY_MAP_CARD_ASPECT_RATIO')) throw new Error('Outer card must own fixed responsive dimensions.');
if (!component.includes('availableMapWidth / asset.width') || !component.includes('availableMapHeight / asset.height')) throw new Error('Inner stage must use contain scaling.');
if (!component.includes('width: renderedMapWidth, height: renderedMapHeight')) throw new Error('PNG and paths must share the contained inner stage.');
for (const legacy of ['ARMS', 'BACK', 'CORE', 'LEGS', 'FULL_BODY']) {
  if (!selection.includes(`${legacy}:`)) throw new Error(`Missing legacy expansion for ${legacy}.`);
}

console.log('Body-map geometry and metadata validation passed.');
