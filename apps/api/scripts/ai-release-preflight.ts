import { buildAiReleasePreflight } from '../src/config/ai-release-preflight';

try {
  console.log(JSON.stringify(buildAiReleasePreflight(process.env), null, 2));
} catch (error: unknown) {
  console.error(
    `AI release preflight failed: ${
      error instanceof Error ? error.message : 'unknown configuration error'
    }`,
  );
  process.exitCode = 1;
}
