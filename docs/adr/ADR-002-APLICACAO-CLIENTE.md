# ADR-002 — Aplicação cliente

## Status

Aprovado

## Data

2026-08-05

## Contexto

O produto precisa atender Android como plataforma principal inicial e web responsiva no MVP, preservando possibilidade futura de iOS. A pesquisa técnica avaliou alternativas de cliente considerando Vue, Quasar, Capacitor, PWA/TWA, Flutter e React Native.

## Problema

É necessário escolher a base cliente inicial sem criar o scaffold, definindo como Android e web compartilharão implementação e quais limitações devem ser consideradas nas próximas SPECs.

## Decisão

Adotar Vue 3, Quasar e Capacitor para uma base principal compartilhada entre web responsiva e Android. Android será a plataforma principal inicial. A possibilidade futura de iOS deve ser preservada. PWA pode existir como consequência da aplicação web, mas não substitui o aplicativo Android.

## Justificativa

Vue 3 e TypeScript favorecem componentes testáveis e manutenção incremental. Quasar oferece estrutura para web responsiva e empacotamento mobile com uma base Vue. Capacitor preserva caminho para Android e iOS sem exigir reescrita imediata. A decisão equilibra reaproveitamento de código com publicação Android nativa.

## Alternativas consideradas

- Ionic Vue com Capacitor: alternativa viável, mas a decisão aprovada prioriza Quasar.
- PWA/TWA como solução principal Android: rejeitada porque não substitui o aplicativo Android aprovado.
- Flutter: rejeitado por exigir stack principal diferente e aumentar custo de adoção inicial.
- React Native: rejeitado por não alinhar com a preferência por Vue e compartilhamento web inicial aprovado.

## Consequências positivas

- Base compartilhada entre web responsiva e Android.
- Caminho futuro preservado para iOS.
- Menor duplicação de interface no MVP.
- Ecossistema TypeScript alinhado ao restante da arquitetura.

## Consequências negativas

- Diferenças entre web, Android e iOS exigirão testes específicos.
- Plugins nativos podem demandar código específico de plataforma.
- A experiência visual dependerá do uso correto do design system e dos padrões mobile.

## Riscos

- Plugins nativos podem ter limitações, divergências de suporte ou comportamento diferente entre Android e iOS.
- WebView, teclado, permissões, navegação e ciclo de vida podem gerar diferenças sutis entre plataformas.
- A preservação de iOS não garante publicação sem validações futuras em dispositivos e loja.

## Condições de revisão

Revisar esta ADR se Quasar ou Capacitor não atenderem fluxos Android essenciais, se requisitos nativos superarem a capacidade de plugins, se iOS se tornar objetivo de curto prazo com restrições específicas ou se o compartilhamento web/mobile gerar custo maior que benefício.

## Impacto nas próximas SPECs

SPECs de interface devem considerar responsividade, comportamento Android real, acessibilidade, testes por plataforma e limites de plugins. Nenhuma SPEC deve tratar PWA como substituto do app Android aprovado.

## Referências à pesquisa técnica

- `docs/research/TECHNICAL-ARCHITECTURE-EVALUATION.md`, especialmente a comparação de aplicação cliente e as evidências sobre Vue, Quasar, Capacitor, PWA/TWA, Flutter e React Native.
