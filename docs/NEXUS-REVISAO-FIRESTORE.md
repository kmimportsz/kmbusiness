# Firestore · revisão das regras do PR #3

O conjunto vigente foi fornecido pelos responsáveis. Ele autoriza leitura e escrita em qualquer caminho a duas identidades Firebase Auth, por e-mail. Firestore combina permissões de blocos coincidentes por **OU**. Manter esse curinga irrestrito e acrescentar regras de pedidos e vendas faria a regra geral continuar concedendo as permissões que o PR pretende restringir. Uma cláusula `allow ...: if false` em outro bloco não revoga uma permissão já concedida.

## Candidata completa

Use [`firestore/nexus-orders.rules`](../firestore/nexus-orders.rules) como um conjunto completo. No ambiente isolado, substitua os dois marcadores pelos e-mails dos dois usuários de teste. Para qualquer futura implantação autorizada, preencha-os com os dois e-mails da configuração vigente diretamente no ambiente seguro. Os valores reais não estão no Git.

- O curinga legado continua permitindo as mesmas operações para as duas identidades em coleções legadas, inclusive os oito caminhos da sincronização do Business. Exclui por raiz `nexusOperators`, `nexusOrders` e `sales`, inclusive caminhos descendentes.
- Todo documento de venda continua legível pelas duas identidades. Isso preserva a assinatura `onSnapshot` na coleção inteira. Vendas legadas e seus caminhos descendentes mantêm o CRUD anterior. As escritas nas vendas gerenciadas do NEXUS passam pelos predicados específicos; a exclusão por cliente fica vedada.
- Operações em pedidos e escritas nas vendas gerenciadas exigem e-mail da lista e UID ativo em `nexusOperators`. Para habilitar os dois administradores no fluxo novo, o responsável deve provisionar **os dois UIDs reais** com `active: true` por IAM. Os documentos de autorização não podem ser lidos ou alterados pelo cliente. A criação de pedido é feita pelo Worker com IAM.
- Uma confirmação só pode avançar um pedido pendente, com vínculo à nova venda na mesma transação e sem cobranças iniciais. Recebimentos já efetivados e o histórico de revisões têm as proteções do PR.

## Testes isolados

Executei `tests/nexus-firestore.cjs` com esta candidata completa no Firestore Emulator, usando os mesmos pontos de entrada do PR e dois e-mails fictícios. Foi testado o CRUD para ambos os administradores em `products`, `sales`, `catalog`, `cphotos`, `expenses`, `closings`, `config` e `proofs`, além de um caminho descendente de venda legada. Os testes cobrem leitura global de vendas, sincronização do contador, ações do segundo operador, bloqueio para anônimo e e-mail fora da lista mesmo com UID provisionado, bloqueio de admin sem UID ativo no fluxo novo, criação indevida de operador, caminhos descendentes protegidos, confirmação concorrente, estoque, cancelamento, cobranças e imutabilidade de recebimentos efetivados.

## Riscos e verificações antes de implantar

- Confirme a existência e a titularidade dos dois UIDs reais. A condição legada por e-mail mantém o comportamento anterior, inclusive a ausência de uma exigência nova de `email_verified`; adicionar essa exigência pode cortar o acesso se as contas atuais não estiverem verificadas. A condição por UID é adicional para os caminhos NEXUS.
- Verifique por leitura administrativa se há vendas importadas com IDs coincidentes com os prefixos reservados `pedido-` e `manual-`. O gerador legado conhecido não produz esses prefixos. Uma colisão importada bloquearia a alteração pelo cliente e precisa ser tratada antes da publicação.
- O acesso a estoque legado continua amplo para ambos os administradores, por compatibilidade. As regras de pedidos exigem o vínculo atômico com a venda, porém não verificam no próprio ruleset todo o cálculo ou a baixa de estoque. Essa validação ocorre no fluxo transacional do cliente. Concorra na homologação com edições legadas de estoque e confira reconciliação. Se a exigência for proteção contra cliente administrativo adulterado, a operação precisa de validação server-side e de um desenho específico para as escritas legadas.
- A conta de serviço do Worker autentica com IAM e não é restringida por Security Rules. Os testes do Worker usam credencial fictícia e não comprovam o escopo IAM real. Valide em homologação a credencial de menor privilégio e o Worker real.
- Nenhuma regra foi aplicada à produção. A implantação exige backup verificável e homologação com o projeto isolado e as regras completas.
