import { execFileSync } from 'node:child_process';
import {
  composeApiBaseUrl,
  findLatestApk,
  selectLanIPv4,
  validateRemoteApiBaseUrl,
} from './dx-helpers.mjs';

const command = process.argv[2];

try {
  if (command === 'lan-ip') {
    const override = process.argv[3] || process.env.PLANNER_FIN_LAN_IP || '';
    const adapters = JSON.parse(process.argv[4] || getWindowsAdaptersJson());
    console.log(selectLanIPv4(adapters, override));
  } else if (command === 'api-url') {
    const target = process.argv[3];
    const lanIp = process.argv[4] || process.env.PLANNER_FIN_LAN_IP || '';
    const remoteUrl = process.env.PLANNER_FIN_REMOTE_API_BASE_URL;
    console.log(composeApiBaseUrl({ target, lanIp, remoteUrl }));
  } else if (command === 'validate-remote') {
    console.log(validateRemoteApiBaseUrl(process.env.PLANNER_FIN_REMOTE_API_BASE_URL));
  } else if (command === 'latest-apk') {
    const apk = findLatestApk(process.argv[3]);
    if (!apk) throw new Error('Nenhum APK debug encontrado.');
    console.log(apk);
  } else {
    throw new Error(
      'Uso: node scripts/android/dx-cli.mjs lan-ip|api-url|validate-remote|latest-apk',
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function getWindowsAdaptersJson() {
  if (process.platform !== 'win32') return '[]';
  const ps = [
    'Get-NetIPConfiguration',
    '| Where-Object { $_.IPv4Address -and $_.NetAdapter.Status -eq "Up" }',
    '| ForEach-Object { [pscustomobject]@{ name=$_.InterfaceAlias; description=$_.NetAdapter.InterfaceDescription; ip=$_.IPv4Address.IPAddress } }',
    '| ConvertTo-Json -Compress',
  ].join(' ');
  const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], {
    encoding: 'utf8',
  }).trim();
  if (!output) return '[]';
  return output.startsWith('[') ? output : `[${output}]`;
}
