import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectFacts, diagnose, renderReport } from './doctor-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

try {
  const facts = collectFacts(root);
  console.log(renderReport(diagnose(facts)));
} catch (error) {
  console.error(`PlannerFin Environment Doctor não conseguiu concluir: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
