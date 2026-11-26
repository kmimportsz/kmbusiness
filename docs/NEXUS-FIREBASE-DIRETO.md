# Pedidos do catálogo direto no Firestore

O catálogo mantém a interface e a fonte atual dos produtos, fotos e cotações.
O registro de pedidos e a aprovação pelo Business passam a depender apenas
de Firebase Authentication e Firestore. A versão independente publicada
continua disponível como reversão do catálogo.

## Fluxo e permissões

- O módulo Firebase do catálogo carrega no primeiro envio. O comprador usa
  a sessão anônima persistida pelo Firebase Auth. O catálogo usa somente a
  configuração pública do app Web.
- O comprador cria seu próprio pedido pendente e o registro de cadência
  no mesmo lote. Só pode ler seu pedido pelo ID completo, sem listar pedidos,
  acessar registros de outros compradores ou alterar o estado do pedido.
  As regras exigem horário do servidor, restringem o tamanho do payload
  e limitam novas solicitações da mesma sessão a uma a cada 30 segundos.
- O comprador reutiliza a chave de tentativa após perda de resposta. A
  consulta vem do servidor e a confirmação da interface espera o lote ou
  a recuperação do mesmo pedido. O código da confirmação identifica uma
  solicitação registrada que ainda precisa de aprovação da loja.
- O payload dos itens chega como JSON de tamanho limitado. O Business valida
  todos os itens e impede que dados inválidos ou duplicados gerem uma venda.
  Na transação, compara o preço com o produto do estoque e confere custos,
  vínculo e disponibilidade. Os totais do pedido enviados pelo navegador
  são estimativas. O Business recalcula o subtotal. Para entrega, o operador
  confere o frete na aprovação.
- Dois administradores autenticados recebem atualizações pelo listener
  existente. A aprovação usa a mesma transação para pedido, venda e estoque,
  com ID de venda determinístico a partir do pedido. A recusa preserva
  o histórico. O leitor aceita horários e itens dos pedidos anteriores.
- A cadência por UID não contém abuso por identidades anônimas múltiplas.
  Antes da exposição pública, avalie a proteção compatível com Spark, a
  cota do Firestore e os sinais de abuso em homologação. Use o controle
  de entrada para proteger o catálogo se houver abuso ou regressão.

## Preparar a homologação e a publicação

1. Use a configuração pública do app Web de `km-business-homologacao` no
   Business e no módulo do catálogo **somente no pacote isolado**. Confirme
   no navegador os destinos de Auth e Firestore antes de fazer gravações.
   Autorize a origem da prévia e ative o provedor Anônimo na homologação.
2. Prepare as regras completas a partir de `firestore/nexus-orders.rules`
   com os dois e-mails autorizados. Use duas contas Firebase de teste e
   provisione os UIDs de homologação em `nexusOperators/{uid}`.
   Crie `nexusOrderControl/intake` com `enabled: true` no banco isolado para
   os testes. A flag é gerenciada fora do cliente. Faça pedidos com estoque
   de teste, valide preços divergentes, aprovação concorrente, recusa,
   reconexão e Safari no iPhone.
3. Antes de aplicar regras em produção, compare as regras vigentes e confira
   o acesso e os vínculos de estoque dos operadores. A ativação pública
   exige o provedor Anônimo e a flag de entrada. Preserve a configuração
   do backup aprovado e o SHA publicado do catálogo independente.
4. Na reversão, desative a flag para bloquear novas entradas, inclusive
   clientes em cache. Mantenha o Business e as regras que permitem tratar
   pedidos já registrados. Se necessário, restaure apenas o catálogo publicado
   do PR #4, retomando o fluxo de WhatsApp. A reversão não importa o backup
   nem apaga pedidos, estoque, vendas ou recebimentos.

O teste OAuth no Cloud Shell e os ensaios do Worker são evidências da
abordagem anterior. O backup do Firestore e os testes de regressão do
Business e catálogo continuam pertinentes. A nova entrada anônima tem
evidências próprias no emulador.

## Prévia hospedada de homologação

A versão privada 3 do Sites, fonte `f82a176a8156cbaf41e887c20cef18be4efdabca`,
serviu o [Business](https://km-nexus-demonstracao.inventivetoucan16.chatgpt.site/homologacao/)
e o [catálogo](https://km-nexus-demonstracao.inventivetoucan16.chatgpt.site/homologacao/catalogo/).
O acesso sem autenticação recebeu HTTP 401. Com a credencial de serviço do
Site, as duas páginas e o módulo de pedidos corresponderam byte a byte
à versão preparada. As páginas usam o app Web do Firestore de homologação,
catálogo fictício e armazenamento local separado da demonstração anterior.
Cotação de entrega e WhatsApp ficam desativados nessa configuração.

A API real do Firebase Auth retornou HTTP 200 no login anônimo. O Firestore
hospedado retornou 403 tanto na consulta do ID pertencente ao comprador
quanto na consulta do estoque. O usuário descartável da segunda verificação
foi removido; a primeira tentativa de remoção retornou HTTP 400. Nenhum
documento foi gravado nessa verificação. O teste de criação, cadência e
aprovação no ambiente hospedado aguarda aplicação das regras candidatas
e preparação da base por uma conta autorizada a administrar esse projeto.

Para a prova de retirada, use o produto fictício `homologacao-camiseta`.
No banco de homologação, o estoque de teste correspondente pode ser
`products/homologacao-camiseta`, com `name: "Camiseta Horizonte"`,
`catalogId: "homologacao-camiseta"`, `price: 80`, `cost: 30`, `stock: 5`
e `stockRevision: 1`. Ao aprovar uma unidade, a segunda sessão deve observar
estoque 4 e uma única venda associada ao pedido.
