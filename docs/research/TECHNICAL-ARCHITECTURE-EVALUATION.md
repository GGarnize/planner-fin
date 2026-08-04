# ARCH-001 — Avaliação da arquitetura técnica inicial

## 1. Status, objetivo e limites

**Status:** pesquisa técnica; não constitui decisão arquitetural, ADR, SPEC ou autorização de implementação.  
**Data da pesquisa:** 2026-08-04.  
**Escopo:** comparar opções para a primeira arquitetura do PlannerFin, sem escolher tecnologia ou versão.

Este documento parte das decisões de produto já aprovadas: Android publicável e web responsiva no MVP, preservação de iOS futuro, operação inicialmente online-first, núcleo financeiro determinístico e independente de IA, banco relacional e evolução incremental. A pesquisa não cria aplicação, dependências, banco, CI nem infraestrutura.

### 1.1 Método e linguagem de evidência

- **Fato documentado:** capacidade ou limitação afirmada por documentação oficial consultada nas fontes da seção 12.
- **Inferência:** avaliação contextual para o PlannerFin, derivada dos fatos e das restrições do produto; precisa ser validada por prova de conceito ou ADR.
- **Dúvida:** informação que depende de requisito, protótipo, benchmark ou decisão ainda inexistente.
- As referências usam identificadores `[Fxx]`; todas foram consultadas em **2026-08-04**.
- Menções ao estado atual das ferramentas servem somente à pesquisa. Nenhuma versão exata fica selecionada.
- “Facilidade para agentes” significa estrutura explícita, mudanças localizadas, tipagem, comandos reproduzíveis e diffs revisáveis; não significa que uma tecnologia seja intrinsecamente “entendida” por IA.

## 2. Restrições e forças arquiteturais

| Força | Consequência para a avaliação |
|---|---|
| Android principal e web responsiva no MVP | A solução cliente precisa entregar ambas sem tornar uma delas apenas teórica. |
| iOS futuro | Evitar uma escolha que feche a publicação nativa futura ou exigir reescrita sem benefício demonstrado. |
| Online-first | Não antecipar sincronização offline; ainda tratar falhas de rede e preservar integridade transacional no servidor. |
| Preferência por TypeScript e Vue | Contabilizar familiaridade, mas não usá-la como critério eliminatório. |
| Domínio financeiro determinístico | Isolar regras em módulos testáveis, com precisão monetária e transações; IA deve ficar fora do caminho autoritativo. |
| Uso pessoal inicial, evolução possível | Favorecer baixa operação agora e fronteiras que comportem identidade e múltiplos usuários depois. |
| Codex no desenvolvimento | Favorecer convenções, tipagem, testes rápidos, documentação local e baixo volume de configuração implícita. |
| Sem necessidade de microserviços | Avaliar um monólito modular como ponto de partida, sem distribuí-lo preventivamente. |

## 3. Aplicação cliente

### 3.1 Evidências comuns

**Fatos documentados.** Vue se apresenta como framework progressivo baseado em componentes e oferece suporte oficial a TypeScript [F01]. Capacitor é um runtime nativo multiplataforma para aplicações web, com alvos iOS, Android e PWA, APIs de plugins e possibilidade de plugins próprios [F04]. Uma Trusted Web Activity (TWA) abre conteúdo web em tela cheia por meio do navegador e exige associação entre aplicativo e site; o conteúdo continua sendo renderizado pelo navegador [F06]. Flutter compila aplicações multiplataforma a partir de uma base em Dart [F07]. React Native renderiza componentes de plataforma e sua documentação recomenda um framework como Expo para novas aplicações [F08].

**Inferência para o PlannerFin.** “Uma base” não equivale a “experiência idêntica”: navegação, teclado, permissões, acessibilidade, ciclo de vida e distribuição precisam de validação em Android real e na web em qualquer alternativa.

### 3.2 Matriz comparativa

Escala qualitativa: **forte**, **média** ou **fraca**, sempre relativa às restrições atuais; não é pontuação nem ranking.

| Opção | Android e web / Play Store / iOS | UX móvel e nativo | Testes e acessibilidade | Manutenção Vue e agentes | Limitações e riscos |
|---|---|---|---|---|---|
| **Vue 3 + Quasar + Capacitor** | **Fato:** Quasar permite modos SPA, SSR, PWA, Capacitor e Cordova a partir de projeto Vue [F02][F03]; Capacitor cobre Android e iOS [F04]. **Inferência:** reaproveitamento forte e caminho direto à loja. | **Fato:** Quasar fornece componentes responsivos e integração de modo mobile [F02][F03]. **Inferência:** UX pode ser boa, mas a identidade visual tende a ser a do design system, não widgets nativos. | **Fato:** Vue documenta testes unitários, de componentes e E2E [F01]; Quasar publica diretrizes de acessibilidade e extensão de testes [F02]. **Inferência:** cobertura forte se houver testes por modo; qualidade de acessibilidade depende do uso dos componentes e auditoria. | Familiaridade **forte**; uma linguagem predominante e convenções do CLI ajudam mudanças localizadas. | Superfície de Quasar + Vue + Capacitor; diferenças entre modos; plugins nativos podem exigir Kotlin/Swift; risco de acoplamento ao design system. |
| **Ionic Vue + Capacitor** | **Fato:** Ionic Vue usa Vue, componentes Ionic e Capacitor para iOS, Android e web [F05]. **Inferência:** compartilhamento forte e publicação viável. | Biblioteca explicitamente mobile e gestos/transições de estilo de plataforma [F05]; experiência depende de desempenho e desenho dos fluxos. | **Fato:** componentes Ionic são construídos com padrões web; documentação aborda acessibilidade e testes [F05]. **Inferência:** forte base, mas Web Components exigem atenção nas ferramentas de teste e seletores. | Familiaridade Vue **forte**; camada Ionic/Web Components adiciona conceitos, porém mantém TypeScript/web. | Visual pode parecer “híbrido”; atualização coordenada Ionic/Capacitor; compatibilidade de plugins e depuração de WebView. |
| **Vue web como PWA/TWA** | **Fato:** PWA é instalável quando atende critérios do navegador; TWA pode ser empacotada para Android e exige Digital Asset Links [F06]. Web é compartilhada; iOS seria PWA ou futura embalagem distinta. | **Inferência:** adequada se os fluxos forem majoritariamente formulários; integração, comportamento de volta, notificações e recursos nativos são mais limitados/variáveis que Capacitor. | Ferramentas web maduras; semântica HTML favorece acessibilidade. É preciso testar navegadores, instalação e TWA. | Familiaridade **forte** e menor superfície inicial. | Dependência das capacidades do navegador; TWA requer site confiável e associação; experiência/recursos de loja limitados; preserva iOS apenas parcialmente. |
| **Flutter** | **Fato:** suporta Android, iOS e web em Dart [F07]. **Inferência:** compartilhamento potencialmente forte e lojas viáveis. | Controle consistente da renderização e ampla biblioteca de widgets [F07]; boa capacidade móvel. | **Fato:** documentação cobre testes unitários, widget e integração, além de acessibilidade [F07]. | Familiaridade Vue **fraca**; nova linguagem, widgets e toolchain aumentam contexto para equipe e agentes. | Web pode ter peso, semântica e comportamento diferentes de uma aplicação DOM; duplicação de contratos TypeScript; necessidade de validar acessibilidade e formulários financeiros na web. |
| **React Native** | **Fato:** Android/iOS são centrais; web normalmente depende de framework/ecossistema adicional, e a documentação recomenda framework para novos apps [F08]. | Componentes de plataforma e módulos nativos oferecem experiência móvel forte [F08]. | Ecossistema amplo; estratégia web e E2E varia conforme framework. Acessibilidade exige mapear propriedades às plataformas. | TypeScript ajuda, mas React e ecossistema são novos; manutenção **média/fraca** diante da familiaridade Vue. | Web não é equivalência automática; escolhas adicionais (framework, navegação, módulos) ampliam matriz de compatibilidade; possível duplicação de UI. |

### 3.3 Condições que podem alterar a avaliação

- Se protótipo demonstrar que TWA satisfaz integralmente loja, notificações, navegação e experiência, sua menor superfície ganha relevância.
- Se forem exigidos muitos recursos nativos, execução em segundo plano ou UX estritamente nativa, Flutter/React Native ou plugins Capacitor específicos ganham peso.
- Se a web precisar de semântica DOM, SEO público ou acessibilidade web especialmente rigorosa, abordagens web ganham peso.
- Se a equipe adquirir domínio comprovado em Dart/Flutter ou React Native, a penalidade de familiaridade diminui.
- Uma prova de conceito deve medir: formulário longo, teclado, navegação/voltar, leitor de tela, tempo de inicialização, build assinado Android, execução web e um plugin nativo representativo.

## 4. Backend

### 4.1 Evidências

**Fatos documentados.** NestJS organiza aplicações em módulos, controllers e providers; oferece pipes de validação, autenticação, OpenAPI, testes, agendamento, filas e técnicas de observabilidade, e pode operar sobre Express (padrão documentado) ou Fastify [F09]. O adaptador Fastify do Nest troca a plataforma HTTP e pode exigir equivalentes compatíveis com Fastify [F09]. Fastify enfatiza baixo overhead, arquitetura de plugins e validação/serialização baseada em schema [F10]. AdonisJS é um framework TypeScript “batteries included”, com validação, autenticação, ORM, testes e tarefas/filas documentadas no ecossistema oficial [F11]. Next.js é um framework React para aplicações web full-stack, com App Router e Route Handlers [F12].

### 4.2 Comparação

| Opção | Modularidade e TS | Validação, auth e API | Testes, jobs, filas e observabilidade | Complexidade / monólito modular | Riscos e inferências |
|---|---|---|---|---|---|
| **NestJS + adaptador padrão (Express)** | Estrutura explícita por módulos e injeção de dependência; TypeScript central [F09]. | Recursos oficiais para pipes, guards, Passport e OpenAPI [F09]. | Suporte documentado para testes, scheduler, filas e técnicas de observabilidade [F09]. | **Inferência:** forte adequação ao monólito modular e legibilidade por agentes; custo inicial médio por decorators/DI/boilerplate. | Mais abstração que uma API pequena; desempenho deve ser medido, não presumido; fronteiras de domínio ainda dependem de disciplina. |
| **NestJS + Fastify** | Mesma organização Nest, plataforma HTTP diferente [F09]. | Validação Nest permanece, mas middleware/pacotes Express podem não portar diretamente [F09]. | Capacidades Nest; instrumentação precisa ser compatível com adaptador. | **Inferência:** só justifica complexidade adicional se benchmark/requisito mostrar ganho relevante. | Incompatibilidades de middleware/receitas; otimização prematura para carga pessoal inicial. |
| **Fastify sem NestJS** | Plugins e encapsulamento permitem modularidade; excelente TS, mas arquitetura da aplicação é escolhida localmente [F10]. | Schema valida e serializa; autenticação/OpenAPI vêm de plugins oficiais/ecossistema [F10]. | Test runner e jobs/filas/telemetria precisam ser compostos. | Menor núcleo e baixa abstração; **inferência:** bom se a equipe definir convenções rígidas. | Mais decisões locais podem gerar variação e aumentar revisão por agentes; modularidade de domínio não vem pronta. |
| **AdonisJS** | Framework TypeScript integrado, com organização e IoC próprias [F11]. | Validação, auth e OpenAPI/ecossistema integrados [F11]. | Runner, scheduler e filas têm soluções documentadas [F11]. | Boa coesão e início produtivo; potencial para monólito modular. | Ecossistema/comunidade menores que alternativas mais difundidas; maior acoplamento às convenções e ao ORM do framework se adotado sem fronteiras. |
| **Backend integrado a full-stack** | Depende do framework; Next.js integra servidor ao app React [F12], enquanto uma solução Vue equivalente teria suas próprias convenções. | Útil para BFF e endpoints próximos à UI; capacidades de auth/validação/jobs variam e exigem composição. | Testes e observabilidade variam; execução serverless pode restringir processos longos/agendados. | Reduz repositórios/processos em produto pequeno, mas mistura ciclo de UI e domínio. | Para cliente Vue + Android, a vantagem de integração pode desaparecer; acoplamento à plataforma de renderização/deploy e fronteiras menos claras. |

### 4.3 Next.js não é automaticamente equivalente a NestJS

**Fato documentado:** Next.js se define como framework React para aplicações web full-stack e oferece renderização, roteamento e Route Handlers [F12]. NestJS se define como framework de aplicações Node.js escaláveis e estrutura backend com módulos, providers, transports e técnicas dedicadas [F09]. Portanto, ambos podem responder HTTP, mas resolvem centros de gravidade diferentes.

**Inferência:** Next.js teria vantagem real se React/Next fosse o frontend, se SSR/Server Components fossem necessários e se a API fosse principalmente um BFF coimplantado. Nenhuma dessas condições está aprovada; o cliente favorece Vue e inclui aplicativo Android. Next.js não deve ser tratado como substituto automático de modularidade de domínio, tarefas persistentes, filas ou API independente. Um framework full-stack Vue só deve avançar se demonstrar redução operacional sem acoplar o núcleo financeiro ao ciclo da interface.

## 5. Persistência

### 5.1 Princípios monetários

**Fato documentado:** PostgreSQL oferece tipos `numeric/decimal` de precisão exata, transações, constraints e controle de concorrência [F13]. SQLite oferece transações ACID e constraints, mas serializa escritas e usa tipagem dinâmica; seu tipo NUMERIC não é um decimal financeiro arbitrário nativo [F14].

**Inferência:** o ADR de persistência deve definir moeda, unidade de armazenamento e arredondamento. Mesmo com `numeric`, regras financeiras não podem depender de defaults do ORM ou de `number` binário. Testes devem provar atomicidade, concorrência e somas exatas.

### 5.2 Comparação conceitual

| Categoria | Integridade, transações e dinheiro | Concorrência e evolução | Local, hospedagem e backup | Lock-in e riscos |
|---|---|---|---|---|
| **PostgreSQL** | Constraints, chaves, transações e `numeric` exato [F13]. | MVCC e múltiplas conexões/escritores; caminho natural para múltiplos usuários [F13]. | Requer servidor local/contêiner ou serviço; ferramentas oficiais de dump/restore e backup físico [F13]. | Banco aberto e portável entre operadores; ainda há diferenças de extensões e operação. Complexidade maior que arquivo local. |
| **SQLite principal** | ACID e FKs quando habilitadas; tipagem dinâmica e uma escrita por vez exigem disciplina [F14]. Dinheiro pode usar inteiro na menor unidade com limites explícitos. | Bom para processo/dispositivo único; concorrência de escrita e topologia multi-instância limitam backend hospedado [F14]. | Execução local simples e arquivo copiável, mas backup consistente exige API/procedimento apropriado [F14]. | Baixo lock-in, alta simplicidade; migração futura e diferenças semânticas podem custar se o alvo real for PostgreSQL. |
| **Solução gerenciada proprietária** | Pode encapsular banco relacional e oferecer auth/API; garantias dependem do produto e plano. | Pode acelerar início e escalar operacionalmente. | Backups, observabilidade e ambientes podem ser oferecidos pelo fornecedor. | Maior dependência de APIs, políticas, limites, exportação e disponibilidade. Sem fornecedor concreto, não é possível verificar precisão, transações, recuperação nem portabilidade. |

**Inferência:** para online-first com API hospedada, PostgreSQL merece validação como baseline, mas não fica aprovado. SQLite só deve permanecer como principal se teste de topologia, concorrência, backup e evolução demonstrar que suas restrições são aceitáveis. Serviço proprietário exige avaliação posterior de portabilidade e contrato, sem confundir “gerenciado” com “proprietário”.

## 6. Acesso a dados

**Fatos documentados.** Prisma oferece schema declarativo, client gerado, migrations e APIs de transação [F15]. Drizzle fornece ORM TypeScript com SQL próximo do banco e kit de migrations [F16]. TypeORM usa entidades/decorators, migrations e transações, suportando múltiplos bancos [F17]. Bibliotecas como Kysely fornecem query builder SQL tipado e deixam migrations/driver e detalhes de execução mais explícitos [F18].

| Opção | Migrations e geração | Tipagem, SQL e transações | Testes, maturidade e revisão | Riscos financeiros |
|---|---|---|---|---|
| **Prisma** | Migrate gera histórico SQL; client é gerado a partir do schema [F15]. | API fortemente tipada e transações; escape para SQL bruto [F15]. | Convenções e schema central ajudam agentes; geração adiciona etapa e diffs de migration devem ser revisados. | Abstrações podem ocultar SQL/casts; confirmar suporte a decimal, isolamento, constraints e transações interativas no alvo. |
| **Drizzle** | Schema TypeScript e Drizzle Kit geram/aplicam migrations [F16]. | API próxima de SQL, tipos inferidos e transações [F16]. | Diffs tendem a ser transparentes; ferramenta mais jovem que opções históricas, exigindo validar estabilidade do fluxo escolhido. | Proximidade de SQL não elimina erro; revisar precisão, migrations geradas e invariantes no banco. |
| **TypeORM** | Entidades/decorators e migrations geradas ou escritas [F17]. | QueryBuilder, SQL e transações; tipos em runtime dependem de metadata/driver [F17]. | Maduro e abrangente; decorators e relações implícitas podem aumentar superfície de revisão. | Risco de cascatas, lazy/eager loading e migrations geradas inesperadas; exigir constraints e testes transacionais. |
| **SQL direto com biblioteca tipada** | Migrations geralmente explícitas por ferramenta/biblioteca; pouca ou nenhuma geração [F18]. | Máximo controle de SQL e tipos inferidos pelo builder, mas tipos TS não validam sozinhos o runtime [F18]. | SQL visível favorece auditoria; exige competência em PostgreSQL e convenções próprias. | Maior chance de erro manual e repetição; maior capacidade de declarar locks, isolamento, `numeric` e constraints precisamente. |

**Conclusão de pesquisa, não decisão:** nenhuma opção é escolhida. A prova comparativa deve implementar somente um recorte descartável: migration com constraints, valor monetário, transferência atômica, concorrência, rollback e consulta agregada; comparar SQL produzido, diff, ergonomia de testes e comportamento de decimal.

## 7. Organização do repositório

**Fatos documentados.** pnpm workspaces administram múltiplos pacotes por `pnpm-workspace.yaml` [F19]. Turborepo adiciona grafo de tarefas e cache [F20]. Nx oferece workspace, grafo de projetos, cache e execução distribuída [F21].

| Opção | Contratos e comandos | CI/cache | Complexidade e adequação inicial | Riscos |
|---|---|---|---|---|
| **Monorepo pnpm simples** | Compartilhamento direto de contratos e pacotes; scripts recursivos/filtrados [F19]. | Sem cache sofisticado por padrão; CI pode executar filtros. | Menor configuração; **inferência:** adequada ao tamanho inicial e legível por agentes. | Builds podem crescer; fronteiras precisam ser impostas por dependências e testes. |
| **pnpm + Turborepo** | Mantém workspaces e acrescenta pipeline/grafo [F20]. | Cache local/remoto e execução incremental [F20]. | Complexidade moderada; valor aumenta quando tarefas ficam caras. | Configuração/cache incorretos podem reutilizar artefatos inválidos; serviço remoto é escolha adicional. |
| **Nx** | Grafo, generators e regras de workspace [F21]. | Cache e recursos avançados de CI [F21]. | Forte governança, porém maior modelo mental; pode exceder necessidade inicial. | Acoplamento às convenções/configuração Nx e atualizações do toolchain. |
| **Repositórios separados** | Contratos exigem publicação/versionamento ou duplicação. | Pipelines e permissões isoladas, sem cache compartilhado natural. | Útil para equipes/ciclos independentes; **inferência:** complexidade desnecessária no início. | Drift de contratos, coordenação de releases e mudanças multi-repo difíceis para agentes. |

Gatilhos para adicionar orquestrador depois: CI lenta medida, muitos pacotes, tarefas dependentes difíceis de coordenar ou necessidade comprovada de cache. Isso evita antecipar Turborepo/Nx sem impedir sua adoção.

## 8. Autenticação

**Fatos documentados.** OAuth 2.0 define autorização e OpenID Connect adiciona identidade; para aplicativos nativos, a prática atual usa navegador externo e Authorization Code com PKCE, não segredo embutido [F22][F23]. OWASP recomenda armazenamento seguro de senhas, gestão de sessões, recuperação resistente a abuso e reautenticação para eventos de risco [F24].

| Opção | Android/web e sessões | Segurança e recuperação | Custo/dependência | Evolução e riscos |
|---|---|---|---|---|
| **Própria no backend** | Pode usar cookie seguro na web e fluxo/token apropriado no app; exige desenho de CSRF, rotação e revogação. | Equipe implementa senha, verificação, rate limit, recuperação, auditoria e resposta a incidentes [F24]. | Sem tarifa de provedor, mas alto custo de engenharia/operação. | Controle e portabilidade altos; risco de segurança elevado para benefício pequeno no início. |
| **Provedor externo gerenciado** | OIDC/OAuth pode atender web e app nativo com PKCE [F22][F23]. | Pode fornecer MFA, recuperação e detecção, mas configuração continua sendo responsabilidade do produto. | Custo e disponibilidade externos; lock-in em SDK, modelo de usuário e exportação. | Acelera expansão; avaliar portabilidade, exclusão/exportação, incidentes e modo de testes antes de fornecedor. |
| **Apenas local no primeiro protótipo** | Credencial/estado somente no dispositivo ou ambiente local; não autentica de forma suficiente uma API pública online. | Evita fluxo remoto somente se o protótipo não expuser dados/serviço. Recuperação pode ser reset local. | Simples e sem provedor. | Aceitável apenas para protótipo descartável e isolado; cria falsa segurança se publicado ou conectado. Migração de identidade deve ser planejada. |

**Inferência:** “um usuário” reduz UX e administração, não elimina autorização no backend. Toda entidade futura deve poder pertencer a um sujeito/espaço sem que o protótipo finja que uma API pública é privada. Nenhuma categoria ou fornecedor fica escolhido.

## 9. Hospedagem e operação

| Categoria | Deploy, secrets e logs | Backup e teste | Custo operacional/manutenção | Riscos e condições |
|---|---|---|---|---|
| **Plataforma gerenciada para API** | Deploy integrado, secrets e logs normalmente oferecidos; capacidades variam. | Ambientes de preview/teste podem existir; banco requer estratégia separada. | Baixa carga operacional, com limites de runtime e plataforma. | Lock-in de configuração, cold start, jobs e conexões; verificar suporte a processos persistentes e região. |
| **Contêiner gerenciado** | Imagem portável; plataforma cuida de agenda/instâncias em graus diferentes. | Facilita paridade e ambiente de teste; backups continuam externos ao contêiner. | Operação média: imagem, patches, health checks e escala. | Mais configuração que PaaS; armazenamento efêmero, rede e observabilidade precisam ser explícitos. |
| **Servidor próprio** | Controle total de processo, rede, secrets e logs. | Permite ambiente próprio, mas backup/restauração e isolamento são responsabilidade integral. | Maior carga: patches, firewall, TLS, monitoramento, capacidade e incidentes. | Ponto único de falha e manutenção incompatível com simplicidade, salvo motivação comprovada. |
| **PostgreSQL gerenciado** | Credenciais, TLS, métricas e manutenção geralmente oferecidos; detalhes variam. | Backups/PITR e instâncias de teste dependem do serviço/plano. | Reduz administração do banco; custo recorrente e limites. | Verificar restauração real, exportação, versões suportadas, regiões, extensões, limites de conexão e lock-in. |

**Inferência:** combinação inicial de API gerenciada ou contêiner gerenciado com PostgreSQL gerenciado parece uma categoria coerente para baixa operação, mas não está aprovada. O ADR deve comparar requisitos mínimos, não promoções: restore testado, secrets fora do Git, logs sanitizados, deploy reversível, migração controlada, ambiente de teste isolado, região e orçamento sustentável.

## 10. Matriz de decisão proposta

### 10.1 Critérios e pesos

Os pesos abaixo são **proposta para discussão**, não decisão. Somam 100 e devem ser ratificados antes de pontuar alternativas. Critérios como segurança e integridade podem virar barreiras eliminatórias em vez de compensáveis.

| Critério | Peso proposto | Como evidenciar |
|---|---:|---|
| Adequação funcional | 15 | Protótipo dos fluxos e atendimento às plataformas/regras. |
| Compartilhamento Android/web | 12 | Percentual real de código e testes comuns, sem contar adaptações inevitáveis. |
| Familiaridade | 8 | Capacidade demonstrada de manter e depurar, não preferência declarada. |
| Maturidade | 8 | Documentação, manutenção, compatibilidade e política de releases. |
| Testabilidade | 10 | Unitário, integração, contrato, E2E e execução determinística. |
| Segurança | 12 | Threat model, defaults, atualizações, autenticação/autorização e secrets. |
| Complexidade operacional | 10 | Quantidade de serviços, passos de deploy/restore e plantão necessário; menor é melhor. |
| Custo inicial | 5 | Custo sustentável total, sem preço promocional. |
| Lock-in | 5 | Esforço verificável de exportar/migrar código, dados e identidade; menor é melhor. |
| Capacidade de evolução | 8 | Mudanças para iOS, múltiplos usuários, filas e escala sem reescrita presumida. |
| Manutenção por agentes | 7 | Tipagem, convenções, feedback rápido, contexto e clareza dos diffs. |
| **Total** | **100** | — |

### 10.2 Aplicação preliminar sem ranking artificial

Não há medições suficientes para notas numéricas defensáveis. A matriz abaixo expõe tendências a validar, sem somar “vencedores”.

| Família | Evidências fortes | Trade-offs decisivos ainda abertos |
|---|---|---|
| Quasar/Capacitor | Vue/TS, alvos web/mobile integrados, componentes e caminho iOS/Android. | UX e acessibilidade reais, peso do framework, plugins e builds de loja. |
| Ionic Vue/Capacitor | Vue/TS, foco mobile, web e runtimes de loja. | Web Components, identidade visual/desempenho e diferença prática frente a Quasar. |
| PWA/TWA | Menor superfície e máxima reutilização web. | Recursos nativos, experiência/limites da TWA e preservação de iOS. |
| Flutter | Base multiplataforma e toolkit móvel coeso. | Dart/toolchain, qualidade web/DOM e custo de duas linguagens. |
| React Native | Experiência móvel e ecossistema amplos. | Estratégia web adicional, React e maior número de decisões. |
| NestJS padrão | Fronteiras explícitas e conjunto completo para API modular. | Boilerplate e necessidade real das abstrações. |
| NestJS/Fastify ou Fastify | Potencial de menor overhead e plugins/schema. | Ganho medido versus compatibilidade/convenções adicionais. |
| AdonisJS | Integração coesa e TypeScript. | Ecossistema, acoplamento e experiência disponível. |
| Full-stack | Coimplantação e possível redução inicial. | Encaixe com Vue/Android e independência do domínio. |
| PostgreSQL | Integridade, concorrência, decimal e evolução. | Operação local/hospedada e custo. |
| SQLite | Simplicidade local. | Escrita concorrente, semântica monetária e migração para serviço online. |
| Gerenciado proprietário | Menor montagem potencial. | Portabilidade, garantias verificáveis, custo e dependência. |

Antes de qualquer pontuação, o grupo decisor deve definir escala, evidência mínima, tratamento de incerteza e critérios eliminatórios. Sem isso, pesos produzem precisão aparente, não decisão informada.

## 11. Arquiteturas candidatas para validação

Nenhuma candidata é escolhida ou aprovada. São composições coerentes para orientar provas de conceito e ADRs; acesso a dados e autenticação permanecem deliberadamente abertos.

### 11.1 Candidata A — cliente Vue híbrido e monólito modular TypeScript

**Composição:** Vue 3 + Quasar + Capacitor para Android/web e possibilidade futura de iOS; API NestJS com adaptador padrão inicialmente; PostgreSQL; monorepo pnpm simples; acesso a dados a decidir; autenticação a decidir; implantação em API/contêiner gerenciado com PostgreSQL gerenciado a avaliar.

**Justificativa (inferência):** maximiza a familiaridade Vue/TypeScript e compartilhamento, enquanto NestJS oferece fronteiras explícitas para manter o núcleo financeiro determinístico em um monólito modular. PostgreSQL fornece controles relacionais/transacionais adequados à validação financeira, e pnpm simples evita orquestração antecipada.

**Riscos:** UX híbrida ou acessibilidade insuficiente; dependência de plugins; superfície Quasar/Capacitor; boilerplate Nest; erros de decimal/ORM; monorepo perder fronteiras; operação do PostgreSQL; autenticação ficar tardia.

**Dúvidas:** Quasar ou Ionic entrega melhor protótipo? Quais recursos nativos são reais? Express satisfaz carga/observabilidade? Qual acesso a dados preserva SQL e precisão? Qual modelo de sessão funciona em web e app? Quais metas de restore e disponibilidade?

**Rejeitar se:** build assinado/loja ou iOS futuro não for sustentável; protótipo falhar em UX, acessibilidade ou desempenho; plugins críticos forem inviáveis; modularidade Nest gerar custo sem benefício; PostgreSQL não puder ser operado/restaurado no orçamento; compartilhamento real for baixo.

**ADRs necessários:** ADR-001, ADR-002, ADR-003, ADR-004, ADR-005, ADR-006, ADR-007, ADR-008, ADR-009 e ADR-010 descritos em 11.3.

### 11.2 Candidata B — Ionic Vue e API Fastify explícita

**Composição:** Ionic Vue + Capacitor para Android/web e possibilidade futura de iOS; Fastify sem NestJS organizado como monólito modular por convenções documentadas; PostgreSQL; monorepo pnpm simples; acesso a dados e autenticação a decidir; mesmas categorias gerenciadas de implantação a avaliar.

**Justificativa (inferência):** preserva Vue/TypeScript e compartilhamento, troca o design system por componentes mobile do Ionic e reduz abstrações do backend. Pode ser adequada se o protótipo demonstrar melhor UX Ionic e se um esqueleto Fastify mínimo provar fronteiras claras com menos complexidade.

**Riscos:** Web Components/testes; UI web parecer excessivamente móvel; arquitetura Fastify virar convenção local inconsistente; composição manual de validação, auth, OpenAPI, jobs e observabilidade; plugins e PostgreSQL mantêm riscos da candidata A.

**Dúvidas:** qualidade comparativa Ionic/Quasar; custo real de manter convenções Fastify; plugins oficiais suficientes; como impedir dependências cruzadas entre módulos; comportamento sob tarefas e futuras filas.

**Rejeitar se:** protótipo web/móvel ou acessibilidade falhar; agentes produzirem estrutura inconsistente; a montagem de capacidades superar a simplicidade alegada; recursos Nest necessários tiverem de ser recriados; qualquer critério financeiro/transacional não for demonstrado.

**ADRs necessários:** o mesmo conjunto abaixo, com evidência específica que compare esta candidata à A.

### 11.3 ADRs esperados posteriormente

Não criar estes ADRs nesta tarefa:

1. **ADR-001 — arquitetura geral e monólito modular:** fronteiras, dependências permitidas e critérios para extrair serviços.
2. **ADR-002 — aplicação cliente:** Quasar, Ionic, PWA/TWA, Flutter ou React Native; evidências do protótipo Android/web/acessibilidade.
3. **ADR-003 — backend:** framework, adaptador HTTP, validação, contratos, jobs e observabilidade.
4. **ADR-004 — persistência:** PostgreSQL/alternativa, precisão monetária, constraints, isolamento, backup e restore.
5. **ADR-005 — acesso a dados:** migrations, transações, SQL auditável, decimal e estratégia de testes.
6. **ADR-006 — organização do repositório:** workspaces, contratos, comandos, fronteiras e gatilhos para cache/orquestrador.
7. **ADR-007 — autenticação:** identidade, sessões web/app, autorização, recuperação e eventual provedor.
8. **ADR-008 — estratégia online-first:** falhas de rede, idempotência, cache não autoritativo e limites de offline.
9. **ADR-009 — hospedagem inicial:** categoria, ambientes, secrets, logs, deploy/rollback, backups e custo sustentável.
10. **ADR-010 — fronteira para recursos de IA:** isolamento do núcleo, auditoria, consentimento, dados e falhas seguras.

## 12. Fontes oficiais consultadas

Todas as fontes abaixo foram consultadas em **2026-08-04**. Páginas “latest/current” podem mudar; o ADR deverá reconfirmá-las. Não foram usados blogs genéricos como fonte principal.

| ID | Fonte oficial | Assunto usado |
|---|---|---|
| F01 | [Vue — Guide, TypeScript e Testing](https://vuejs.org/guide/introduction.html) | Componentes, TypeScript e estratégia de testes. |
| F02 | [Quasar — Introduction e Accessibility](https://quasar.dev/introduction-to-quasar/) | Modos, componentes e acessibilidade. |
| F03 | [Quasar — Developing Capacitor Apps](https://quasar.dev/quasar-cli-vite/developing-capacitor-apps/introduction/) | Integração do modo Capacitor. |
| F04 | [Capacitor — Documentation](https://capacitorjs.com/docs) | Android, iOS, PWA, plugins e APIs nativas. |
| F05 | [Ionic — Vue Overview](https://ionicframework.com/docs/vue/overview) | Ionic Vue, Capacitor, plataformas e componentes. |
| F06 | [Android Developers — Trusted Web Activities](https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities) | Funcionamento, navegador e associação de TWA. |
| F07 | [Flutter — Multiplatform, Testing e Accessibility](https://docs.flutter.dev/reference/supported-platforms) | Alvos, testes e acessibilidade do Flutter. |
| F08 | [React Native — Introduction e Environment Setup](https://reactnative.dev/docs/getting-started) | Componentes nativos, plataformas e recomendação de framework. |
| F09 | [NestJS — Documentation](https://docs.nestjs.com/) | Módulos, providers, validação, auth, OpenAPI, testes, Fastify, scheduler, filas e observabilidade. |
| F10 | [Fastify — Documentation](https://fastify.dev/docs/latest/) | Plugins, encapsulamento, TypeScript, validação e serialização. |
| F11 | [AdonisJS — Documentation](https://docs.adonisjs.com/) | TypeScript, validação, autenticação, testes e recursos integrados. |
| F12 | [Next.js — Documentation](https://nextjs.org/docs) | Framework React full-stack, App Router e Route Handlers. |
| F13 | [PostgreSQL — Current Documentation](https://www.postgresql.org/docs/current/) | Numeric, constraints, transações, MVCC, backup e restore. |
| F14 | [SQLite — Documentation](https://www.sqlite.org/docs.html) | ACID, tipagem, concorrência, foreign keys e backup. |
| F15 | [Prisma ORM — Documentation](https://www.prisma.io/docs/orm) | Schema, Client, Migrate, SQL e transações. |
| F16 | [Drizzle ORM — Documentation](https://orm.drizzle.team/docs/overview) | Schema TypeScript, queries, transações e Drizzle Kit. |
| F17 | [TypeORM — Documentation](https://typeorm.io/docs/) | Entidades, migrations, QueryBuilder e transações. |
| F18 | [Kysely — Documentation](https://www.kysely.dev/docs/intro) | Exemplo oficial de query builder SQL tipado. |
| F19 | [pnpm — Workspaces](https://pnpm.io/workspaces) | Workspaces, pacotes e comandos. |
| F20 | [Turborepo — Documentation](https://turborepo.com/docs) | Grafo de tarefas e cache. |
| F21 | [Nx — Documentation](https://nx.dev/docs) | Workspaces, grafo e cache. |
| F22 | [IETF RFC 8252 — OAuth 2.0 for Native Apps](https://www.rfc-editor.org/rfc/rfc8252) | Navegador externo e fluxo para apps nativos. |
| F23 | [OpenID Foundation — OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html) | Camada de identidade sobre OAuth 2.0. |
| F24 | [OWASP — Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) | Senhas, sessões, recuperação e reautenticação. |

## 13. Verificações de encerramento da pesquisa

- [x] Confirmado por Git que somente `docs/research/TECHNICAL-ARCHITECTURE-EVALUATION.md` foi alterado.
- [x] Fontes oficiais, URLs e data de consulta registradas.
- [x] Fatos documentados, inferências e dúvidas diferenciados.
- [x] Nenhuma tecnologia ou arquitetura declarada aprovada/escolhida.
- [x] Nenhuma versão exata decidida.
- [x] Nenhuma aplicação, dependência, banco, CI, ADR ou SPEC criada.
- [x] No máximo duas candidatas apresentadas, ambas condicionais.
