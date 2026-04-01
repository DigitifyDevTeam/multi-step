#!/usr/bin/env bash
set -euo pipefail

# Loads key=value pairs from .env into current shell environment.
# Usage:
#   source ./load_env.sh

ENV_FILE="${ENV_FILE:-.env}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "load_env.sh: env file not found: ${ENV_FILE}" >&2
  return 1 2>/dev/null || exit 1
fi

while IFS= read -r line || [[ -n "$line" ]]; do
  # Trim leading/trailing whitespace
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"

  # Skip blanks and comments
  [[ -z "$line" ]] && continue
  [[ "${line:0:1}" == "#" ]] && continue

  # Skip invalid lines
  [[ "$line" != *"="* ]] && continue

  key="${line%%=*}"
  value="${line#*=}"

  # Trim whitespace around key/value
  key="${key%"${key##*[![:space:]]}"}"
  key="${key#"${key%%[![:space:]]*}"}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"

  # Strip surrounding quotes
  if [[ ( "${value:0:1}" == "'" && "${value: -1}" == "'" ) || ( "${value:0:1}" == "\"" && "${value: -1}" == "\"" ) ]]; then
    value="${value:1:-1}"
  fi

  if [[ -n "$key" ]]; then
    export "$key=$value"
  fi
done < "${ENV_FILE}"

