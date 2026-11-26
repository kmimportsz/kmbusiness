# NEXUS · Acessos temporários para homologação e backup

A autorização do proprietário está registrada. Os acessos disponíveis nesta sessão chegam ao PR, à prévia privada e à leitura do catálogo público. O ambiente encontrado no GitHub é `github-pages`. O Site oficial tem configuração de entrega; as variáveis de integração Firestore da candidata não estão cadastradas ali. A conta Cloudflare conectada não retornou um Worker identificado como homologação do K&M. Não foi encontrada identidade Google para o Firestore neste ambiente.

## Firestore isolado

1. No console Firebase/Google Cloud, selecione um projeto **de homologação** separado. Informe apenas o ID do projeto e o nome do banco. Confirme que está vazio ou contém somente dados de teste.
2. Em **Google Cloud → IAM e administrador → IAM**, conceda à identidade de homologação temporária leitura dos rulesets e, se a instalação das regras candidatas for feita pela automação, edição de regras **apenas nesse projeto**. O operador Firebase Auth de teste precisa de seu UID em `nexusOperators/{uid}` com `active: true`.
3. Para o Worker, configure uma conta de serviço exclusiva de homologação. Conceda as operações de leitura e criação de documentos de que o endpoint precisa, com escopo limitado ao projeto isolado. Configure a credencial diretamente como segredo no painel do Worker/Sites. Para a ferramenta de homologação, vincule a identidade autorizada pelo mecanismo de credenciais do ambiente; mantenha chaves e tokens fora do chat e do Git.
4. Use a [candidata completa](NEXUS-REVISAO-FIRESTORE.md) no ambiente isolado. Na produção, a revisão exige somente leitura das regras vigentes antes de preparar qualquer mudança.

## Worker e catálogo isolados

1. No Cloudflare ou Sites, confirme o projeto/Worker de homologação e informe o ID ou nome exato e seu endereço. Use um bucket de teste independente do catálogo oficial.
2. Conceda acesso temporário de leitura de configuração e logs, edição/publicação de versões **apenas no Worker/Site de homologação** e acesso ao bucket de teste. Se for Sites com acesso por pessoa, use **Compartilhar → Editor** no projeto de homologação. Se for token Cloudflare, use **My Profile → API Tokens → Create Token**, limite à conta e ao recurso disponíveis e cadastre o token no mecanismo seguro do ambiente.
3. No painel de variáveis/segredos do ambiente isolado, configure `ORDER_FIRESTORE_PROJECT` para o ID de homologação e `ORDER_FIRESTORE_WRITER` como segredo. Configure o provedor de frete com dados de teste e informe os endereços de origem permitidos para o teste.
4. A homologação verifica o contrato público, autenticação de operadores, corrida de confirmação, estoque, cobranças, timeout, retry e frete, com dados fictícios. A liberação dos endereços oficiais vem depois.

## Backup e evidência de restauração

O backup de documentos do Firestore de produção foi concluído pela API REST,
sem faturamento. O proprietário confirmou a restauração isolada dos 137 documentos
e a igualdade do SHA-256 da cópia AES-256 baixada no iPhone. O material
permanece privado. [Registro de evidências](nexus-evidencias/backup-firestore-producao.json)

Para o catálogo, continua pendente o inventário privado necessário à reversão.
Acesso temporário de leitura e listagem ao bucket R2 oficial permite conferir
catálogo, fotos, snapshots e metadados sem alterar objetos. A cópia pública já
verificada cobre somente os objetos referenciados pelo catálogo. As configurações
e versões do Worker devem ser conferidas pelo titular antes de qualquer mudança.

Identificadores de projetos e URLs privadas podem ser informados nesta conversa. Use o canal de segredos do provedor para qualquer credencial.

## Projeto de homologação criado

O proprietário informou o projeto `km-business-homologacao`, banco `(default)`,
região `southamerica-east1`, no plano Spark, com regras iniciais restritivas.
O uso do Site **K&M NEXUS · Prévia privada** foi autorizado. A inspeção confirmou
que o Site existe com acesso restrito e ainda não contém as variáveis da integração.

### Identidades e limites

- **Worker:** crie a conta de serviço `nexus-order-writer` dentro de
  `km-business-homologacao`. A identidade resultante é
  `nexus-order-writer@km-business-homologacao.iam.gserviceaccount.com`.
  Conceda a ela, somente no projeto de homologação, uma função personalizada
  com `datastore.entities.get` e `datastore.entities.create`. A implementação
  consulta o pedido por ID e cria o documento; a sessão dos operadores faz
  as atualizações. A credencial IAM do Worker opera fora das regras de
  cliente do Firestore, por isso a separação do projeto é obrigatória.
- **Publicador das regras:** use a própria conta Google que opera o Firebase
  Console, com as permissões que ela já possui. Para delegar a edição no
  projeto de homologação, o papel predefinido dedicado é
  `roles/firebaserules.admin`. Não conceda esse papel ao Worker.
- **Dois operadores:** use contas do Firebase Authentication de homologação.
  Elas não precisam de papéis IAM. Cadastre os UIDs de homologação como
  `nexusOperators/{uid}` com `active: true` e use seus e-mails nos marcadores
  privados da candidata. A conta humana que prepara a base usa o console
  desse projeto. As contas de teste não podem criar o próprio vínculo.
- **Sites:** configure `ORDER_FIRESTORE_PROJECT=km-business-homologacao` e o
  segredo `ORDER_FIRESTORE_WRITER` na prévia privada, após a confirmação da
  credencial compatível com o Worker. A candidata atual espera JSON de chave
  da conta de serviço. Se a política do projeto bloquear a criação de chaves,
  preserve a política e registre o bloqueio para avaliar outra integração.

### Isolamento antes da primeira sessão hospedada

Cadastre um app Web no Firebase de homologação, obtenha a configuração desse
app e autorize o domínio da prévia em **Authentication → Configurações →
Domínios autorizados**. A configuração pública de app Web pode ser usada
para preparar o cliente de teste. A chave privada da conta de serviço vai
somente ao painel de segredos da prévia.

A versão de produção do Business contém a configuração Firebase de produção
e referências ao catálogo oficial. A versão a publicar na prévia precisa
substituir esses destinos pelo projeto de homologação e pela origem privada.
Antes de qualquer gravação, valide os destinos no navegador e confirme que
o binding `BUCKET` resolve para armazenamento exclusivamente de teste. Um
Worker ou bucket R2 separado só é necessário se o armazenamento e o runtime
da prévia não oferecerem esse isolamento ou se a homologação exigir testar
um ambiente Cloudflare separado. Preserve as regras vigentes até preparar
a candidata e mantenha o faturamento desativado.

### Estado da configuração da prévia

O proprietário verificou pelo Cloud Shell que a conta
`nexus-order-writer@km-business-homologacao.iam.gserviceaccount.com` recebeu
o papel personalizado `nexusOrderWriter` com somente as duas permissões
previstas. A configuração salva na prévia restrita aponta para
`km-business-homologacao`. A versão ativa não foi alterada.

A autenticação real ainda depende do segredo `ORDER_FIRESTORE_WRITER`,
ausente na inspeção da prévia. Use o painel de segredos do Site para o JSON
integral da conta de serviço. Ao concluir a homologação, revogue pela IAM
a chave temporária criada para esta rodada e remova o segredo. A configuração
pública do app Firebase Web e a confirmação do armazenamento isolado também
são necessárias para preparar a versão de teste. Até então, não faça pedidos
de teste na prévia ativa.

### Verificação da credencial sem cadastrar o segredo na prévia

O conector Sites disponibiliza configuração de segredos, mas não retornou
um painel para o proprietário inserir a chave nem um fluxo de entrega segura
da chave que está no iPhone. O arquivo deve permanecer privado.

Em um terminal privado com Node.js 22+, execute
`node catalogo/source/scripts/check-staging-firestore.mjs /caminho/privado/chave.json`.
O arquivo deve ter permissão `0600`. O script executa o código do Worker no
Node.js, verifica o projeto e a identidade da chave e limita as chamadas ao
OAuth do Google e à coleção `nexusOrders` de `km-business-homologacao`.
Ele cria um pedido sintético no Firestore hospedado de homologação, compara
duas chamadas concorrentes e a repetição, e verifica a rejeição de um conteúdo
diferente com a mesma chave. O resultado mostra somente identificadores e
status. O procedimento não cadastra o segredo do Site nem valida o runtime
hospedado, o bucket ou a sessão do navegador.

O script foi verificado com chave descartável, resposta OAuth simulada e
Firestore Emulator. As credenciais reais continuam sob controle do proprietário.

O proprietário executou o teste com a credencial real no Cloud Shell e
confirmou que OAuth, acesso ao Firestore hospedado, concorrência e repetição
passaram. A validação da credencial no Cloud Shell está concluída.
[Evidência do teste](nexus-evidencias/firestore-homologacao-cloud-shell.json)

### Credencial temporária para uma janela de homologação

O Worker aceita em `ORDER_FIRESTORE_WRITER` um segredo JSON no formato
`{"type":"staging_access_token","accessToken":"<OAuth>","expiresAt":<epoch em ms>}`.
A opção é exclusiva de `km-business-homologacao`. O Worker rejeita ausência,
expiração, prazo restante acima de uma hora e uso contra outro projeto. O prazo
informado deve ser igual ou anterior à validade real emitida pelo Google.
O modo não permite renovar o token a partir do próprio Worker.

Para evitar armazenar a chave privada no runtime, gere uma credencial de curta
duração no ambiente autorizado. A emissão sem chave depende de uma identidade
apta a gerar tokens para a conta de serviço. A prévia atual não expôs identidade
de workload, e nenhuma delegação IAM adicional foi configurada. O conector Sites
aceita o valor como segredo, mas não retornou um link para inserção direta pelo
proprietário. A homologação hospedada aguarda um canal seguro de entrada no
runtime selecionado. Tokens e chaves não devem passar pelo chat, Git ou logs.

### Próxima janela de homologação

Concentre o acesso e o aceite móvel em uma única janela com o responsável.
Use um Worker de homologação que o responsável possa administrar no painel
do provedor e cujo armazenamento de teste esteja identificado. Se a prévia
Sites continuar sem entrada segura de segredos acessível ao proprietário,
um Worker de teste no plano gratuito da Cloudflare com painel de segredos é
uma alternativa, desde que o armazenamento isolado já esteja disponível
sem habilitar faturamento. Confirme o escopo e a disponibilidade no painel
antes de provisionar.

A equipe pode preparar a candidata e o roteiro usando a configuração pública
do app Web de homologação. Na janela de testes, o responsável insere a
credencial de curta duração diretamente no painel do Worker de teste e
confere o Safari físico. O token é exclusivo do Firestore de homologação e
não deve circular entre serviços via Git, logs ou chat. Se não houver
armazenamento hospedado sem faturamento, o ensaio em workerd local com R2
emulado continua disponível como verificação parcial. O Firestore hospedado
já foi exercitado separadamente pelo Cloud Shell. A equivalência entre esse
ensaio e a homologação hospedada integral não foi demonstrada.
