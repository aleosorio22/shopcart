#!/usr/bin/env bash
# Aplica los scripts numerados en orden y registra cada uno en Config.VersionEsquema.
# Uso: ./ejecutar.sh [--pruebas]
#
# Variables requeridas:
#   DB_SERVIDOR      host,puerto del SQL Server
#   DB_USUARIO       usuario con permiso de crear bases
#   SQLCMDPASSWORD   su contrasena (sqlcmd la lee del entorno)
#   API_PASSWORD     contrasena del login shopcart_api
#   JOBS_PASSWORD    contrasena del login shopcart_jobs
set -euo pipefail

cd "$(dirname "$0")/scripts"
: "${DB_SERVIDOR:?Falta DB_SERVIDOR}" "${DB_USUARIO:?Falta DB_USUARIO}" "${SQLCMDPASSWORD:?Falta SQLCMDPASSWORD}"
: "${API_PASSWORD:?Falta API_PASSWORD}" "${JOBS_PASSWORD:?Falta JOBS_PASSWORD}"

LOG="$(mktemp -t shopcart-migracion)"
sq() { sqlcmd -S "$DB_SERVIDOR" -U "$DB_USUARIO" -C -b -I -f 65001 "$@"; }

aplicado() {
  sq -d master -h -1 -W -Q "SET NOCOUNT ON; IF DB_ID('ShopCart') IS NOT NULL AND OBJECT_ID('ShopCart.Config.VersionEsquema') IS NOT NULL SELECT COUNT(*) FROM ShopCart.Config.VersionEsquema WHERE Script = '$1' ELSE SELECT 0;" | tr -d '[:space:]'
}

for archivo in 0*.sql; do
  [ "$archivo" = "015_Pruebas.sql" ] && continue
  if [ "$(aplicado "$archivo")" != "0" ]; then
    echo "omitido  $archivo"
    continue
  fi
  echo "aplicando $archivo"
  sq -d master -i "$archivo" -v API_PASSWORD="$API_PASSWORD" JOBS_PASSWORD="$JOBS_PASSWORD" >>"$LOG" 2>&1 || { tail -20 "$LOG"; exit 1; }
  sq -d ShopCart -Q "INSERT Config.VersionEsquema (Script) VALUES ('$archivo');" >>"$LOG"
done

if [ "${1:-}" = "--pruebas" ]; then
  sq -d ShopCart -i 015_Pruebas.sql -v API_PASSWORD=x JOBS_PASSWORD=x
fi
echo "Listo. Registro en $LOG"
