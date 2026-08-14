import { existsSync } from 'node:fs';

export function assertBuildExists(distMainPath) {
  if (!existsSync(distMainPath)) {
    throw new Error(
      `Build de produção ausente: ${distMainPath} não existe. Rode "pnpm --filter @planner-fin/api build" antes de start:prod.`,
    );
  }
}
