const API_BASE_URL = process.env.SMOKE_API_BASE_URL ?? 'http://127.0.0.1:3000/api';
const WEB_BASE_URL = process.env.SMOKE_WEB_BASE_URL ?? 'http://127.0.0.1:4000';

async function check(name, url, expectedStatus = 200) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    throw new Error(`${name} (${url}) falhou: requisição não completou (${message}).`);
  }
  if (response.status !== expectedStatus)
    throw new Error(
      `${name} (${url}) falhou: esperado status ${expectedStatus}, recebido ${response.status}.`,
    );
  return response;
}

async function main() {
  const results = [];

  await check('API liveness', `${API_BASE_URL}/health`);
  results.push('API liveness: ok');

  await check('API readiness', `${API_BASE_URL}/health/ready`);
  results.push('API readiness: ok (banco acessível)');

  await check('Web health', `${WEB_BASE_URL}/health`);
  results.push('Web health: ok');

  const rootResponse = await check('Web raiz (SPA)', `${WEB_BASE_URL}/`);
  const rootBody = await rootResponse.text();
  if (!rootBody.includes('<div id="app">') && !rootBody.toLowerCase().includes('<!doctype html>'))
    throw new Error('Web raiz não retornou um documento HTML da SPA.');
  results.push('Web raiz (SPA): ok');

  const deepRouteResponse = await check(
    'Web fallback SPA (rota profunda)',
    `${WEB_BASE_URL}/smoke-teste-rota-profunda`,
  );
  const deepRouteBody = await deepRouteResponse.text();
  if (deepRouteBody !== rootBody)
    throw new Error('Fallback SPA não retornou o mesmo index.html da raiz.');
  results.push('Web fallback SPA: ok');

  const missingAssetResponse = await fetch(`${WEB_BASE_URL}/assets/smoke-teste-inexistente.js`);
  if (missingAssetResponse.status !== 404)
    throw new Error('Asset inexistente sob /assets/ não retornou 404.');
  results.push('Web asset ausente -> 404: ok');

  console.log('Smoke de produção local: TODOS OS CHECKS PASSARAM.');
  results.forEach((line) => console.log(`  - ${line}`));
}

main().catch((error) => {
  console.error('Smoke de produção local FALHOU.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
