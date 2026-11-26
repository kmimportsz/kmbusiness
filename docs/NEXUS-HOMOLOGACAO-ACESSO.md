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
