import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertBuildExists } from './check-build.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distMain = path.resolve(__dirname, '..', 'dist', 'main.js');

assertBuildExists(distMain);

const { bootstrap } = await import(pathToFileURL(distMain).href);

try {
  await bootstrap();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Erro técnico ao iniciar a API.');
  process.exit(1);
}
