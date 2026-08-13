# PlannerFin Notification Test

App Android local usado somente para validar a spike da SPEC-022.

- `notificationTestDebug`: instala `com.plannerfin.notificationtest`.
- `notificationOtherDebug`: instala `com.plannerfin.notificationother`.
- Não usa internet, backend, analytics nem dados reais.
- Publica notificações por broadcast via `NotificationManager`.
- APKs gerados ficam em `build/` e não devem ser versionados.

Exemplo:

```powershell
adb shell am broadcast -p com.plannerfin.notificationtest -a com.plannerfin.notificationtest.POST --es scenario purchase
```
