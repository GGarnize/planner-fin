# PlannerFin — comandos de desenvolvimento local

Use este arquivo como referência rápida para executar o PlannerFin nos diferentes ambientes.

Para ver uma ajuda resumida diretamente no terminal:

```powershell
pnpm commands
```

---

## Navegador — Web + API

```powershell
# Sobe o frontend Web e a API para desenvolvimento local no navegador.
pnpm dev
```

```powershell
# Sobe somente a API.
pnpm dev:api
```

```powershell
# Sobe somente o frontend Web.
pnpm dev:web
```

---

## Banco de dados local

```powershell
# Sobe o PostgreSQL local via Docker.
pnpm db:up
```

```powershell
# Derruba os containers locais.
pnpm db:down
```

```powershell
# Regenera o Prisma Client.
pnpm db:generate
```

```powershell
# Executa as migrations locais.
pnpm db:migrate
```

---

## Android — emulador

### Subir ambiente com emulador

```powershell
# Sobe os serviços necessários para Android e inicia/configura o emulador.
pnpm dev:android
```

```powershell
# Sobe somente os serviços necessários para Android, sem iniciar o emulador.
pnpm dev:android:services
```

### Gerar APK para o emulador

```powershell
# Gera APK debug configurado para acessar a API pelo endereço do emulador
# normalmente usando 10.0.2.2.
pnpm android:apk
```

APK gerado normalmente em:

```text
apps\web\android\app\build\outputs\apk\debug\app-debug.apk
```

### Ver dispositivos conectados

```powershell
# Lista celulares e emuladores visíveis pelo ADB.
adb devices
```

Exemplo esperado para o emulador:

```text
emulator-5554    device
```

### Instalar APK no emulador

```powershell
# Instala ou atualiza o APK no emulador preservando os dados do aplicativo.
adb -s emulator-5554 install -r `
  .\apps\web\android\app\build\outputs\apk\debug\app-debug.apk
```

Se houver apenas um dispositivo conectado:

```powershell
# Instala ou atualiza o APK no único dispositivo conectado.
adb install -r `
  .\apps\web\android\app\build\outputs\apk\debug\app-debug.apk
```

### Abrir Android Studio

```powershell
# Sincroniza o frontend/Capacitor com o projeto Android nativo.
pnpm android:sync
```

```powershell
# Abre o projeto Android no Android Studio.
pnpm android:open
```

---

## Android — celular físico pela rede local

### Conectar via ADB wireless

```powershell
# Conecta ao celular usando o IP e a porta mostrados no Android.
adb connect <IP_DO_CELULAR>:<PORTA>
```

Exemplo:

```powershell
adb connect 192.168.3.26:42995
```

```powershell
# Confirma se o celular está conectado.
adb devices
```

Se aparecerem duas entradas para o mesmo celular por causa de mDNS, use sempre o endereço explícito `IP:PORTA` nos comandos com `-s`.

### Subir ambiente para celular físico

```powershell
# Sobe API/proxy de desenvolvimento acessíveis pelo celular na rede local.
pnpm dev:phone
```

### Gerar APK para celular físico

```powershell
# Gera APK debug apontando para o IP LAN atual do computador.
pnpm android:apk:lan
```

### Instalar APK no celular físico

```powershell
# Instala ou atualiza o APK no celular preservando os dados do aplicativo.
adb -s <IP_DO_CELULAR>:<PORTA> install -r `
  .\apps\web\android\app\build\outputs\apk\debug\app-debug.apk
```

Exemplo:

```powershell
adb -s 192.168.3.26:42995 install -r `
  .\apps\web\android\app\build\outputs\apk\debug\app-debug.apk
```

---

## Parar ambiente Android

```powershell
# Para os serviços PlannerFin usados pelos fluxos Android.
pnpm dev:android:stop
```

```powershell
# Desconecta conexões ADB wireless.
adb disconnect
```

---

## Validação e qualidade

```powershell
# Verifica se o ambiente local está corretamente configurado.
pnpm env:doctor
```

```powershell
# Valida especificamente a configuração Android/Capacitor.
pnpm android:validate
```

```powershell
# Executa lint do monorepo.
pnpm lint
```

```powershell
# Executa verificação de tipos TypeScript.
pnpm typecheck
```

```powershell
# Compila o monorepo.
pnpm build
```

```powershell
# Executa a suíte geral de testes.
pnpm test
```

```powershell
# Executa os testes E2E da Web.
pnpm test:e2e
```

---

## Builds Android adicionais

```powershell
# Faz build Android debug pelo script específico do app.
pnpm android:build:debug
```

```powershell
# Faz build Android interno.
pnpm android:build:internal
```

---

## Release Android

> Estes comandos não são necessários para testes locais comuns.

```powershell
# Verifica se o ambiente está pronto para gerar/publicar uma release Android.
pnpm android:release:doctor
```

```powershell
# Configura credenciais e requisitos locais para release.
pnpm android:release:setup
```

```powershell
# Gera o bundle Android de release (.aab).
pnpm android:bundle:release
```

```powershell
# Executa o build de release Android.
pnpm android:release:build
```

```powershell
# Executa a etapa de publicação da release Android.
pnpm android:release:publish
```

```powershell
# Executa o fluxo automatizado completo de release.
pnpm android:release
```

---

## Fluxos rápidos

### Testar no navegador

```powershell
# Web + API.
pnpm dev
```

### Testar no emulador

```powershell
# Sobe serviços + emulador.
pnpm dev:android

# Gera APK para o emulador.
pnpm android:apk

# Instala/atualiza o APK no emulador.
adb -s emulator-5554 install -r `
  .\apps\web\android\app\build\outputs\apk\debug\app-debug.apk
```

### Testar no celular físico

```powershell
# Conecta ao celular.
adb connect <IP_DO_CELULAR>:<PORTA>

# Sobe serviços acessíveis pela LAN.
pnpm dev:phone

# Gera APK apontando para a LAN.
pnpm android:apk:lan

# Instala/atualiza o APK no celular.
adb -s <IP_DO_CELULAR>:<PORTA> install -r `
  .\apps\web\android\app\build\outputs\apk\debug\app-debug.apk
```

### Encerrar

```powershell
# Para os serviços Android do PlannerFin.
pnpm dev:android:stop

# Opcional: desconecta o ADB wireless.
adb disconnect
```

---

## Caminho padrão do APK debug

```text
apps\web\android\app\build\outputs\apk\debug\app-debug.apk
```
