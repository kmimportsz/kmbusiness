#!/usr/bin/env bash
set -euo pipefail
umask 077

project=km-business-homologacao
tmp="$(mktemp -d)"
trap 'rm -rf -- "$tmp"' EXIT
token="$(gcloud auth print-access-token)"
get() {
  printf 'header = "Authorization: Bearer %s"\n' "$token" |
    curl -fsS --max-time 20 --config - "$1"
}
api="https://firebaserules.googleapis.com/v1/projects/$project"
get "$api/releases/cloud.firestore" > "$tmp/release.json"
ruleset="$(jq -er '.rulesetName | select(test("^projects/km-business-homologacao/rulesets/[^/]+$"))' "$tmp/release.json")"
get "https://firebaserules.googleapis.com/v1/$ruleset" > "$tmp/active.json"
get "https://firestore.googleapis.com/v1/projects/$project/databases/(default)/documents/nexusOrderControl/intake" > "$tmp/intake.json"
unset token
curl -fsSL --max-time 20 \
  'https://raw.githubusercontent.com/kmimportsz/kmbusiness/1f2868e7e5b52da403e7b1c19b1a8bb88b649aa7/firestore/nexus-orders.rules' \
  -o "$tmp/candidate.rules"
python3 - "$tmp" <<'PY'
import json, pathlib, re, sys
p = pathlib.Path(sys.argv[1])
load = lambda name: json.loads((p / name).read_text())
files = load('active.json')['source']['files']
def normalize(source):
    parts = re.findall(r"""'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|//[^\n]*|\s+|.""", source)
    return ''.join(part for part in parts if not part.isspace() and not part.startswith('//'))
def hide_operator_emails(source):
    pattern = r"(request\.auth\.token\.get\('email',''\)in\[)'[^']+','[^']+'(\])"
    return re.sub(pattern, r"\1'__ADMIN_EMAIL_1__','__ADMIN_EMAIL_2__'\2", normalize(source), count=1)
candidate = normalize((p / 'candidate.rules').read_text())
print(json.dumps({
    'ruleset': load('release.json')['rulesetName'].split('/')[-1],
    'regrasIguaisACandidataExcluindoEmails': len(files) == 1 and hide_operator_emails(files[0]['content']) == candidate,
    'entradaBooleanaAtiva': load('intake.json').get('fields', {}).get('enabled', {}).get('booleanValue') is True,
}, ensure_ascii=False))
PY
