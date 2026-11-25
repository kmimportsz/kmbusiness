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
| Perda de dados zero | B backup e conferência em ambiente real |
| Pedidos duplicados zero | T V · C e F nos cenários cobertos; B validação real |
| Novos custos recorrentes zero | Nenhum serviço pago adicionado no PR; B estimativa de volume e limites da infraestrutura real |
| Homologação Firestore | B regras reais, projeto e operador de homologação |
| Homologação Worker | B ambiente isolado com credenciais, catálogo e provedor de frete de homologação |
| Backup verificável e reversão | B acesso autorizado aos dados e configuração reais |
| Parecer da IA Pessoal | B encaminhamento registrado, parecer independente pendente |
| Publicação nos endereços originais e conferência pós-publicação | B condicionada aos itens técnicos e ao parecer independente |

## Preparação do backup, liberação e reversão

1. Registrar o SHA atual do GitHub Pages, a versão ativa do Worker e a revisão do ruleset do Firestore. Exportar as regras vigentes, os registros protegidos de Firestore e os dados e imagens do catálogo, com armazenamento controlado pelo proprietário. Registrar contagens, carimbo de tempo e SHA-256 dos arquivos fora do repositório. A conferência deve incluir restauração de amostra em ambiente separado e comparação das contagens e hashes.
2. Homologar com credenciais fornecidas pelo mecanismo oficial da infraestrutura, separadas de produção, e validar conciliação de dados, permissões, integração e pagamentos. Vincular o parecer da IA Pessoal ao SHA efetivamente revisado.
3. Com a liberação técnica concluída, ativar regras e Worker antes do cliente, testar o contrato e publicar somente a candidata aprovada. Conferir os dois endereços originais, o SHA servido, a saúde do endpoint e a integridade dos registros.
4. Em regressão, restaurar a versão anterior do cliente e do Worker. Preservar os pedidos, vendas e recebimentos novos. Qualquer retorno do ruleset deve preservar a autorização necessária aos registros já criados e ser conferido antes de aplicar. Manter disponível o tratamento dos pedidos recebidos.

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
