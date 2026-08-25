const sections = [
  {
    title: 'DESENVOLVIMENTO',
    commands: [
      ['pnpm dev', 'Sobe Web + API para desenvolvimento no navegador.'],
      ['pnpm dev:api', 'Sobe somente a API.'],
      ['pnpm dev:web', 'Sobe somente o frontend Web.'],
    ],
  },
  {
    title: 'ANDROID — EMULADOR',
    commands: [
      ['pnpm dev:android', 'Sobe os serviços e inicia/configura o emulador Android.'],
      [
        'pnpm dev:android:services',
        'Sobe os serviços para Android, mas não inicia o emulador.',
      ],
      [
        'pnpm android:apk',
        'Gera APK debug configurado para acessar a API pelo endereço do emulador.',
      ],
      ['pnpm android:validate', 'Valida a configuração Android/Capacitor.'],
      ['pnpm android:open', 'Abre o projeto Android no Android Studio.'],
    ],
  },
  {
    title: 'ANDROID — CELULAR FÍSICO',
    commands: [
      [
        'pnpm dev:phone',
        'Sobe os serviços de desenvolvimento acessíveis pelo celular na rede local.',
      ],
      [
        'pnpm android:apk:lan',
        'Gera APK debug configurado para acessar o PC pela rede local.',
      ],
    ],
  },
  {
    title: 'BANCO',
    commands: [
      ['pnpm db:up', 'Sobe o PostgreSQL local via Docker.'],
      ['pnpm db:down', 'Derruba os containers locais.'],
      ['pnpm db:generate', 'Regenera o Prisma Client.'],
      ['pnpm db:migrate', 'Executa as migrations locais.'],
    ],
  },
  {
    title: 'QUALIDADE',
    commands: [
      ['pnpm lint', 'Executa lint do monorepo.'],
      ['pnpm typecheck', 'Executa verificação TypeScript.'],
      ['pnpm build', 'Compila o monorepo.'],
      ['pnpm test', 'Executa a suíte geral de testes.'],
    ],
  },
  {
    title: 'RELEASE — NÃO USAR NO DIA A DIA',
    commands: [
      [
        'pnpm android:release:doctor',
        'Verifica se o ambiente está pronto para gerar/publicar release.',
      ],
      ['pnpm android:bundle:release', 'Gera o bundle Android de release (.aab).'],
      ['pnpm android:release:build', 'Executa o build de release Android.'],
      ['pnpm android:release:publish', 'Executa a publicação da release Android.'],
      ['pnpm android:release', 'Executa o fluxo automatizado completo de release.'],
    ],
  },
];

console.log('\nPlannerFin — comandos disponíveis\n');

for (const section of sections) {
  console.log(section.title);

  for (const [command, description] of section.commands) {
    console.log(`  ${command}`);
    console.log(`    ${description}\n`);
  }
}

console.log('FLUXOS RÁPIDOS\n');

console.log('  Navegador');
console.log('    pnpm dev\n');

console.log('  Emulador');
console.log('    pnpm dev:android');
console.log('    pnpm android:apk');
console.log(
  '    adb -s emulator-5554 install -r .\\apps\\web\\android\\app\\build\\outputs\\apk\\debug\\app-debug.apk\n',
);

console.log('  Celular físico');
console.log('    pnpm dev:phone');
console.log('    pnpm android:apk:lan');
console.log(
  '    adb -s <IP:PORTA> install -r .\\apps\\web\\android\\app\\build\\outputs\\apk\\debug\\app-debug.apk\n',
);

console.log('  Parar ambiente Android');
console.log('    pnpm dev:android:stop\n');

console.log(
  'APK debug: apps\\web\\android\\app\\build\\outputs\\apk\\debug\\app-debug.apk\n',
);