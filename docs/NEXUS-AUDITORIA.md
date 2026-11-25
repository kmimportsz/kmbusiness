# NEXUS · Auditoria da issue #2

O escopo usa o Business na raiz e o catálogo em `/catalogo/`. A base `18b344a490525757ca2fb94c1c3b2475f4d8b125` contém a mesma página de catálogo servida pelo GitHub Pages no início da verificação. O SHA-256 de ambas as páginas era `9b6f2f0e03d846d12fcc2d73b727400a9f89a45a4a0b2a58647adb94ab27c1d6`. O diretório `trial/` foi comparado com a base, incluindo arquivos não rastreados. A branch e o histórico do PR #1 foram preservados. [Issue #2](https://github.com/kmimportsz/kmbusiness/issues/2) · [PR #1](https://github.com/kmimportsz/kmbusiness/pull/1)

## Contratos para revisar

- O Worker lê o catálogo existente no R2 e recalcula o frete com a rotina atual. O servidor cria um documento pendente no Firestore com uma chave do navegador e recupera a primeira resposta quando a mesma operação é repetida. A resposta pública inclui os dados necessários para o comprovante do pedido e para o WhatsApp opcional.
- O Business recebe os pedidos em tempo real em uma aba própria. A confirmação transaciona pedido, venda e estoque no Firestore. A venda nasce com `inst: []`. O cancelamento registra apenas o desfecho. O catálogo continua associado aos produtos do estoque por ID quando existe vínculo. Se não houver vínculo inequívoco, o operador precisa selecionar os produtos para conferência.
- As vendas criadas pelo fluxo novo usam revisão, trilha de alterações e diferenças de estoque. O total inclui preço, quantidade, desconto e frete. As cobranças e eventuais recebimentos entram por ação explícita com valores e datas informados. Os recebimentos pagos permanecem fixos nas edições de venda e de cobrança. O histórico anterior conserva seu formato e seu caminho de consulta.
- O catálogo tem revisão editável, confirmação animada e número copiável, menu flutuante, favoritos locais, comparação, busca aproximada, filtros rápidos e histórico opcional. O guia aparece quando o produto contém medições reais no formato `measurements: [{label, value, unit}]`, com unidade cm ou mm. Os registros existentes no catálogo continuam servindo como fonte. Nenhuma medida foi preenchida por estimativa.
- O checkout mantém nome e endereço na sessão da página durante falhas e novas tentativas. O armazenamento local só guarda o nome se escolhido expressamente, além das preferências e da sacola. Links compartilhados da sacola contêm apenas IDs e quantidades. Os dados para WhatsApp vêm da resposta do servidor. [Requisitos complementares de UX](https://github.com/kmimportsz/kmbusiness/issues/2#issuecomment-7170994775) · [Especificação do menu](https://github.com/kmimportsz/kmbusiness/issues/2#issuecomment-7171275908) · [Microanimação da sacola](https://github.com/kmimportsz/kmbusiness/issues/2#issuecomment-7171340880)

## Verificação isolada

```sh
npm ci
npm test
npm --prefix trial test
mkdir -p catalogo/source/work
npm --prefix catalogo/source test
npm --prefix catalogo/source run build
node --check catalogo/source/dist/server/index.js
```

O teste `tests/nexus-firestore.cjs` roda com `firebase` e `@firebase/rules-unit-testing` em um emulador local de Firestore. Use `FIRESTORE_EMULATOR_HOST=127.0.0.1:8787` ou ajuste a porta local. Ele direciona a chamada real do Worker ao emulador, com R2, OAuth e credenciais fictícios, e executa as transações do Business. Cobre autorização, resposta idempotente, concorrência, contador, estoque, cancelamento, frete divergente, revisão, recebimentos e isolamento de um registro legado.

O teste `tests/nexus-browser.cjs` roda com Playwright, um servidor estático na porta local 8855 e APIs simuladas. Use `KM_BROWSER=webkit` para testar WebKit. `KM_CHROMIUM_PATH` seleciona um executável de Chromium instalado e `KM_EVIDENCE_DIRECTORY` define a pasta das capturas. Inclui 320 px, desktop e movimento reduzido, recuperação após resposta perdida, clique repetido, WhatsApp opcional, favoritos, comparação, busca, zoom, medidas, reversão de remoção e contador no menu. O roteiro adicional soma dois modelos e três unidades em cliques rápidos, rejeita item indisponível, valida restauração, redução, remoção, desfazer e limpeza, verifica o anúncio acessível e compara o comportamento com movimento reduzido.

## Evidências visuais

- [Confirmação no desktop](nexus-evidencias/confirmacao-desktop.png) · [Confirmação no mobile](nexus-evidencias/confirmacao-mobile.png) · [Movimento reduzido](nexus-evidencias/movimento-reduzido.png)
- [Vídeo da confirmação](nexus-evidencias/confirmacao.mp4) · [Menu mobile](nexus-evidencias/menu-mobile.png) · [Vídeo do menu e da adição à sacola](nexus-evidencias/menu-e-sacola.mp4)
- [Aba Pedidos no Business](nexus-evidencias/business-pedidos.png)

## Checklist da microanimação

- [ ] Verificar na grade e na compra rápida que a miniatura ou o ícone segue em direção à Sacola, que a Sacola pulsa em azul e que o total muda no mesmo clique.
- [ ] Adicionar duas unidades de uma peça e uma de outra. Conferir o total 3 no menu e no cabeçalho, reduzir, remover, desfazer, limpar e recarregar. Conferir o anúncio acessível, o badge oculto com sacola vazia e o bloqueio de uma peça esgotada.
- [ ] Repetir em movimento reduzido, navegação por teclado e aba oculta. As transições usam Web Animations com transformações e opacidade. A taxa de atualização acompanha o navegador e o aparelho. A verificação local não mede 120 Hz em dispositivos físicos.
- [ ] Comparar o menu com as capturas de referência em mobile, desktop e WebKit. Verificar alvos de toque, safe-area, teclado e modais.

## Pontos de liberação para a IA Pessoal

1. Comparar as regras reais do projeto Firestore com o fragmento `firestore/nexus-orders.rules`. O fragmento não é uma política substituta. Incorporar a leitura protegida de pedidos e condicionar as regras de escrita de vendas aos predicados incluídos. Regras genéricas que também casem com as coleções protegidas precisam ser revisadas porque as permissões do Firestore são combinadas por OR. Validar usuários autorizados, sem autorização, anônimos e a leitura histórica em staging.
2. Em staging, provisionar os documentos privados `nexusOperators/{uid}` com `active: true` para os operadores autorizados. Configurar `ORDER_FIRESTORE_PROJECT` e o segredo `ORDER_FIRESTORE_WRITER` no Worker já existente, com uma conta de serviço de privilégios mínimos. Validar a credencial e as regras reais em staging. A origem de produção permanece no GitHub Pages e o endpoint de catálogo permanece no mesmo backend. Nenhum segredo deve entrar no repositório.
3. Fazer a conferência de liberação com snapshots antes/depois de vendas históricas, recebimentos, estoque e catálogo. Validar taxas, vínculos de produtos e fluxo nas contas reais de teste. Conferir Safari em aparelho Apple, além do motor WebKit local. Registrar o parecer de código, segurança, UX, dados e CI no PR. A aprovação independente e o aceite do proprietário precedem qualquer mudança em produção.
4. A publicação envolve duas partes. Ativar regras, acesso e Worker primeiro, validar o contrato e só então publicar o cliente. Para voltar atrás, restaure o cliente anterior e mantenha documentos de pedidos, vendas e trilha. Desabilitar a entrada de pedidos depois de verificar que os pedidos recebidos continuam visíveis e tratáveis.

Como a política real do Firestore e a credencial do Worker ativo não fazem parte do repositório, a validação do ambiente real permanece a cargo da etapa de aceite. O emulador usa permissões representativas e dados fictícios. As capturas e vídeos usam exclusivamente produtos e compradores fictícios. A página do catálogo passou de 31.643 para cerca de 40.400 bytes em gzip local. A navegação e as microanimações usam recursos nativos sem novos SDKs ou rastreadores.
