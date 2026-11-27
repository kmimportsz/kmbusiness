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
   do PR #5 (`3d7a17c`), retomando o fluxo de WhatsApp. A reversão não importa o backup
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

## Teste automatizado do checkout hospedado

Execute `node tests/nexus-hosted-orders.mjs` com Node.js e curl. O teste
só usa `km-business-homologacao`, cria um comprador anônimo descartável
e confere isolamento, WhatsApp obrigatório, gravação atômica, duplicação
e intervalo entre pedidos. Ele imprime os status de cada etapa e remove
a conta temporária no fim. Se a gravação passar, o identificador do pedido
sintético fica no relatório para testar aprovação ou recusa no Business.
O pedido gravado é mantido no ambiente de testes para essa próxima etapa.

A execução hospedada mais recente comprovou o login e o isolamento da
leitura, mas a gravação do pedido válido retornou `403`. A chamada REST
e o SDK apresentaram o mesmo resultado. O lote equivalente passou
no emulador com as regras candidatas. A publicação oficial aguarda a
validação hospedada.

### Comparação das regras informadas pelo proprietário

O texto copiado do editor de homologação foi comparado com as regras
do PR, desconsiderando comentários, formatação e os dois identificadores
de e-mail. Os trechos executáveis coincidem. A suíte do emulador rodou
com o arquivo enviado, substituindo apenas a lista de e-mails pelas
identidades sintéticas da suíte. Passaram criação anônima, isolamento,
cadência, concorrência, aprovação, recusa, venda e baixa de estoque.

O teste REST hospedado repetiu login anônimo HTTP 200, consulta de ID
próprio inexistente HTTP 404 e negação de leitura de estoque e pedidos
de terceiros HTTP 403. O commit de um pedido válido continuou respondendo
HTTP 403. A divergência entre emulador e serviço hospedado não foi
atribuída a uma condição específica.

O proprietário confirmou que o texto enviado corresponde à revisão
publicada. O diagnóstico seguinte verificou a audiência, o emissor,
o vínculo entre o UID e o token, o provedor anônimo e o formato do UID.
Todos corresponderam ao projeto de homologação e às regras. O commit
retornou `PERMISSION_DENIED`, com a mensagem genérica `Missing or
insufficient permissions` e sem detalhes da condição que falhou. A conta
temporária foi removida e o lote foi rejeitado integralmente.

Para isolar a expressão, a API de testes do Firebase Rules permite avaliar
o código hospedado com `expressionReportLevel: FULL` e valores simulados
para as consultas feitas pelas regras. O resultado precisa ser confrontado
com o teste de commit real, pois os valores simulados não refletem por si
só o estado após a gravação atômica. A API requer uma identidade Google
autorizada, com `firebaserules.rulesets.test` no projeto de homologação.

### Causa do 403 em homologação

Em 27/11/2026, as 13 sondas somente de leitura confirmaram o banco
`(default)` de `km-business-homologacao`. Os testes de existência
do caminho canônico `nexusOrderControl/intake`, tanto dinâmico quanto
literal, foram negados. A sonda que usa `exists()` para oito variantes
de `intake` com espaço ou caractere invisível no início ou no fim
passou. O teste equivalente sobre o nome da coleção foi negado.
A sonda de variantes de documento informa a existência de ao menos
uma variante, sem identificar qual delas.

A correção é criar o documento canônico `intake` dentro da coleção
`nexusOrderControl`, com o campo `enabled` do tipo booleano e valor
`true`. Preserve o documento antigo e as regras de autorização.
Depois da correção, o teste de checkout hospedado deve ser executado
antes de considerar a integração aprovada. As sondas não gravaram
documentos e a remoção da conta descartável retornou HTTP 200.

Após cadastrar o caminho canônico, o checkout hospedado passou: login
anônimo e gravação válida HTTP 200, recusas HTTP 403 para telefone
inválido, duplicidade, cadência, estoque e pedidos de terceiros. A
conta de teste foi removida. O pedido sintético permanece pendente
para a verificação com operador, que deve observar uma única venda,
seu WhatsApp e a redução de estoque em uma unidade na segunda sessão.

### Aceite funcional e condição de publicação

O reteste hospedado após a remoção das regras temporárias aprovou o
checkout e repetiu as recusas esperadas. Em 27/11/2026, o proprietário
confirmou a aprovação do pedido no Business de homologação, uma única
venda com WhatsApp, a baixa de estoque e a sincronização entre sessões.

O módulo do Catálogo no PR aponta para `agenda-vendas-9922a`. Antes
do merge, é necessário verificar nesse projeto a revisão ativa, o
provedor anônimo, os operadores e o controle de entrada. A primeira
ativação deve ocorrer apenas com as regras e o Business compatíveis e
a opção de reversão disponível. Enquanto essa configuração não for
verificada, mantenha o catálogo do PR #5 em produção.
