import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';

const certPath = process.env.PLANNER_FIN_HTTPS_CERT ?? '.tools/certs/planner-fin-local.pem';
const keyPath = process.env.PLANNER_FIN_HTTPS_KEY ?? '.tools/certs/planner-fin-local-key.pem';
const targetHost = process.env.PLANNER_FIN_PROXY_TARGET_HOST ?? '127.0.0.1';
const targetPort = Number(process.env.PLANNER_FIN_PROXY_TARGET_PORT ?? '3000');
const listenHost = process.env.PLANNER_FIN_PROXY_HOST ?? '0.0.0.0';
const listenPort = Number(process.env.PLANNER_FIN_PROXY_PORT ?? '3443');

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  throw new Error(
    `Certificado local nao encontrado. Gere ${certPath} e ${keyPath} com mkcert ou ferramenta equivalente.`,
  );
}

const hopByHop = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

https
  .createServer(
    {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    },
    (clientReq, clientRes) => {
      const headers = { ...clientReq.headers, host: `${targetHost}:${targetPort}` };
      for (const header of Object.keys(headers)) {
        if (hopByHop.has(header.toLowerCase())) delete headers[header];
      }

      const proxyReq = http.request(
        {
          host: targetHost,
          port: targetPort,
          method: clientReq.method,
          path: clientReq.url,
          headers,
        },
        (proxyRes) => {
          clientRes.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
          proxyRes.pipe(clientRes);
        },
      );

      proxyReq.on('error', () => {
        clientRes.writeHead(502, { 'content-type': 'application/json' });
        clientRes.end(JSON.stringify({ code: 'HTTPS_PROXY_ERROR' }));
      });

      clientReq.pipe(proxyReq);
    },
  )
  .listen(listenPort, listenHost, () => {
    console.log(`Proxy HTTPS PlannerFin ativo em https://${listenHost}:${listenPort}`);
  });
