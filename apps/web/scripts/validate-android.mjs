import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');
const fail = (message) => {
  throw new Error(`android:validate: ${message}`);
};

const webPackage = JSON.parse(read('package.json'));
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(webPackage.version)) {
  fail('apps/web/package.json deve conter SemVer válido.');
}

const allowedCapacitor = new Set([
  '@capacitor/core',
  '@capacitor/cli',
  '@capacitor/android',
  '@capacitor/app',
]);
const capacitorDeps = [
  ...Object.keys(webPackage.dependencies ?? {}),
  ...Object.keys(webPackage.devDependencies ?? {}),
].filter((name) => name.startsWith('@capacitor/'));
const unexpected = capacitorDeps.filter((name) => !allowedCapacitor.has(name));
if (capacitorDeps.length !== allowedCapacitor.size || unexpected.length) {
  fail('somente os quatro pacotes Capacitor aprovados podem existir.');
}

const capConfig = read('capacitor.config.ts');
for (const expected of ["appId: 'com.plannerfin.app'", "appName: 'PlannerFin'", "webDir: 'dist'"]) {
  if (!capConfig.includes(expected)) fail(`capacitor.config.ts não contém ${expected}.`);
}
if (/server\s*:\s*\{|url\s*:/.test(capConfig)) {
  fail('capacitor.config.ts não pode conter server.url.');
}

const gradle = read('android/app/build.gradle');
if (!gradle.includes('versionName plannerFinVersionName')) {
  fail('versionName deve derivar de apps/web/package.json.');
}
if (!gradle.includes("new JsonSlurper().parse(file('../version.json'))")) {
  fail('versionCode deve derivar de apps/web/android/version.json.');
}

const versionFile = JSON.parse(read('android/version.json'));
const versionCode = versionFile.versionCode;
if (!Number.isInteger(versionCode) || versionCode < 1) {
  fail('android/version.json.versionCode deve ser inteiro positivo.');
}

const manifest = read('android/app/src/main/AndroidManifest.xml');
if (!manifest.includes('android.permission.INTERNET')) fail('Manifest deve conter INTERNET.');
if (!manifest.includes('android.permission.BIND_NOTIFICATION_LISTENER_SERVICE')) {
  fail('Manifest deve conter BIND_NOTIFICATION_LISTENER_SERVICE para a spike SPEC-022.');
}
if (!manifest.includes('android:allowBackup="false"'))
  fail('Backup Android deve estar desabilitado.');
if (/CAMERA|RECORD_AUDIO|LOCATION|CONTACTS|STORAGE|POST_NOTIFICATIONS|QUERY_ALL_PACKAGES/.test(manifest)) {
  fail('Manifest contém permissão sensível não aprovada.');
}
if (/<queries\b/.test(manifest)) {
  fail('Manifest não pode declarar queries amplas nesta spike.');
}
if (/usesCleartextTraffic\s*=\s*"true"/.test(manifest)) {
  fail('cleartext global em main/release é proibido.');
}

const debugNetwork = read('android/app/src/debug/res/xml/network_security_config.xml');
if (!debugNetwork.includes('localhost') || !debugNetwork.includes('10.0.2.2')) {
  fail('debug cleartext deve listar hosts explícitos.');
}

const gitignore = read('../../.gitignore');
for (const pattern of ['*.apk', '*.aab', '*.jks', '*.keystore', 'artifacts/']) {
  if (!gitignore.includes(pattern)) fail(`.gitignore deve conter ${pattern}.`);
}

function scan(dir, pattern, matches = []) {
  for (const entry of readdirSync(join(root, dir))) {
    const path = join(dir, entry);
    const full = join(root, path);
    const stat = statSync(full);
    if (stat.isDirectory()) scan(path, pattern, matches);
    else if (pattern.test(readFileSync(full, 'utf8'))) matches.push(path);
  }
  return matches;
}
const forbiddenStorageMatches = scan('src', /sessionStorage|indexedDB/);
if (forbiddenStorageMatches.length)
  fail(`storage JS proibido encontrado em ${forbiddenStorageMatches.join(', ')}.`);

const visualCacheAllowlist = new Set(['src/appearance.ts', 'src/appearance.test.ts']);
const localStorageMatches = scan('src', /localStorage/).filter(
  (path) => !visualCacheAllowlist.has(path.replaceAll('\\', '/')),
);
if (localStorageMatches.length)
  fail(`localStorage fora do cache visual aprovado: ${localStorageMatches.join(', ')}.`);

const networkSecurityMatches = scan('android/app/src', /certificates\s+src="user"/);
const nonDebugTrustMatches = networkSecurityMatches.filter(
  (path) => !path.replaceAll('\\', '/').startsWith('android/app/src/debug/'),
);
if (nonDebugTrustMatches.length) {
  fail(`CA de usuÃ¡rio sÃ³ pode ser confiada em debug: ${nonDebugTrustMatches.join(', ')}.`);
}

console.log(`Android validado: PlannerFin ${webPackage.version} (${versionCode}).`);
