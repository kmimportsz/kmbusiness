# NEXUS · Checklist de aceite e liberação

Candidata no [PR #3](https://github.com/kmimportsz/kmbusiness/pull/3). Escopo consolidado da [issue #2](https://github.com/kmimportsz/kmbusiness/issues/2), dos seus oito comentários de requisitos no momento da revisão e do pedido final do proprietário. O [NEXUS](https://github.com/kmimportsz/IApessoal/issues/18) registra a solicitação de revisão independente.

**I** Implementada · **T** Testada · **V** Validada no ambiente indicado · **A** Aprovada visualmente pelo proprietário · **P** Pendente · **B** Bloqueada. As marcas podem coexistir. Validação local ou emulada não constitui homologação de produção.

Evidências por ambiente: **C** suíte `catalogo/source`, **R** suíte da raiz, **U** navegador Chromium/WebKit com dados controlados, **F** Firestore Emulator com regras candidatas. Consulte os [roteiros, capturas e vídeos](NEXUS-AUDITORIA.md).

## Menu, sacola e descoberta

| Critério | Estado e evidência |
| --- | --- |
| Barra antiga removida | I T V · U |
| Formato horizontal arredondado, dimensões compactas e posição | I T V A · U |
| Safe-area e alvos de pelo menos 44 CSS px | I T V · U mede alvos; P · iPhone físico |
| Início | I T V · U |
| Buscar | I T V · U |
| Sacola | I T V · U |
| Menu | I T V · C |
| Iluminação azul da função ativa | I T V · U |
| Contorno fechado, neon contínuo, raios, esfera, halo e faíscas | I T V A · U, SVG e evidência animada |
| Velocidade cerca de 30% menor | I T V · U verifica 5,143 s, antes 3,6 s |
| Neon adaptativo ao rolar e navegar | I T V · U |
| Pausa em aba oculta | I · P em dispositivo físico |
| Movimento reduzido | I T V · U |
| Menu e modais sem sobrepor ações | I T V · U; P em dispositivo físico |
| Miniatura à sacola e pulso elétrico | I T V · U |
| Contador animado com atualização imediata | I T V · U |
| Soma de unidades, remoção, redução, zero e restauração | I T V · U e C |
| Feedback de adição e remoção sem anúncio duplicado | I T · U; P leitor de tela físico |
| Desfazer remoção | I T V · U |
| Compra rápida | I T V · U; P verificação em Safari físico |
| Compartilhar sacola | I T V · U cobre URL e cópia; P folha de compartilhamento no Safari físico |
| Restaurar sacola na navegação ou após falha | I T V · U e C |
| Revalidar disponibilidade e preços | I T V · C e F; B Worker real |
| Revalidar quantidades | I T V · C e F |
| Favoritos, coração e persistência | I T V · U |
| Limpar favoritos e histórico | I T V · U |
| Comparação, limite e detalhes | I T V · U |
| Visualizados recentemente | I T V · U |
| Busca contextual, acentos e tolerância a erros | I T V · C e U |
| Sugestões e histórico opcional de pesquisa | I T V · U inclui opt-in, histórico e limpeza |
| Filtros de seleção, marca, tamanho, preço e disponibilidade | I T · C e U; P verificação individual das combinações recentes |
| Preferências opcionais do nome e da sacola | I T V · C e U |
| Compartilhar produto e URL de detalhes | I T V · C; P folha de compartilhamento no iPhone |
| Zoom de fotografia | I T V · U |
| Guia de medidas por dados reais | I T · U com atributo fictício; P verificação de ficha com dados reais se disponíveis |
| Modo convidado | I T V · U |
| Cabeçalho adaptativo | I T V · U |
| Gestos de navegação e zoom | I · P toque físico |
| Central de ajuda | I T V · C |
| Restauração exata de rolagem e foco dos detalhes | I T V · U; P iPhone físico |

## Checkout e operação

| Critério | Estado e evidência |
| --- | --- |
| Indicador de progresso e revisão editável | I T · U; P conferência em aparelho físico |
| Preenchimento opcional e limpeza | I T V · U cobre gravação condicionada e remoção |
| Retirada, entrega e frete recalculado | I T V · C e F; B provedor do Worker real |
| Pedido registrado no servidor antes do sucesso | I T V · F; B Worker real |
| Timeout e retry com chave preservada | I T V · C, U e F |
| Cliques concorrentes e pedidos duplicados | I T V · C, U e F |
| Círculo azul, transição verde e check progressivo | I T V · U e vídeo |
| Mensagem animada “Pedido efetuado com sucesso!” | I T V · U |
| Código de pedido copiável | I T V · U para clipboard; P fallback em iPhone físico |
| Voltar ao catálogo | I T V · U |
| WhatsApp opcional, sem abertura automática | I T V · U |
| Mensagem com campos preenchidos e valores do servidor | I T V · C e U |
| Dashboard original | I T V · R |
| Aba Pedidos independente | I T V · U |
| Contador de pendentes em tempo real | I T V · F e U |
| Som opcional e deduplicado | I · P verificação sonora com permissão em aparelho |
| Cancelar com histórico e sem venda | I T V · F |
| Confirmar e criar uma venda atômica | I T V · F e U |
| Baixa e reversão por diferença de estoque em edição | I T V · F |
| Identificação de venda manual ou catálogo | I T · U cobre origem de catálogo; P confirmação visual individual de venda manual |
| Edição de cliente, itens, quantidade, preço, custo, desconto, frete, data, notas e condições | I T · F cobre atualização, quantidades, valores e revisão concorrente; P teste individual de todos os campos |
| Total, margem e lucro recalculados | I T V · F e R |
| Revisão concorrente sem sobrescrever | I T V · F |
| Cobranças explícitas com valor, data e campos comerciais | I T V · F e U |
| Proteção de recebimentos efetivados | I T V · F com rejeição de alteração e exclusão |
| Independência entre pedido, venda e cobrança | I T V · F e U |
| Autorização de operador e isolamento de pedidos de anônimos | I T V · F; B regras reais |
| Preservação de vendas, estoque, clientes, produtos, imagens, recebimentos, despesas, histórico e configurações | T · R e F cobrem regressões locais; B comparação de snapshots reais |
| Preservação de autenticação, permissões, sincronização e integrações | T · R e F; B homologação real |
| PR #1 e diretório `trial/` preservados | T V · refs do GitHub e diff com main |

## Qualidade e liberação

| Critério | Estado e evidência |
| --- | --- |
| Fundo preto, azuis, banner e tipografia originais | I T V A · U e diff |
| Hierarquia visual, responsividade e uso do espaço | I T V · U em 320 e 1280 px; P aparelho físico |
| Skeleton e carregamento progressivo de imagens | I T · C e U; P conexão lenta real com catálogo completo |
| Microinterações sem bloquear cliques | I T V · U |
| Sem limite artificial de 60 FPS | I T · inspeção de CSS/SMIL e Web Animations; P medição física a 120 Hz |
| Memória, bateria e conexões lentas | P medição em aparelho |
| Lighthouse Performance ≥ 95, Acessibilidade 100, Boas práticas 100 | T V · 98 / 100 / 100 em Lighthouse mobile local. B medição no ambiente definitivo |
| Perda de dados zero | B comparação de dados antes e depois de eventual liberação no ambiente real |
| Pedidos duplicados zero | T V · C e F nos cenários cobertos; B validação real |
| Novos custos recorrentes zero | Nenhum serviço pago adicionado no PR; B estimativa de volume e limites da infraestrutura real |
| Homologação Firestore | B regras reais, projeto e operador de homologação |
| Homologação Worker | B ambiente isolado com credenciais, catálogo e provedor de frete de homologação |
| Backup Firestore de produção e restauração isolada | V · 137 documentos, SHA-256 e restauração confirmados pelo proprietário |
| Cópia criptografada no iPhone | V · SHA-256 do arquivo baixado no iPhone confirmou o SHA-256 do Cloud Shell |
| Reversão no ambiente real | B homologação da configuração e conferência antes da liberação |
| Parecer da IA Pessoal | B encaminhamento registrado, parecer independente pendente |
| Publicação nos endereços originais e conferência pós-publicação | B condicionada aos itens técnicos e ao parecer independente |

## Evidência do backup de produção

O proprietário confirmou a exportação de 137 documentos, a conferência do SHA-256 dos dados, a restauração isolada e o download no iPhone da cópia AES-256. O original permanece privado no Cloud Shell, com faturamento desativado. O proprietário calculou o SHA-256 do arquivo `.gpg` no Atalhos do iPhone e confirmou que coincide com o hash do mesmo arquivo no Cloud Shell. A verificação da cópia baixada está concluída. O manifesto registra separadamente o hash do arquivo criptografado e o dos dados exportados.

A evidência registra os resultados informados pelo proprietário. O arquivo e a senha permanecem fora do Git. A homologação real do Firestore e do Worker, a conciliação dos dados, o parecer independente e o aceite continuam condicionando a liberação. [Registro do backup de produção](nexus-evidencias/backup-firestore-producao.json)

## Preparação do backup, liberação e reversão

### Sequência de publicação e reversão

1. Antes da publicação, registrar o SHA servido pelo GitHub Pages, a versão ativa do Worker, a revisão das regras e o inventário privado do R2. Vincular as evidências de aceite e o parecer independente ao SHA candidato. O backup Firestore aprovado permanece válido como evidência. Uma eventual atualização do backup só será necessária se o intervalo ou alterações nos dados tornarem a cópia insuficiente para a janela de mudança.
2. Em homologação, aplicar regras e configuração do Worker isolados, validar o contrato, publicar a candidata no endereço privado e testar com dois operadores e um iPhone. Ensaiar ali a desativação do recebimento e a restituição do catálogo independente. Conferir os pedidos, vendas, recebimentos e estoque antes e depois.
3. Após o aceite final, aplicar e verificar regras, permissões e Worker antes do cliente. Conferir os endereços oficiais, o SHA servido, o catálogo, a experiência em Safari e os fluxos de operação. Registrar os horários e as versões.
4. Se houver regressão após receber pedidos, bloquear novas entradas no Worker, inclusive as de clientes com HTML em cache. Validar o fluxo de catálogo anterior com a mesma origem e o atendimento via WhatsApp. Reverter somente o cliente público e manter o Business e as regras que permitem aos operadores tratar pedidos já gravados. Reconciliar os registros pendentes com os administradores. Manter pedidos, vendas, recebimentos, estoque e objetos do bucket. A restauração integral do backup não faz parte da reversão rotineira.
5. Somente após concluir a conciliação, avaliar se algum componente administrativo ou ruleset precisa voltar à revisão anterior. Confirmar as permissões sobre todos os dados introduzidos desde a liberação antes de aplicar qualquer mudança.

### Ensaio local de reversão

A candidata `d82a2516270581b08c006cd29d8ae3b1f53010d4` e os arquivos da `main` `43742a39e3aae11f5b5493e22e86eeef1f5d36cc` serviram de referência. O Worker anterior foi compilado a partir da `main`. A versão efetivamente ativa no provedor ainda precisa ser identificada antes de uma reversão hospedada.

- Em Chromium local a 320, 390 e 1280 px, o catálogo anterior voltou ao fluxo de WhatsApp. A busca, favoritos, sacola e revisão passaram. O teste simulou backend e WhatsApp.
- Em workerd com Miniflare 4.20260730.0 e R2 isolado, a candidata recusou exportação anônima com HTTP 401 e registro sem Firestore configurado com 503. A versão anterior recusou a rota de pedidos com 404, manteve a leitura do catálogo e preservou os SHA-256 dos quatro objetos de teste.
- O ensaio cobre a reversão do catálogo e Worker locais. A validação hospedada ainda deve comprovar a operação das versões reais e a preservação dos pedidos e vendas existentes com as regras mantidas.

## Evidências dos ajustes finais

- [Vídeo da volta completa da trilha de neon](nexus-evidencias/neon-final.mp4). O vídeo amostra o deslocamento SVG ao longo de um ciclo. Ele demonstra o efeito visual e a duração; não mede a taxa de quadros num aparelho.
- [Resultados Lighthouse mobile local](nexus-evidencias/lighthouse-local.json). As notas evoluíram de 75/96/96 para 98/100/100. O LCP caiu de 6,5 s para 2,2 s. A medição usou a mesma demonstração isolada e dados fictícios, antes e depois da otimização da arte e da fonte originais. A homologação com Firestore, Worker, catálogo real e um iPhone físico permanece necessária.
- Os dois refinamentos foram avaliados sob os [requisitos de neon](https://github.com/kmimportsz/kmbusiness/issues/2#issuecomment-7174579723) e [os cinco refinamentos finais](https://github.com/kmimportsz/kmbusiness/issues/2#issuecomment-7174617460).

## Rodada de homologação adicional

O código executado é o commit `e14b53d09f76c517d9e771b95836a3c63c72c90a`. Nesta rodada, os commits de entrega de evidência acrescentam documentação e resultados, sem alterações de aplicação ou design.

- Passaram suíte da raiz, catálogo, build e verificação de sintaxe do Worker, Chromium, WebKit e Firestore Emulator. A suíte Trial falhou na primeira execução concorrente com outros testes em `trial/tests/app.cjs:18` (esperado 1, obtido 0) e passou na repetição separada. Causa não confirmada. O diretório Trial não foi alterado.
- O [Lighthouse mobile local](nexus-evidencias/lighthouse-homologacao.json) repetiu 98/100/100, com LCP de 2,18 s, na demonstração fictícia.
- O [registro de backup e restauração](nexus-evidencias/backup-homologacao.json) contém contagens e hashes. A base Firestore sintética de oito documentos foi restaurada em um segundo emulador vazio com SHA-256 idêntico. O ZIP de catálogo de teste foi restaurado em um bucket de teste que serviu catálogo e imagem através do Worker. Também foi feita uma cópia dos 18 produtos públicos e 18 imagens referenciadas do catálogo oficial. Os objetos da cópia e o manifesto foram conferidos no arquivo compactado, e o Worker isolado serviu o conteúdo restaurado. Os arquivos de backup permanecem fora do Git. Essa evidência cobre apenas o recorte público do catálogo oficial e a base Firestore sintética.
- [Checklist do iPhone físico](NEXUS-CHECKLIST-IPHONE.md) · [Passos para conceder acessos temporários](NEXUS-HOMOLOGACAO-ACESSO.md).

## Regressão após atualizar a candidata com a main

O catálogo independente do PR #4 segue publicado. Na candidata do PR #3, a resolução dos conflitos mantém o checkout integrado e a confirmação de pedido para a homologação. O verificador da candidata exige o endpoint de registro, a interface de confirmação e a igualdade entre a página pública e o arquivo-fonte.

Passaram a suíte da raiz, a suíte do catálogo, o build e a verificação de sintaxe do Worker. No Firestore Emulator local, a rodada com dois administradores testou regras, sincronização, concorrência na entrada de estoque, confirmação e cancelamento de pedidos, repetição segura, recebimentos e preservação do histórico. Os testes usaram dados sintéticos.

## Verificação final local e disponibilidade de homologação

A suíte do Business, a suíte do catálogo, o build e a checagem de sintaxe do Worker passaram. Um Firestore Emulator novo e restrito a loopback validou as regras candidatas, a sincronização com dois administradores, a concorrência de estoque, pedidos, recebimentos e histórico. A execução do Worker nesse teste usa R2 e OAuth de teste.

A consulta de leitura ao ambiente conectado não encontrou um Worker de homologação do K&M. O R2 da conta Cloudflare conectada retornou HTTP 403, código 10042. A prévia privada existente no Sites está acessível para inspeção, sem as variáveis `ORDER_FIRESTORE_PROJECT` e `ORDER_FIRESTORE_WRITER`. A homologação hospedada aguarda um projeto Firestore isolado e uma identidade de teste vinculada a essa prévia ou a outro Worker existente, com bucket isolado e sem dados de produção. O parecer independente do NEXUS e o aceite em iPhone físico continuam abertos. [Acessos necessários](NEXUS-HOMOLOGACAO-ACESSO.md)

## Apuração dos critérios obrigatórios

Cada um dos dez critérios tem peso igual. Só entra no percentual um critério integralmente comprovado.

| Critério | Estado |
| --- | --- |
| Todas as funcionalidades aprovadas | Parcial. Validação local e emulada registrada; falta a jornada hospedada e física. |
| Todos os testes obrigatórios aprovados | Parcial. Faltam os testes reais de aceite e do ambiente hospedado. |
| Homologação hospedada concluída | Pendente. Firestore, Worker e bucket isolados ainda precisam ser vinculados. |
| Auditoria independente concluída | Pendente. Parecer solicitado pelo NEXUS. |
| Nenhuma falha crítica ou relevante aberta | Pendente. Falta validar identidade de borda, permissões reais e proteção contra abuso no endpoint público. |
| Nenhuma regressão conhecida | Validação local registrada. Critério definitivo depende da regressão hospedada. |
| Nenhum bloqueio operacional pendente | Pendente. Acessos, parecer e teste físico. |
| Backup e recuperação validados | Aprovado para Firestore de produção, com restauração isolada e SHA-256 da cópia transferida confirmados pelo proprietário. O inventário privado do R2 pertence ao ensaio de reversão hospedado. |
| Compatibilidade móvel comprovada | Parcial. WebKit local passou na repetição; falta Safari em iPhone físico. |
| Procedimento de publicação e reversão validado | Parcial. Ensaio local passou; falta executar o procedimento com as versões e permissões hospedadas. |

Total integralmente aprovado: 1 de 10 (10%). A publicação continua condicionada à conclusão dos demais critérios e ao aceite final.

### OAuth e Firestore hospedado pelo Cloud Shell

O proprietário confirmou a execução do teste com a conta de serviço de
homologação contra o Firestore hospedado em `km-business-homologacao`.
OAuth, concorrência com a mesma chave, repetição, rejeição de conteúdo
diferente com a mesma chave e rejeição de origem inválida passaram. A
pendência desse teste está encerrada. [Evidência reportada pelo proprietário](nexus-evidencias/firestore-homologacao-cloud-shell.json)

O código do Worker rodou no Node.js, com catálogo sintético. A validação
da prévia e do runtime hospedado permanece aberta, incluindo segredo no
Sites, bucket isolado, autenticação dos operadores e jornada no Safari
físico. A inspeção da prévia confirmou o projeto de homologação configurado
e a ausência do segredo do Worker.
