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
- Os dois administradores mantêm acesso de edição ao estoque legado, com a proteção de revisão e exclusão descrita abaixo. As regras de pedidos exigem o vínculo atômico com a venda, porém não verificam no próprio ruleset todo o cálculo ou a baixa de estoque. Essa validação ocorre no fluxo transacional do cliente. Concorra na homologação com edições legadas de estoque e confira reconciliação. Se a exigência for proteção contra cliente administrativo adulterado, a operação precisa de validação server-side e de um desenho específico para as escritas legadas.
- A conta de serviço do Worker autentica com IAM e não é restringida por Security Rules. Os testes do Worker usam credencial fictícia e não comprovam o escopo IAM real. Valide em homologação a credencial de menor privilégio e o Worker real.
- Nenhuma regra foi aplicada à produção. A implantação exige backup verificável e homologação com o projeto isolado e as regras completas.

## Cadastro dos dois operadores e homologação cruzada

No **projeto isolado**, um administrador autorizado deve abrir **Firebase Console → Firestore Database → Dados**, localizar ou criar a coleção `nexusOperators` e gravar os dois documentos abaixo. O ID de cada documento é o UID correspondente em **Authentication → Users**. Use o campo **booleano** `active`, com valor `true`. Se o documento já existir, altere apenas esse campo, preservando os demais. Confira os dois documentos de volta pelo console. Os UIDs não devem entrar no Git, em logs de teste ou em comentários públicos.

| Caminho no ambiente isolado | Dado |
| --- | --- |
| `nexusOperators/<UID_CONFIRMAÇÃO_1>` | `{ active: true }` |
| `nexusOperators/<UID_CONFIRMAÇÃO_2>` | `{ active: true }` |

Os testes do PR usam dois UIDs fictícios e duas sessões autenticadas independentes. A entrada em lote da segunda sessão roda pelo módulo `inventory3.js` em concorrência com a confirmação de pedido da primeira. A entrada de três unidades e a baixa de duas partem de seis unidades e terminam em sete. A segunda sessão recebe estoque, venda sem cobrança e pedido confirmado pelos listeners, sem recarregar. Repetir a entrada não duplica estoque; a contagem baseada em seis unidades é recusada e não gera lançamento. A venda legada da amostra permanece idêntica.

## Proteção das escritas legadas de estoque

O salvamento genérico de produtos passou a comparar a versão lida com o documento no servidor dentro de uma transação. Alterações de estoque e exclusões com base desatualizada são recusadas. Em conflito no salvamento genérico, o cliente informa a falha e busca o registro atual. O formulário usa o estado da abertura para detectar mudanças enquanto estiver aberto. A restauração do estoque usa uma transação separada das demais coleções.

As movimentações transacionais incrementam `stockRevision`; produtos anteriores à mudança usam a revisão inicial zero sem migração. Entradas aditivas leem o saldo atual e registram a chave da operação junto com os produtos; contagens físicas comparam saldo e revisão. As regras candidatas recusam alterações de quantidade sem incremento de revisão e exigem, para exclusão, um registro transacional com a revisão do produto e a hora do servidor. Um cliente antigo em cache precisa carregar a versão atual antes de voltar a gravar estoque quando essas regras forem implantadas.

O teste com duas sessões cobre atualização do saldo no servidor, entrada repetida, contagem desatualizada, gravação direta legada rejeitada pelas regras e rejeição pelo caminho genérico real com recarga do saldo. Também confere edição do formulário aberta antes da baixa, criação repetida sem duplicata e exclusão transacional repetida. A conferência de colisões de IDs, inventário e integridade dos dados de produção continua dependente da restauração integral e da homologação real.
