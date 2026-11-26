# Backup do Firestore pela API REST

O exportador lê todos os documentos de um banco Firestore, incluindo subcoleções sob
documentos ausentes. Ele percorre todas as páginas, usa o mesmo horário de leitura
do servidor em produção e guarda caminhos, valores tipados e horários de criação e
atualização. Uma falha de leitura interrompe a exportação antes de publicar o arquivo.
As leituras consomem a cota normal do Firestore. Se a API recusar a leitura por cota
ou expiração do horário, execute uma nova tentativa quando houver cota disponível.

O arquivo é gravado com permissão `0600` e sem sobrescrever cópias anteriores.
Guarde-o fora do repositório, em armazenamento privado e criptografado. Guarde
também o SHA-256 impresso pelo comando em um registro separado e compare-o com
o hash impresso na verificação. O verificador detecta alterações no conteúdo
comparando o hash com o manifesto dentro do arquivo.

## Conceder acesso temporário

O proprietário do projeto `agenda-vendas-9922a` pode usar **IAM e administrador → IAM →
Conceder acesso** no Google Cloud Console para adicionar a conta Google que executará
a exportação. A opção predefinida é **Cloud Datastore Viewer** (`roles/datastore.viewer`).
Para menor privilégio, crie uma função personalizada no projeto com apenas
`datastore.entities.get` e `datastore.entities.list`. Remova a concessão depois da
exportação e verificação. A conta autentica no próprio terminal. Nenhuma senha,
chave de conta de serviço ou token precisa ser enviado por chat.

## Executar de uma vez no Cloud Shell

Com a conta autorizada selecionada, execute `bash scripts/firestore-cloud-shell.sh`.
A automação testa as operações IAM de leitura diretamente na API, usa o banco
`(default)` e prepara as dependências no diretório privado do Cloud Shell.
O arquivo de backup completo fica em `~/.km-firestore-backup/agenda-vendas-9922a/firestore.json`.
Se houver uma interrupção depois de concluir a exportação, rode o mesmo comando:
a cópia concluída é reutilizada. Se a interrupção ocorrer durante a exportação,
a leitura começa de novo para manter um único horário de leitura.

No fim, o relatório contém a contagem, os hashes SHA-256 do conteúdo e do arquivo
completo e o resultado da restauração. Ele também imprime o comando
`cloudshell download` para baixar os arquivos privadamente no Safari.

## Exportar e verificar

Com Node.js 22+ e Google Cloud CLI instalados, a conta autorizada pode executar:

```bash
read -r -p 'Conta Google com acesso de leitura: ' KM_BACKUP_ACCOUNT
gcloud auth login "$KM_BACKUP_ACCOUNT"
unset FIRESTORE_EMULATOR_HOST
umask 077
mkdir -p "$HOME/km-backups"
FIRESTORE_PROJECT=agenda-vendas-9922a FIRESTORE_DATABASE='(default)' \
  FIRESTORE_ACCESS_TOKEN="$(gcloud auth print-access-token --account="$KM_BACKUP_ACCOUNT")" \
  node scripts/firestore-backup.mjs export "$HOME/km-backups/agenda-vendas.json"
node scripts/firestore-backup.mjs verify "$HOME/km-backups/agenda-vendas.json"
unset KM_BACKUP_ACCOUNT
```

O comando `export` de produção usa somente operações de leitura. Se houver outros
bancos Firestore no projeto, exporte cada um com seu próprio `FIRESTORE_DATABASE`
e arquivo de destino.

## Verificar a restauração

Com Java 21 e Node.js 22+ instalados, execute no mesmo diretório do repositório.
O comando inicia somente o emulador do Firestore em loopback e o encerra ao
terminar. Se a porta 8878 estiver ocupada, escolha outra no JSON.

```bash
export KM_FIRESTORE_BACKUP="$HOME/km-backups/agenda-vendas.json"
KM_EMULATOR_DIR="$(mktemp -d)"
cat > "$KM_EMULATOR_DIR/firebase.json" <<'JSON'
{"emulators":{"firestore":{"host":"127.0.0.1","port":8878},"ui":{"enabled":false},"singleProjectMode":false}}
JSON
npx --yes firebase-tools@14.27.0 emulators:exec \
  --only firestore --project demo-km-backup --config "$KM_EMULATOR_DIR/firebase.json" \
  'node scripts/firestore-backup.mjs restore-test "$KM_FIRESTORE_BACKUP"'
unset KM_FIRESTORE_BACKUP
```

O restaurador gera um identificador `demo-backup-*` novo, verifica que está vazio,
escreve com a condição de que cada documento ainda não exista e compara todos os
caminhos e campos restaurados com o arquivo. Confira `restored: true`, a contagem
e o mesmo SHA-256 registrado na exportação. A CLI pode baixar o emulador na
primeira execução e o projeto `demo-*` é apenas local.

Use um emulador dedicado e encerre-o depois do teste para remover a cópia local.
O teste mantém os valores de campos de referência como gravados, incluindo os
nomes originais dos projetos. Ele compara os valores sem seguir essas referências.
Os horários de criação e atualização originais ficam no arquivo. O Firestore
gera novos horários no destino e a comparação usa os caminhos e campos.
Regras, índices, configuração, contas do Firebase Auth e arquivos do Cloud Storage
pertencem a mecanismos separados do backup de documentos.
