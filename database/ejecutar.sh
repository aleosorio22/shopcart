#!/usr/bin/env bash
# Aplica los scripts numerados en orden y registra cada uno en Config.VersionEsquema.
# Uso: ./ejecutar.sh [--desde 005] [--pruebas]
#   --desde NNN  omite los scripts anteriores a NNN, ya aplicados por otro medio
#
# Variables requeridas:
#   DB_SERVIDOR      host,puerto del SQL Server
#   DB_USUARIO       usuario con permiso de crear bases
#   SQLCMDPASSWORD   su contrasena (sqlcmd la lee del entorno)
#   API_PASSWORD     contrasena del login shopcart_api
#   JOBS_PASSWORD    contrasena del login shopcart_jobs
set -euo pipefail

DESDE="000"
PRUEBAS=false
while [ $# -gt 0 ]; do
  case "$1" in
    --desde) DESDE="$2"; shift 2 ;;
    --pruebas) PRUEBAS=true; shift ;;
    *) echo "Argumento desconocido: $1"; exit 1 ;;
  esac
done

cd "$(dirname "$0")/scripts"
: "${DB_SERVIDOR:?Falta DB_SERVIDOR}" "${DB_USUARIO:?Falta DB_USUARIO}" "${SQLCMDPASSWORD:?Falta SQLCMDPASSWORD}"
: "${API_PASSWORD:?Falta API_PASSWORD}" "${JOBS_PASSWORD:?Falta JOBS_PASSWORD}"

LOG="$(mktemp -t shopcart-migracion)"
sq() { sqlcmd -S "$DB_SERVIDOR" -U "$DB_USUARIO" -C -b -I "$@"; }

aplicado() {
  sq -d master -h -1 -W -Q "SET NOCOUNT ON; IF DB_ID('ShopCart') IS NOT NULL AND OBJECT_ID('ShopCart.Config.VersionEsquema') IS NOT NULL SELECT COUNT(*) FROM ShopCart.Config.VersionEsquema WHERE Script = '$1' ELSE SELECT 0;" | tr -d '[:space:]'
}

for archivo in 0*.sql; do
  [ "$archivo" = "015_Pruebas.sql" ] && continue
  [[ "${archivo:0:3}" < "$DESDE" ]] && continue
  # Una consulta fallida debe detener todo: nunca debe confundirse con un script ya aplicado.
  estado="$(aplicado "$archivo")" || { echo "No se pudo consultar el servidor"; exit 1; }
  case "$estado" in
    0) ;;
    1) echo "omitido  $archivo"; continue ;;
    *) echo "Respuesta inesperada del servidor: $estado"; exit 1 ;;
  esac
  echo "aplicando $archivo"
  sq -d master -i "$archivo" -v API_PASSWORD="$API_PASSWORD" -v JOBS_PASSWORD="$JOBS_PASSWORD" >>"$LOG" 2>&1 || { tail -20 "$LOG"; exit 1; }
  sq -d ShopCart -Q "INSERT Config.VersionEsquema (Script) VALUES ('$archivo');" >>"$LOG"
done

if [ "$PRUEBAS" = true ]; then
  sq -d ShopCart -i 015_Pruebas.sql
fi
echo "Listo. Registro en $LOG"
