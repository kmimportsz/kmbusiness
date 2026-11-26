#!/usr/bin/env bash
set -euo pipefail
umask 077

project=agenda-vendas-9922a
base="$HOME/.km-firestore-backup/$project"
tool="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/firestore-backup.mjs"
backup="$base/firestore.json"
report="$base/relatorio.json"
runtime="$base/runtime"
mkdir -p "$runtime" "$base/emulators"
chmod 700 "$base"
exec 9>"$base/.lock"
flock -n 9 || { echo 'Já existe um backup em execução neste Cloud Shell.' >&2; exit 1; }

step=autenticação
trap 'status=$?; printf "Falhou na etapa %s (código %s). Corrija a causa e cole o mesmo bloco novamente.\n" "$step" "$status" >&2' ERR
unset FIRESTORE_EMULATOR_HOST FIRESTORE_ACCESS_TOKEN
export FIRESTORE_PROJECT="$project" FIRESTORE_DATABASE='(default)'
account="$(gcloud config get-value account 2>/dev/null)"
[[ -n "$account" && "$account" != '(unset)' ]] || { echo 'Abra o Cloud Shell com a conta autorizada.' >&2; exit 1; }
gcloud auth print-access-token --account="$account" >/dev/null

step=Node.js
if ! command -v node >/dev/null || ! node -e 'process.exit(+process.versions.node.split(".")[0] >= 22 ? 0 : 1)'; then
  npm install --prefix "$runtime/node" --no-audit --no-fund node@22
  export PATH="$runtime/node/node_modules/.bin:$PATH"
fi

step=permissões
# Probe the exact IAM operations the export requires and discard all response data.
printf 'Verificando a leitura no projeto %s…\n' "$project"
FIRESTORE_ACCESS_TOKEN="$(gcloud auth print-access-token --account="$account")" node "$tool" preflight

if [[ ! -e "$backup" ]]; then
  step=exportação
  printf 'Exportando os documentos…\n'
  FIRESTORE_ACCESS_TOKEN="$(gcloud auth print-access-token --account="$account")" node "$tool" export "$backup"
else
  printf 'Backup existente encontrado. A execução vai verificar e restaurar a mesma cópia.\n'
fi

step=SHA-256
verified="$(node "$tool" verify "$backup")"
file_sha="$(sha256sum "$backup" | cut -d' ' -f1)"
printf 'Integridade confirmada: %s\n' "$verified"

step=Java
java21() {
  command -v java >/dev/null &&
    java -version 2>&1 | sed -n '1p' | grep -Eq 'version "(2[1-9]|[3-9][0-9])[."]'
}
if ! java21; then
  if [[ ! -x "$runtime/java/bin/java" ]]; then
    step='instalação do Java'
    case "$(uname -m)" in
      x86_64) architecture=x64 ;;
      aarch64|arm64) architecture=aarch64 ;;
      *) echo 'Arquitetura sem pacote Java 21 configurado.' >&2; exit 1 ;;
    esac
    temp_java="$(mktemp -d "$runtime/java.XXXXXX")"
    trap 'rm -rf -- "${temp_java:-}"' EXIT
    metadata="$(curl -fsSL --retry 3 "https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=$architecture&image_type=jre&os=linux&vendor=eclipse")"
    url="$(jq -er '.[0].binary.package.link | select(startswith("https://github.com/adoptium/temurin21-binaries/"))' <<<"$metadata")"
    hash="$(jq -er '.[0].binary.package.checksum | select(test("^[0-9a-f]{64}$"))' <<<"$metadata")"
    curl -fsSL --retry 3 "$url" -o "$temp_java/java.tar.gz"
    printf '%s  %s\n' "$hash" "$temp_java/java.tar.gz" | sha256sum --check --status
    mkdir "$temp_java/unpacked"
    tar -xzf "$temp_java/java.tar.gz" -C "$temp_java/unpacked" --strip-components=1
    "$temp_java/unpacked/bin/java" -version
    mv "$temp_java/unpacked" "$runtime/java"
    rm -rf -- "$temp_java"
    trap - EXIT
  fi
  export JAVA_HOME="$runtime/java"
  export PATH="$JAVA_HOME/bin:$PATH"
fi
java21

step='instalação do emulador'
firebase="$runtime/firebase/node_modules/.bin/firebase"
if [[ ! -x "$firebase" ]] || [[ "$("$firebase" --version)" != '14.27.0' ]]; then
  npm install --prefix "$runtime/firebase" --no-audit --no-fund firebase-tools@14.27.0
fi

step='restauração isolada'
temp="$(mktemp -d)"
trap 'rm -rf -- "$temp"' EXIT
cat > "$temp/firebase.json" <<'JSON'
{"emulators":{"firestore":{"host":"127.0.0.1","port":8878},"ui":{"enabled":false},"singleProjectMode":false}}
JSON
export FIREBASE_EMULATORS_PATH="$base/emulators"
export KM_BACKUP_FILE="$backup" KM_BACKUP_TOOL="$tool" KM_RESTORE_RESULT="$temp/restore.json"
(
  cd "$temp"
  "$firebase" emulators:exec --only firestore --project demo-km-backup --config firebase.json \
    'node "$KM_BACKUP_TOOL" restore-test "$KM_BACKUP_FILE" > "$KM_RESTORE_RESULT"'
)

step=relatório
jq -en --argjson backup "$verified" --slurpfile restore "$temp/restore.json" --arg fileSHA256 "$file_sha" '
  $restore[0] as $r
  | if $r.restored == true and $r.documents == $backup.documents and $r.sha256 == $backup.sha256
    then {status:"aprovado", documents:$backup.documents, readTime:$backup.readTime, sha256:$backup.sha256,
          fileSHA256:$fileSHA256, restored:true, emulatorProject:$r.target}
    else error("Verificação e restauração divergiram")
    end' > "$temp/report.json"
install -m 600 "$temp/report.json" "$report"
cat "$report"
printf '\nPara baixar o backup privado no iPhone, cole esta linha no Cloud Shell:\ncloudshell download %q\n' "$backup"
printf 'Para baixar o relatório:\ncloudshell download %q\n' "$report"
