# Backend de importação — SPEC-021

## Parsers e limites

- **OFX:** `ofx-js` 1.1.1, licença MIT. A biblioteca é mantida, não possui dependências e
  interpreta OFX 1.x SGML e OFX 2.x XML. Antes de chamá-la, o módulo rejeita DTD,
  entidades, XInclude e stylesheet, limita bytes/tokens/linhas e valida UTF-8. A biblioteca
  opera somente sobre uma `string`, sem API de rede ou filesystem. A limitação conhecida é
  que a interrupção de 30 segundos é verificada no limite da operação síncrona; tamanho e
  complexidade são limitados antes do parse para evitar entrada sem limite.
- **CSV:** `csv-parse` 7.0.2, licença MIT. É o parser oficial do projeto Adaltas Node CSV,
  mantido e com API streaming. Esta integração usa a API síncrona sobre o buffer já limitado
  a 10 MiB, com registro de no máximo 8 KiB, UTF-8 fatal e no máximo 10.000 transações.

Os bytes ficam apenas no buffer privado do middleware durante a requisição e não são gravados
em disco. Assim, são liberados tanto em sucesso quanto em falha e a contingência de arquivo
temporário de uma hora não tem artefato a remover. Para CSV, células de texto são mantidas no
`sourceData` privado somente durante o draft porque o mapping precisa ser reexecutável; o
campo é apagado ao confirmar, cancelar ou expirar e nunca aparece na API ou em logs.

## Cleanup

`ImportsService.cleanup()` é uma operação idempotente e testável para o executor operacional
local: expira drafts após sete dias e remove drafts terminais sem identidade financeira após
24 horas. Até existir scheduler persistente aprovado, ela deve ser chamada pelo mesmo cron
local usado para manutenção da API. Sessões confirmadas e linhas vinculadas nunca são removidas
por esse cleanup, preservando a identidade forte inclusive quando o lançamento é soft-deleted.
