#!/bin/sh
# Baut das homepage-Kito-Image auf dem PC und pusht es zu Docker Hub.
# Voraussetzung: einmalig `docker login` ausgeführt.
#
# Image-Name kommt aus dem Argument $1 oder aus .env (DOCKERHUB_IMAGE).
# Beispiel:
#   ./scripts/docker-build-push.sh
#   ./scripts/docker-build-push.sh deinuser/homepage-kito:latest
set -e

# .env (falls vorhanden) laden, um DOCKERHUB_IMAGE zu bekommen.
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

IMAGE="${1:-$DOCKERHUB_IMAGE}"
if [ -z "$IMAGE" ]; then
  echo "Fehler: kein Image-Name. Setze DOCKERHUB_IMAGE in .env (z. B. deinuser/homepage-kito:latest)"
  echo "        oder übergib ihn als Argument: ./scripts/docker-build-push.sh user/homepage-kito:latest"
  exit 1
fi

echo "==> Baue $IMAGE"
docker build -t "$IMAGE" .

echo "==> Pushe $IMAGE zu Docker Hub"
docker push "$IMAGE"

echo "==> Fertig. Auf dem Server: docker compose pull && docker compose up -d"
