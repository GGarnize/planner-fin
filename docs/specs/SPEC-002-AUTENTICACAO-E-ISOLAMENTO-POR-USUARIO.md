# SPEC de funcionalidade — `SPEC-002 — Autenticação e isolamento por usuário`

> Esta SPEC aprova somente uma implementação futura. A criação deste documento é exclusivamente documental e não cria código, telas, endpoints, dependências, infraestrutura ou migrations.

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-002` |
| Título | `Autenticação e isolamento por usuário` |
| Responsável | `Codex Cloud` |
| Data de criação | `2026-08-06` |
| Última atualização | `2026-08-06` |
| Tarefa relacionada | `PROMPT-SPEC-002-AUTENTICACAO.md` |
| Documentos relacionados | `docs/specs/README.md`; `docs/specs/SPEC-000-SCAFFOLD-TECNICO.md`; `docs/process/GIT-WORKFLOW.md`; `docs/quality/DEFINITION-OF-DONE.md`; `docs/quality/TEST-STRATEGY.md`; `docs/product/VISION.md`; `docs/product/SCOPE.md`; `docs/product/PRODUCT-PRINCIPLES.md`; `docs/product/TO-BE-PRODUCT-MODEL.md`; `docs/product/GLOSSARY.md`; `docs/adr/ADR-001-ARQUITETURA-GERAL.md`; `docs/adr/ADR-003-BACKEND.md`; `docs/adr/ADR-004-PERSISTENCIA-E-ACESSO-A-DADOS.md`; `docs/adr/ADR-006-ESTRATEGIA-DE-TESTES.md` |

## 2. Status

`Aprovada`

**Aprovada por:** tarefa `PROMPT-SPEC-002-AUTENTICACAO.md`, em `2026-08-06`, que autoriza explicitamente a aprovação funcional quando não restarem ambiguidades.

## 3. Contexto

O PlannerFin é um sistema financeiro pessoal online-first. A arquitetura aprovada separa cliente e API HTTP, usa NestJS em monólito modular, PostgreSQL e Prisma e preserva compatibilidade futura com Android/Capacitor. O glossário define usuário como a pessoa autenticada que administra as próprias informações financeiras.

O scaffold técnico não possui autenticação funcional. Antes de criar domínios financeiros, é necessário estabelecer identidade, sessões revogáveis e uma fronteira obrigatória de propriedade que impeça acesso cruzado entre usuários.

## 4. Problema

Sem cadastro, autenticação e contexto confiável de usuário, a API não consegue identificar o proprietário de dados privados nem proteger operações futuras. Uma solução implícita poderia armazenar credenciais de forma insegura, permitir enumeração de contas, acoplar a web a mecanismos incompatíveis com Capacitor ou aceitar um `userId` fornecido pelo cliente, violando privacidade e isolamento.

## 5. Objetivo

Definir contratos verificáveis para cadastro manual, login por e-mail e senha, consulta do usuário atual, renovação com rotação de refresh token, logout da sessão atual, proteção da API e fluxo web mínimo, garantindo que toda operação privada futura derive o usuário da sessão autenticada e seja testada contra acesso cruzado.

## 6. Fora do escopo

- Funcionalidades financeiras, incluindo contas, categorias, lançamentos, transferências, cartões, faturas, dívidas, orçamento, recorrências, importações e IA.
- Compartilhamento familiar, convites, organizações, perfis familiares e permissões entre usuários.
- Painel administrativo, bloqueio administrativo, auditoria administrativa e sessões visíveis ao usuário.
- Cadastro ou login por telefone, nome de usuário separado, login social e serviço externo de autenticação.
- Confirmação ou envio de e-mail, recuperação ou troca de senha, 2FA, passkeys, alteração de e-mail, exclusão de conta e notificações.
- Logout global; fica registrado apenas como evolução possível em outra SPEC.
- Projeto Android/iOS, configuração nativa do Capacitor, deploy, infraestrutura de produção, CI pago ou reativação do workflow desativado.
- Stubs, rotas ou telas funcionais para qualquer item excluído.

## 7. Termos

| Termo | Definição adotada nesta SPEC |
|---|---|
| Usuário | Pessoa autenticada, proprietária exclusiva dos próprios dados privados. |
| E-mail normalizado | E-mail após remoção de espaços nas extremidades e conversão integral para minúsculas Unicode; não são alterados pontos, aliases `+` ou domínio além dessa conversão. |
| Access token | JWT assinado, de curta duração, usado como Bearer para autorizar chamadas; não é persistido no banco. |
| Refresh token | Valor aleatório opaco, de uso rotativo, que identifica e comprova uma sessão; somente seu digest é persistido. |
| Sessão | Registro revogável de uma cadeia de refresh tokens pertencente a um usuário. |
| Rotação | Substituição atômica do refresh token corrente por um novo token na renovação. |
| Reutilização | Apresentação de token que já foi rotacionado e, portanto, não corresponde mais ao digest corrente da sessão. |
| Usuário público | Projeção segura `{ id, name, email, createdAt }`, sem credenciais ou campos internos. |
| Contexto autenticado | Identidade validada pela API, composta no mínimo por `userId` e `sessionId`, derivada do access token. |

## 8. Comportamento atual

O scaffold possui aplicações web e API, prefixo global `/api`, Prisma e uma migration inicial técnica. Não existem entidades de usuário ou sessão, módulos de autenticação, telas de cadastro/login nem proteção de rotas. Esta constatação não autoriza editar a migration inicial.

## 9. Comportamento desejado

### 9.1 Cadastro e identidade

- O cadastro recebe exclusivamente `name`, `email` e `password`; DTOs rejeitam campos desconhecidos.
- Nome, e-mail e senha são obrigatórios. O nome é aparado, deve conter de 1 a 120 caracteres e é persistido já aparado.
- O e-mail é aparado e convertido para minúsculas antes da consulta e persistência. O valor canônico normalizado, com no máximo 254 caracteres, é o e-mail público e de login; não haverá segundo campo de e-mail original nesta unidade.
- A validade sintática do e-mail deve ser verificada por validador consolidado, sem tentar confirmar se a caixa existe.
- A unicidade de `email` é garantida no PostgreSQL e tratada de forma segura pela API, sem depender apenas de consulta prévia.
- Cadastro concluído autentica o usuário, cria uma sessão e entrega tokens pelo mesmo mecanismo do login.

### 9.2 Senha e hashing

- A senha deve ter entre 10 e 128 caracteres Unicode, conter ao menos uma letra e um número e não exigir símbolo, maiúscula ou troca periódica. Espaços são preservados; uma senha formada somente por espaços falha por não conter letra e número.
- A mesma política é validada no cliente para feedback e obrigatoriamente no backend.
- O algoritmo escolhido é **Argon2id**, por combinar resistência a ataques de memória e canais laterais e permitir custo de memória explícito. Bcrypt não foi escolhido porque limita a entrada efetiva e oferece menor resistência a hardware paralelo moderno.
- Parâmetros mínimos: Argon2id versão 19, memória `64 MiB` (`m=65536 KiB`), 3 iterações (`t=3`), paralelismo 1 (`p=1`), salt criptograficamente aleatório de pelo menos 16 bytes e saída de pelo menos 32 bytes. A implementação pode elevar custos após benchmark, nunca reduzi-los sem revisão da SPEC.
- A comparação usa a função de verificação da biblioteca Argon2. No login de e-mail inexistente, a API executa verificação contra hash sentinela válido para reduzir diferença temporal observável.
- Senha e hash jamais são retornados, logados ou persistidos fora do campo de hash.

### 9.3 Login e limitação de abuso

- O login normaliza o e-mail e compara a senha com segurança.
- E-mail inexistente, senha incorreta e credencial malformada que alcance a autenticação retornam a mesma mensagem `E-mail ou senha inválidos.` e `401`, sem indicar qual parte falhou.
- A proteção inicial usa contadores em memória do processo, sem Redis: login, no máximo 5 tentativas em 15 minutos pela combinação de IP e digest do e-mail normalizado, além de 30 tentativas em 15 minutos por IP; cadastro, 10 tentativas por hora por IP; refresh, 30 tentativas em 15 minutos por IP e sessão quando identificável.
- Ao exceder o limite, retornar `429` com `Retry-After`, mensagem genérica e sem confirmar conta. Uma tentativa bem-sucedida limpa o contador específico de login, não o limite global por IP.
- Os contadores não são garantia distribuída. A estratégia deve ser revisada antes de múltiplas réplicas da API ou quando métricas indicarem abuso, falsos positivos ou necessidade de bloqueio compartilhado. Redis ou serviço externo exige decisão futura.

### 9.4 Tokens e sessões

- O access token é JWT assinado com algoritmo explicitamente fixado pela configuração, inicialmente `HS256`, segredo independente e forte com no mínimo 256 bits de entropia, emissor e audiência validados. Duração: **15 minutos**.
- Claims mínimas: `sub` (ID do usuário), `sid` (ID da sessão), `iat`, `exp`, `iss` e `aud`. Nenhum e-mail, nome ou dado financeiro integra o token.
- O refresh token é opaco, gerado por CSPRNG com no mínimo 256 bits de entropia, e dura **30 dias** a partir de cada rotação. Seu formato transporta de modo não secreto o ID da sessão e um segredo aleatório, permitindo localizar a sessão; o banco guarda apenas digest `HMAC-SHA-256` do token completo, com chave secreta exclusiva para digest.
- Access tokens não são armazenados no banco. Múltiplas sessões por usuário são permitidas e cada sessão possui ID próprio.
- Login/cadastro criam sessão e refresh token em transação. Refresh valida e substitui digest/expiração em transação atômica, com atualização condicional do digest corrente, impedindo duas rotações simultâneas bem-sucedidas.
- Token expirado, revogado, malformado, de sessão inexistente ou com digest incorreto retorna `401`, limpa o cookie quando presente e não emite tokens.
- Se um token bem-formado referencia sessão ativa, mas não coincide com o digest corrente, é tratado como reutilização: a sessão inteira é revogada atomicamente, a resposta é `401`, o cookie é limpo e novo login é exigido. Isso também cobre corrida perdida entre dois refreshes.
- Logout revoga somente a sessão atual. O access token emitido pode continuar válido até seus 15 minutos, pois não haverá consulta ao banco em toda chamada; o risco é limitado pela curta expiração. Logout global requer outra SPEC.

### 9.5 Entrega e armazenamento na web

- Cadastro, login e refresh retornam o access token no JSON. A web o mantém **somente em memória**, nunca em `localStorage`, `sessionStorage`, IndexedDB ou cookie.
- O refresh token é entregue à web exclusivamente em cookie `HttpOnly`, `Path=/api/auth`, `SameSite=Lax`; `Secure` é obrigatório fora do desenvolvimento HTTP local. O cookie não expõe o valor ao JavaScript e tem `Max-Age` coerente com 30 dias.
- Endpoints que usam o cookie de refresh (`refresh` e `logout`) exigem proteção CSRF por token duplo: valor aleatório não `HttpOnly` em cookie separado, ecoado no header `X-CSRF-Token`, com comparação segura, além de validação de `Origin` contra a origem configurada. O token CSRF é renovado com a sessão e não contém credenciais.
- O access token segue em `Authorization: Bearer <token>`. A camada cliente encapsula obtenção, armazenamento em memória, refresh e repetição única da requisição após `401` por expiração.
- A decisão não prende o domínio de autenticação ao navegador: emissão/validação e estado de sessão ficam independentes do transporte, e a web usa um adaptador de cookies. Um cliente Capacitor futuro deverá usar armazenamento seguro nativo e transporte aprovado em SPEC própria; não se autoriza armazenar refresh token em Web Storage nem gerar projeto móvel agora.

### 9.6 Isolamento por usuário

- Todo modelo financeiro privado futuro deve possuir `userId` obrigatório e integridade referencial com usuário.
- O guard valida assinatura, algoritmo, emissor, audiência e expiração do access token e cria contexto com `userId=sub` e `sessionId=sid`.
- Controllers, serviços e repositórios que tratem dados privados recebem o contexto de usuário e filtram operações por `userId`. IDs presentes em path identificam o recurso, nunca o proprietário.
- `userId` enviado em body, query ou header de negócio é rejeitado por DTO explícito ou ignorado como campo não permitido; jamais substitui o contexto autenticado.
- Consultas e mutações devem usar predicado composto por recurso e proprietário ou consultar através da relação do proprietário. A autorização é feita no backend; ocultar controles na interface não é autorização.
- Para recurso de outro usuário, a resposta futura deve ser `404` quando isso evitar revelar existência; nunca retornar conteúdo, contagem ou metadado do outro usuário.
- Nesta unidade, que ainda não cria dados financeiros, o isolamento é comprovado entre usuários e sessões e por um endpoint autenticado de usuário atual. Toda SPEC financeira futura deverá repetir testes com dois usuários e recursos distintos.

### 9.7 Backend

- Criar módulos NestJS separados de autenticação e usuário, sem módulo financeiro.
- O módulo de autenticação contém casos de uso, serviço de hashing, emissão/validação de tokens, sessões, guard e contexto autenticado.
- O módulo de usuário persiste e projeta somente dados públicos necessários; nenhum campo financeiro pertence a `User`.
- DTOs explícitos com whitelist e rejeição de propriedades desconhecidas protegem contra mass assignment.
- Exceções internas são mapeadas para o envelope seguro definido nesta SPEC. Erros de banco, stack traces e detalhes criptográficos não chegam ao cliente.
- Cadastro, criação de sessão, rotação e revogação usam transações quando a atomicidade exigir.

### 9.8 Web

- Criar telas responsivas de cadastro e login, estado autenticado centralizado, restauração de sessão, logout e uma rota autenticada mínima que exibe o usuário atual, sem conteúdo financeiro.
- Após cadastro ou login, armazenar access token em memória, carregar usuário atual e navegar para a rota autenticada.
- Ao recarregar, tentar uma única renovação pelo cookie; durante a tentativa, mostrar estado de carregamento sem exibir conteúdo protegido.
- Se access token expirar, tentar refresh uma vez e repetir uma vez a chamada original. Se falhar, limpar estado e redirecionar para login.
- Acesso a rota protegida sem sessão redireciona ao login, preservando apenas destino interno seguro. Usuário já autenticado que abre login/cadastro é redirecionado à rota autenticada.
- Logout chama a API, sempre limpa estado local e redireciona ao login. Falha de rede informa que a revogação não pôde ser confirmada, sem manter acesso local.
- API indisponível mostra mensagem clara e opção de tentar novamente; não apresenta falha de rede como credencial inválida.
- Formulários possuem loading, bloqueio de duplo envio, labels, mensagens associadas e validação cliente sem substituir a validação backend.

## 10. Personas ou atores

| Ator | Necessidade | Ações autorizadas |
|---|---|---|
| Visitante | Criar conta ou entrar. | Cadastrar-se e autenticar-se. |
| Usuário autenticado | Manter e encerrar sua sessão e consultar sua identidade. | Renovar sessão, consultar `/me` e fazer logout da sessão atual. |
| Cliente web | Restaurar estado com segurança. | Guardar access token em memória e usar cookie HttpOnly/CSRF para refresh. |
| API | Aplicar identidade autoritativa. | Validar tokens, criar contexto, revogar sessão e restringir dados ao proprietário. |

## 11. Fluxos

### 11.1 Fluxo principal

1. Visitante envia nome, e-mail e senha válidos.
2. API normaliza o e-mail, cria usuário e sessão atomicamente e devolve usuário público, access token e cookies de refresh/CSRF.
3. Web mantém access token em memória e abre a rota autenticada.
4. Web envia Bearer token; o guard cria contexto autenticado.
5. Ao recarregar ou expirar o access token, a web renova a sessão com cookie e proteção CSRF.
6. Ao sair, a API revoga a sessão corrente e a web remove o estado local.

### 11.2 Fluxos alternativos e exceções

- E-mail duplicado no cadastro → `409 EMAIL_ALREADY_IN_USE`, sem criar usuário ou sessão parcial.
- Credenciais inválidas → `401 INVALID_CREDENTIALS`, resposta idêntica para conta existente ou inexistente.
- Limite excedido → `429 RATE_LIMITED` e `Retry-After`.
- Access token ausente/inválido → `401 UNAUTHENTICATED`.
- Refresh expirado, revogado ou inválido → `401 INVALID_SESSION`, cookies limpos e novo login.
- Refresh reutilizado → revogar sessão, `401 INVALID_SESSION` e novo login.
- CSRF ausente/inválido ou origem não permitida → `403 CSRF_VALIDATION_FAILED`, sem alterar sessão.
- API indisponível → preservar somente estado não sensível e oferecer nova tentativa; não simular sucesso.

## 12. Regras de negócio

| ID | Regra | Origem/decisão | Exemplo |
|---|---|---|---|
| `RN-01` | Cadastro aceita somente nome, e-mail e senha obrigatórios. | Tarefa atual. | `role` enviado é rejeitado. |
| `RN-02` | E-mail é normalizado antes de persistir e comparar. | Tarefa atual. | ` Pessoa@EXEMPLO.com ` vira `pessoa@exemplo.com`. |
| `RN-03` | E-mail normalizado é único no banco. | Tarefa atual. | Variação de caixa retorna conflito. |
| `RN-04` | Senhas usam Argon2id nos parâmetros mínimos definidos. | Decisão desta SPEC. | Nunca persistir texto puro. |
| `RN-05` | Falha de login não enumera usuários. | Tarefa atual. | Mesmo status, código e mensagem. |
| `RN-06` | Access token dura 15 minutos e não é persistido. | Decisão desta SPEC. | Logout não mantém denylist. |
| `RN-07` | Refresh token dura 30 dias, gira a cada uso e só tem digest persistido. | Tarefa atual e decisão desta SPEC. | Token anterior não pode renovar novamente. |
| `RN-08` | Reutilização revoga a sessão correspondente. | Decisão desta SPEC. | Novo login é necessário. |
| `RN-09` | Logout revoga somente a sessão atual. | Tarefa atual. | Outras sessões permanecem ativas. |
| `RN-10` | Identidade vem exclusivamente do contexto autenticado. | Tarefa atual. | `userId` do body não autoriza acesso. |
| `RN-11` | Dados privados nunca atravessam usuários. | Segurança e produto. | Usuário A não lê recurso de B. |
| `RN-12` | Nenhuma funcionalidade financeira integra esta unidade. | Tarefa atual. | Não criar conta ou lançamento. |

## 13. Modelo de dados

### 13.1 Entidades mínimas

| Entidade | Campo | Tipo conceitual | Obrigatório | Regra |
|---|---|---|---|---|
| User | `id` | UUID | Sim | Estável, gerado pelo servidor, chave primária. |
| User | `name` | Texto até 120 | Sim | Aparado, não vazio. |
| User | `email` | Texto até 254 | Sim | Canônico normalizado e único. |
| User | `passwordHash` | Texto | Sim | PHC string Argon2id; nunca exposto. |
| User | `createdAt` | Instante UTC | Sim | Gerado na criação. |
| User | `updatedAt` | Instante UTC | Sim | Atualizado pelo sistema. |
| Session | `id` | UUID | Sim | Identificador revogável da sessão. |
| Session | `userId` | UUID | Sim | FK para User e índice. |
| Session | `refreshTokenDigest` | Texto | Sim | HMAC-SHA-256 do token corrente, nunca token puro. |
| Session | `expiresAt` | Instante UTC | Sim | Expiração do refresh corrente. |
| Session | `revokedAt` | Instante UTC | Não | Preenchido ao revogar/reutilizar/logout. |
| Session | `createdAt` | Instante UTC | Sim | Gerado na criação. |
| Session | `updatedAt` | Instante UTC | Sim | Alterado em rotação/revogação. |

Não serão armazenados IP, geolocalização, user agent, nome de dispositivo, access token ou histórico completo de refresh tokens nesta etapa. O digest antigo deixa de ser aceito na rotação; a atualização condicional distingue a reutilização. A exclusão futura de usuário, embora fora do escopo funcional, terá integridade `ON DELETE CASCADE` de User para Session para não deixar credenciais órfãs; nenhuma rota de exclusão será criada.

### 13.2 Migration futura

- Criar migration nova; jamais editar a migration inicial aplicada.
- Criar tabelas `User` e `Session`, FK com deleção em cascata, índice de `Session.userId`, unicidade de `User.email` e constraints compatíveis com os campos obrigatórios.
- A normalização no backend e a constraint única sobre o valor canônico persistido garantem unicidade sem diferenciar caixa.
- Validar aplicação e rollback operacional em PostgreSQL real com dados sintéticos.
- Não criar tabela ou coluna financeira.

## 14. Contratos de API

Todos os endpoints usam o prefixo global `/api`, JSON UTF-8 e envelope de erro:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "E-mail ou senha inválidos.",
    "details": [{ "field": "email", "message": "Informe um e-mail válido." }]
  }
}
```

`details` existe somente para erros de validação `400`, contém campos previstos no DTO e nunca ecoa senha ou valor recebido. Demais erros omitem `details`. Respostas de autenticação usam:

```json
{
  "accessToken": "<JWT>",
  "expiresIn": 900,
  "user": {
    "id": "<UUID>",
    "name": "Maria Silva",
    "email": "maria@example.com",
    "createdAt": "2026-08-06T12:00:00.000Z"
  }
}
```

`createdAt` integra o contrato para permitir apresentação estável de informações da conta; nenhum outro timestamp é público.

### 14.1 Cadastro

- Método e rota: `POST /api/auth/register`.
- Autenticação: pública; sujeita a rate limit.
- Corpo: `{ "name": string, "email": string, "password": string }`, sem campos adicionais.
- Sucesso: `201`, corpo de autenticação, `Set-Cookie` do refresh e CSRF.
- Erros: `400 VALIDATION_ERROR`; `409 EMAIL_ALREADY_IN_USE`; `429 RATE_LIMITED`; `500 INTERNAL_ERROR` genérico.
- Validações: regras de nome, e-mail e senha das seções 9 e 16.
- Idempotência: não idempotente; repetição com o mesmo e-mail retorna `409` e não cria nova sessão.

### 14.2 Login

- Método e rota: `POST /api/auth/login`.
- Autenticação: pública; sujeita a rate limit.
- Corpo: `{ "email": string, "password": string }`, sem campos adicionais.
- Sucesso: `200`, corpo de autenticação, `Set-Cookie` do refresh e CSRF.
- Erros: `400 VALIDATION_ERROR` para forma/tipos ausentes antes da autenticação; `401 INVALID_CREDENTIALS` para credenciais apresentadas inválidas, sempre `E-mail ou senha inválidos.`; `429 RATE_LIMITED`; `500 INTERNAL_ERROR`.
- Idempotência: não idempotente; cada sucesso cria sessão distinta.

### 14.3 Refresh

- Método e rota: `POST /api/auth/refresh`.
- Autenticação: cookie HttpOnly de refresh, cookie CSRF e header `X-CSRF-Token`; não requer access token.
- Corpo: vazio; campos enviados são rejeitados.
- Sucesso: `200`, mesmo corpo de autenticação e novos cookies de refresh/CSRF; o token anterior é invalidado atomicamente.
- Erros: `401 INVALID_SESSION`; `403 CSRF_VALIDATION_FAILED`; `429 RATE_LIMITED`; `500 INTERNAL_ERROR`.
- Idempotência: não idempotente; repetir o mesmo token é reutilização e revoga a sessão.

### 14.4 Logout

- Método e rota: `POST /api/auth/logout`.
- Autenticação: access token Bearer válido para identificar `sid`, além de validação CSRF porque limpa/usa cookies.
- Corpo: vazio; campos enviados são rejeitados.
- Sucesso: `204`, sem corpo, sessão atual revogada e cookies expirados. Se a sessão já estiver revogada mas o Bearer ainda for criptograficamente válido, mantém `204`, tornando a revogação idempotente.
- Erros: `401 UNAUTHENTICATED` para Bearer ausente/inválido; `403 CSRF_VALIDATION_FAILED`; `429 RATE_LIMITED`; `500 INTERNAL_ERROR`.
- Idempotência: idempotente quanto ao estado da sessão enquanto o access token ainda for válido.

### 14.5 Usuário atual

- Método e rota: `GET /api/users/me`.
- Autenticação: access token Bearer válido.
- Corpo: não permitido.
- Sucesso: `200`, `{ "id", "name", "email", "createdAt" }` com os tipos do usuário público.
- Erros: `401 UNAUTHENTICATED`; `404 USER_NOT_FOUND` apenas para inconsistência interna de usuário removido; `500 INTERNAL_ERROR`.
- Idempotência: leitura idempotente.

## 15. Interface

- Rotas públicas mínimas: cadastro e login. Rota privada mínima: área autenticada contendo somente saudação/dados públicos e ação de logout.
- Cadastro contém nome, e-mail, senha, submissão e link para login. Login contém e-mail, senha, submissão e link para cadastro.
- Senha deve usar controle mascarado; não deve ser repopulada após falha.
- Estados de carregamento impedem duplo envio. Erros de campo ficam associados ao controle; erro global e indisponibilidade ficam em região anunciável.
- A rota privada não contém dashboard, saldo, conta, lançamento ou qualquer outro elemento financeiro.
- A apresentação permanece responsiva e compatível com teclado. Não há evidência visual aprovada; deve seguir o sistema visual existente sem reformulação não solicitada.

## 16. Validações

| Campo ou ação | Validação | Mensagem/resultado esperado |
|---|---|---|
| `name` | String, após trim entre 1 e 120 caracteres. | `Informe seu nome.` ou `O nome deve ter no máximo 120 caracteres.` |
| `email` | String, trim, sintaxe válida, máximo 254; normalizar para minúsculas. | `Informe um e-mail válido.` |
| `password` no cadastro | String entre 10 e 128 caracteres, ao menos uma letra e um número. | `Use de 10 a 128 caracteres, com pelo menos uma letra e um número.` |
| `password` no login | String obrigatória, máximo 128 para limitar entrada; falha autenticada é genérica. | `E-mail ou senha inválidos.` |
| DTO | Rejeitar propriedades desconhecidas e tipos incorretos. | `400 VALIDATION_ERROR`, sem ecoar valores sensíveis. |
| Bearer | Esquema, assinatura, algoritmo, emissor, audiência e expiração válidos. | `401 UNAUTHENTICATED`. |
| Refresh | Formato, sessão, digest, validade e revogação válidos. | `401 INVALID_SESSION`; reutilização também revoga. |
| CSRF | Cookie/header iguais e origem permitida. | `403 CSRF_VALIDATION_FAILED`. |

## 17. Permissões

| Ação | Ator autorizado | Condição | Comportamento quando negado |
|---|---|---|---|
| Cadastrar | Visitante | DTO válido e e-mail disponível. | `400`, `409` ou `429`. |
| Login | Visitante | Credenciais válidas e limite disponível. | `401` genérico ou `429`. |
| Renovar | Portador da sessão | Refresh e CSRF válidos, sessão ativa. | `401`/`403`; nenhum token emitido. |
| Logout | Usuário autenticado | Bearer e CSRF válidos. | `401`/`403`. |
| Consultar usuário atual | Usuário autenticado | Bearer válido. | `401`. |
| Acessar dado privado futuro | Proprietário autenticado | Contexto `userId` corresponde ao proprietário. | `404` sem revelar o recurso alheio. |

## 18. Segurança e privacidade

- Dados pessoais: nome e e-mail. Dados secretos: senha, hash, JWT, refresh token, digest e segredos de assinatura/HMAC.
- Segredos ficam em variáveis de ambiente, nunca no repositório. Startup deve falhar se segredo JWT ou chave de digest estiver ausente, for placeholder ou tiver menos de 256 bits de entropia efetiva conforme codificação documentada. Devem ser independentes.
- `.env.example` contém somente nomes e exemplos inequivocamente fictícios, não segredos reutilizáveis.
- DTOs explícitos, whitelist com rejeição e mapeamento de saída impedem mass assignment e vazamento de `passwordHash`.
- CORS preserva a configuração existente, com origens explícitas e credenciais habilitadas apenas para origens aprovadas; curingas com credenciais são proibidos.
- Cookies seguem `HttpOnly`, `SameSite=Lax`, `Secure` fora do HTTP local, path restrito e expiração coerente. CSRF usa token duplo e validação de origem.
- Logs e evidências proíbem senha, hash, JWT, refresh token, digest, cookies, header Authorization, chave JWT/HMAC, corpo bruto de autenticação, nome e e-mail completos. E-mail, se indispensável para correlação técnica, somente digest não reversível com chave separada; por padrão, não registrar.
- Logs técnicos podem conter timestamp, nome do evento, resultado, código de erro, request/correlation ID, `sessionId` quando seguro e IP reduzido/anonimizado conforme política futura; nunca credenciais.
- Mensagens de login e tempos de verificação reduzem enumeração. Rate limiting em memória oferece contenção básica sem serviço externo.
- Nenhuma credencial real ou dado financeiro/pessoal real pode existir em código, fixtures, commits ou evidências.

## 19. Erros e estados vazios

| Situação | Estado apresentado | Recuperação esperada |
|---|---|---|
| Formulário inválido | Mensagens por campo, sem enviar ou conforme resposta backend. | Corrigir e reenviar. |
| Login inválido | Mensagem genérica, senha limpa. | Tentar novamente ou cadastrar-se. |
| Sessão ausente/expirada | Conteúdo protegido oculto e redirecionamento. | Fazer login. |
| Refresh bem-sucedido | Estado autenticado restaurado sem piscar conteúdo público indevido. | Continuar no destino. |
| Refresh falhou | Estado local limpo e login exibido. | Novo login. |
| API indisponível | Mensagem específica de indisponibilidade. | Tentar novamente; nunca alegar credencial inválida. |
| Rate limit | Mensagem genérica e espera indicada. | Repetir após `Retry-After`. |
| Logout sem confirmação de rede | Estado local removido e aviso de revogação não confirmada. | Novo login; sessão expira em até 30 dias se não revogada. |

## 20. Observabilidade

- Eventos seguros: `auth.register.succeeded/failed`, `auth.login.succeeded/failed/rate_limited`, `auth.refresh.succeeded/failed/reuse_detected`, `auth.logout.succeeded/failed` e `auth.guard.denied`.
- Medir contagens e latência sem labels de alta cardinalidade contendo e-mail, token ou usuário. Não introduzir serviço externo nesta unidade.
- Reutilização e falhas anormais devem ter log de segurança sanitizado com correlation ID e session ID, sem token/digest.
- Revisar rate limit ao adotar múltiplas instâncias ou observar abuso/falsos positivos. Alertas externos ficam fora do escopo.

## 21. Migração e compatibilidade

- Dados existentes: não há usuários funcionais a converter.
- Compatibilidade retroativa: o endpoint de saúde existente permanece inalterado; não existe contrato anterior de autenticação.
- Migração necessária: sim, uma migration nova para `User` e `Session`, sem editar a migration inicial.
- Implantação gradual: não aplicável nesta primeira unidade; API e web devem ser entregues coerentemente.
- Capacitor: a fronteira interna deve abstrair armazenamento/transporte; implementação móvel e armazenamento seguro nativo exigem SPEC posterior.

## 22. Critérios de aceite

### `CA-01 — Cadastro válido`
**Dado** um visitante com nome, e-mail e senha válidos e e-mail disponível

**Quando** envia o cadastro

**Então** recebe `201`, usuário público, access token e cookies seguros, e usuário/sessão são persistidos atomicamente.

### `CA-02 — E-mail duplicado`
**Dado** um usuário persistido

**Quando** outro cadastro usa o mesmo e-mail normalizado

**Então** recebe `409 EMAIL_ALREADY_IN_USE` e nenhum registro parcial é criado.

### `CA-03 — E-mail normalizado`
**Dado** o e-mail ` Pessoa@EXEMPLO.com `

**Quando** cadastro ou login é processado

**Então** a API usa e persiste `pessoa@exemplo.com` e a unicidade ignora caixa.

### `CA-04 — Senha inválida`
**Dado** senha fora da política mínima

**Quando** o cadastro é enviado

**Então** recebe `400 VALIDATION_ERROR`, sem persistir senha, usuário ou sessão.

### `CA-05 — Login válido`
**Dado** usuário cadastrado e senha correta

**Quando** faz login

**Então** recebe `200`, usuário público, access token e uma nova sessão com refresh seguro.

### `CA-06 — Login inválido`
**Dado** e-mail cadastrado e senha incorreta

**Quando** faz login

**Então** recebe `401 INVALID_CREDENTIALS` e nenhum token ou sessão é criado.

### `CA-07 — Sem enumeração de usuário`
**Dado** uma tentativa com e-mail inexistente e outra com senha incorreta

**Quando** as respostas são comparadas

**Então** status, código, mensagem e estrutura são iguais e ambos passam por verificação Argon2.

### `CA-08 — Emissão de access token`
**Dado** cadastro ou login válido

**Quando** a autenticação conclui

**Então** é emitido JWT de 15 minutos com claims mínimas e nenhum access token é persistido.

### `CA-09 — Emissão de refresh token`
**Dado** autenticação válida

**Quando** a sessão é criada

**Então** refresh opaco de 30 dias vai ao cookie HttpOnly e somente seu digest fica no banco.

### `CA-10 — Rotação de refresh token`
**Dado** sessão ativa, refresh e CSRF válidos

**Quando** chama refresh

**Então** digest e expiração são substituídos atomicamente e novos access/refresh tokens são emitidos.

### `CA-11 — Reutilização de refresh antigo`
**Dado** um refresh já rotacionado

**Quando** ele é usado novamente

**Então** a sessão é revogada, recebe `401 INVALID_SESSION` e nenhum token é emitido.

### `CA-12 — Refresh expirado`
**Dado** refresh cuja sessão expirou

**Quando** chama refresh

**Então** recebe `401 INVALID_SESSION`, cookies são limpos e novo login é exigido.

### `CA-13 — Logout`
**Dado** sessão autenticada

**Quando** solicita logout com CSRF válido

**Então** a sessão atual é revogada, cookies são expirados e recebe `204`, sem afetar outras sessões.

### `CA-14 — Usuário atual autenticado`
**Dado** Bearer válido

**Quando** consulta `GET /api/users/me`

**Então** recebe somente `id`, `name`, `email` e `createdAt` do próprio usuário.

### `CA-15 — Acesso sem autenticação`
**Dado** rota protegida

**Quando** é chamada sem Bearer válido

**Então** recebe `401 UNAUTHENTICATED` sem dados privados.

### `CA-16 — Isolamento entre usuários`
**Dado** usuários A e B com sessões distintas

**Quando** a sessão A tenta consultar identidade, sessão ou futuro recurso pertencente a B, inclusive enviando `userId` de B

**Então** recebe apenas dados de A ou `404/401`, nunca conteúdo ou metadados de B.

### `CA-17 — Segredo ausente no startup`
**Dado** segredo JWT ou chave de digest ausente, fraco ou placeholder

**Quando** a API inicia

**Então** falha antes de aceitar requisições, com mensagem sanitizada que não imprime segredos.

### `CA-18 — Logs sem dados sensíveis`
**Dado** sucessos e falhas nos fluxos de autenticação

**Quando** logs e evidências são inspecionados

**Então** não contêm senha, hash, token, digest, cookie, Authorization, segredo ou e-mail/nome completo.

### `CA-19 — Web restaura sessão`
**Dado** refresh cookie válido e página recarregada sem access token em memória

**Quando** a web inicializa

**Então** executa um refresh protegido por CSRF, restaura usuário e acessa a rota privada sem persistir tokens em Web Storage.

### `CA-20 — Web redireciona não autenticado`
**Dado** visitante sem sessão

**Quando** acessa rota protegida

**Então** nenhum conteúdo privado aparece e ele é redirecionado ao login.

### `CA-21 — API indisponível`
**Dado** cadastro, login ou restauração durante indisponibilidade da API

**Quando** a chamada falha por rede

**Então** a web informa indisponibilidade, oferece nova tentativa e não apresenta sucesso nem credencial inválida.

### `CA-22 — Ausência de funcionalidade financeira`
**Dado** o diff da implementação

**Quando** escopo, rotas, schema e telas são revisados

**Então** não existem entidades, endpoints, regras ou interfaces financeiras.

## 23. Testes obrigatórios

| Nível | Cenários mínimos | Infraestrutura | Evidência esperada |
|---|---|---|---|
| Unitário | Normalização; política de senha; hashing/verificação; claims, emissão e validação; projeção pública; rotação, revogação e reutilização; mapeamento de erros. | Mocks/fakes; relógio e aleatoriedade controlados quando cabível; sem PostgreSQL. | Relatório determinístico do runner backend. |
| Integração API/banco | Cadastro persistido; duplicidade normalizada; login válido/inválido sem enumeração; refresh válido, expirado, revogado e reutilizado; logout; `/me`; isolamento de sessões; concorrência de rotação; constraints/FK/cascade. | **PostgreSQL real efêmero obrigatório**, migration nova aplicada; dados fictícios. Prisma não deve ser mockado. | Comando, resultado e logs sanitizados. |
| Migration | Aplicação desde banco vazio e sobre schema da migration inicial; unicidade e integridade. | **PostgreSQL real obrigatório**. | `prisma generate` e migration aprovados. |
| Contrato HTTP | Métodos, rotas, schemas, cookies/headers, status, envelopes, campos proibidos e CORS/CSRF. | App NestJS em teste; banco real nos contratos persistentes, mocks apenas nos casos puros documentados. | Asserções automatizadas de request/response. |
| Web | Cadastro/login; validações; sucesso/falha; loading; restauração; refresh bem-sucedido/falho; logout; guarda de rota; API indisponível. | Mock Service Worker/fakes HTTP ou equivalente; sem PostgreSQL para componentes. | Vitest/componentes sem dados reais. |
| E2E | Cadastro, login, rota protegida, refresh ao recarregar, logout e bloqueio posterior. | Web + API + **PostgreSQL real efêmero**; dados sintéticos. | Playwright aprovado, sem segredos em artefatos. |
| Aceitação manual | Acessibilidade básica, mensagens, navegação e ausência de telas financeiras. | Ambiente local sanitizado. | Checklist/registro no PR sem credenciais. |

Testes com mocks não substituem integração para hashing real, constraints, transações, rotação concorrente ou isolamento. Nenhum teste usa dado pessoal ou financeiro real.

## 24. Arquivos permitidos

Na futura implementação, somente arquivos necessários à SPEC dentro destes caminhos:

- `apps/api/prisma/schema.prisma`;
- nova migration em `apps/api/prisma/migrations/**`;
- módulos de autenticação e usuário, guard, contexto, DTOs, configuração e testes relacionados em `apps/api/src/**`;
- testes de integração/E2E da API nos caminhos de teste já adotados em `apps/api/**`;
- contratos compartilhados realmente consumidos em `packages/shared/**`;
- telas, rotas, estado, adaptador HTTP de autenticação e testes em `apps/web/src/**`;
- testes Playwright relacionados em `apps/web/**`;
- arquivos de configuração de ambiente estritamente necessários;
- `.env.example`;
- `README.md`, somente quando necessário para configuração/execução;
- `package.json` dos workspaces e raiz e `pnpm-lock.yaml`, somente se dependências justificadas forem necessárias.

## 25. Arquivos proibidos

- Documentos AS-IS, documentos de produto, ADRs aprovados e SPECs anteriores.
- Workflow de CI desativado ou qualquer workflow fora de autorização própria.
- Módulos, modelos, rotas, testes ou telas financeiros: contas, categorias, lançamentos, transferências, cartões, faturas, dívidas, orçamento, importações e IA.
- Arquivos Android/iOS ou projeto Capacitor nativo.
- Deploy, infraestrutura ou configuração de produção.
- Migrations já aplicadas, especialmente a migration inicial.

## 26. Dependências

| Dependência | Motivo | Estado da aprovação | Impacto |
|---|---|---|---|
| Biblioteca Argon2 com suporte a Argon2id | Hash de senha conforme parâmetros aprovados. | Aprovada conceitualmente; versão estável deve ser justificada no PR. | Código nativo/build e benchmark devem ser validados. |
| Biblioteca JWT compatível com NestJS | Emitir e validar access tokens com algoritmo fixo. | Aprovada conceitualmente; preferir integração oficial NestJS. | Exige segredos e validação de claims. |
| Validação/configuração NestJS | DTOs e falha segura no startup. | Usar dependências existentes quando suficientes; adição deve ser justificada. | Evita configuração e entrada inválidas. |
| Rate limiter local | Proteção em memória. | Preferir recurso oficial ou implementação mínima; dependência nova só com justificativa. | Estado não compartilhado entre réplicas. |

Não se autoriza Redis, OAuth, provedor externo, serviço pago ou dependência de autenticação gerenciada. Alterações de `package.json` e lockfile devem se limitar ao estritamente necessário e explicar cada pacote.

## 27. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Roubo/reutilização de refresh token | Média | Sessão indevida. | Cookie HttpOnly, digest HMAC, rotação atômica, CSRF e revogação por reutilização. |
| Access token válido após logout | Média | Janela de até 15 minutos. | Expiração curta; registrar logout global/denylist como evolução se risco mudar. |
| Rate limit em memória contornado em múltiplas réplicas | Alta nesse cenário | Tentativas abusivas distribuídas. | Não escalar réplicas sem revisar estratégia; observar métricas. |
| Limite por IP afetar rede compartilhada | Média | Falso positivo. | Limites combinados, `Retry-After`, métricas e revisão. |
| Custo Argon2 causar latência/DoS | Média | Indisponibilidade. | Benchmark, limite de entrada e rate limit; nunca reduzir mínimos silenciosamente. |
| Corrida de refresh | Média | Token duplicado ou revogação inesperada. | Transação e compare-and-swap; testes concorrentes em PostgreSQL. |
| Configuração incorreta de cookie/CORS/CSRF | Média | Roubo ou ação forjada. | Defaults seguros, validação de origem e testes de contrato. |
| Esquecimento de filtro por proprietário em domínio futuro | Alta sem disciplina | Vazamento financeiro crítico. | Contexto obrigatório, repositórios tenant-aware e testes A/B em toda SPEC privada. |
| Perda de cookie no logout com API offline | Baixa | Sessão servidor permanece ativa. | Limpar cliente, avisar usuário e expiração em 30 dias; evolução para gestão de sessões. |

## 28. Rollback

A implementação deverá ser revertida por `git revert <commit-de-implementação>`, sem reescrever histórico. Em ambiente sem dados reais, a migration poderá ser revertida de forma segura conforme procedimento Prisma/PostgreSQL documentado e validado, seguida da validação do endpoint de saúde e build anterior.

Migration aplicada em ambiente com dados reais **não deve ser apagada, editada nem revertida destrutivamente**. Nesse caso, é obrigatório criar plano específico aprovado, preservar dados e, quando adequado, usar migration compensatória. A falha de autenticação após implantação exige interromper avanço e decidir recuperação sem excluir usuários/sessões silenciosamente.

## 29. Dúvidas

| ID | Dúvida | Impacto | Responsável | Estado |
|---|---|---|---|---|
| `D-01` | Argon2id ou bcrypt? | Segurança e dependência. | Tarefa atual / SPEC-002 | `Resolvida`: Argon2id com parâmetros mínimos da seção 9.2. |
| `D-02` | Como entregar tokens à web preservando futuro Capacitor? | XSS, CSRF e portabilidade. | SPEC-002 | `Resolvida`: access em memória, refresh em cookie HttpOnly com adaptador de transporte; mobile terá armazenamento seguro em SPEC futura. |
| `D-03` | Como limitar abuso sem Redis? | Disponibilidade e enumeração. | SPEC-002 | `Resolvida`: contadores locais e condições objetivas de revisão. |
| `D-04` | Há decisão humana pendente para implementar? | Poderia bloquear aprovação. | Tarefa atual | `Resolvida`: não; as decisões funcionais e de segurança desta unidade foram autorizadas explicitamente. |

Não há dúvida aberta. Mudança de algoritmo, prazos, transporte, política de senha, isolamento ou contratos exige controle de mudança e nova aprovação.

## 30. Decisões aprovadas

| Data | Decisão | Responsável pela aprovação | Consequência |
|---|---|---|---|
| `2026-08-06` | Cadastro manual usa nome, e-mail canônico normalizado e senha; e-mail é único. | Tarefa `PROMPT-SPEC-002-AUTENTICACAO.md` | Sem telefone, username ou login social. |
| `2026-08-06` | Senhas usam Argon2id, `m=64 MiB`, `t=3`, `p=1`, salt ≥16 bytes e saída ≥32 bytes. | Tarefa atual, detalhada nesta SPEC | Hash moderno com custo mínimo verificável. |
| `2026-08-06` | Política exige 10–128 caracteres, letra e número, sem complexidade artificial adicional. | Tarefa atual, detalhada nesta SPEC | Validação coerente em web e backend. |
| `2026-08-06` | Access JWT HS256 dura 15 minutos; refresh opaco rotativo dura 30 dias. | Tarefa atual, detalhada nesta SPEC | Access não persistido; sessão revogável. |
| `2026-08-06` | Web guarda access somente em memória e refresh somente em cookie HttpOnly com CSRF. | Tarefa atual, detalhada nesta SPEC | Reduz exposição a XSS e preserva adaptador futuro para mobile. |
| `2026-08-06` | Reutilização de refresh revoga a sessão correspondente. | Tarefa atual, detalhada nesta SPEC | Corrida perdida/replay exige novo login. |
| `2026-08-06` | Logout revoga somente sessão atual; access pode durar até expirar. | Tarefa atual | Sem denylist ou logout global inicial. |
| `2026-08-06` | Rate limit inicial é local, sem Redis, revisto antes de múltiplas réplicas ou por métricas. | Tarefa atual, detalhada nesta SPEC | Proteção básica coerente com monólito simples. |
| `2026-08-06` | `userId` privado sempre deriva do contexto autenticado. | Tarefa atual | Cliente não escolhe proprietário. |
| `2026-08-06` | A implementação usa NestJS, Prisma, migration nova e PostgreSQL real nos testes de persistência. | ADRs aprovados e tarefa atual | Preserva arquitetura e integridade. |

## 31. Definition of Done específica

Além da [Definition of Done do projeto](../quality/DEFINITION-OF-DONE.md), a implementação futura estará concluída quando:

- [ ] Uma migration nova cria User/Session sem editar migration anterior e é validada em PostgreSQL disponível.
- [ ] Cadastro, login, refresh com rotação, logout e usuário atual seguem exatamente os contratos HTTP.
- [ ] Guard e contexto autenticado protegem rotas e não confiam em `userId` do cliente.
- [ ] Isolamento por usuário está incorporado e coberto por testes com dois usuários.
- [ ] Senha e refresh token nunca são persistidos em texto puro; access token não é persistido.
- [ ] Telas, estado, restauração, proteção de rota e feedback web mínimos funcionam sem tela financeira.
- [ ] Testes unitários, integração, contrato, web e E2E obrigatórios passam nos ambientes definidos.
- [ ] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:unit`, testes de integração aplicáveis, `pnpm test:e2e`, `pnpm build`, `pnpm db:generate` e migration passam.
- [ ] Nenhum segredo, credencial, dado pessoal real ou dado financeiro foi incluído.
- [ ] `.env.example` e `README.md` foram atualizados quando necessário, sem segredo real.
- [ ] Nenhuma funcionalidade financeira ou item fora do escopo foi criado.
- [ ] Evidências sanitizadas de todos os comandos foram registradas.
- [ ] Todos os critérios de aceite foram atendidos.
- [ ] As evidências obrigatórias foram anexadas.

## 32. Histórico de alterações da SPEC

| Data | Alteração | Motivo | Autor | Aprovador, quando aplicável |
|---|---|---|---|---|
| `2026-08-06` | Criação e aprovação da SPEC-002. | Definir cadastro, autenticação, sessão e isolamento antes dos domínios financeiros. | `Codex Cloud` | Tarefa `PROMPT-SPEC-002-AUTENTICACAO.md` |
