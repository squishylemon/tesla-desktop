# Shared Docker helper for install scripts (POSIX sh)

docker_cmd() {
  if [ -n "${DOCKER_CMD:-}" ]; then
    # shellcheck disable=SC2086
    $DOCKER_CMD "$@"
    return $?
  fi

  if docker info >/dev/null 2>&1; then
    docker "$@"
    return $?
  fi

  if command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
    echo "Note: using sudo for Docker. To fix permanently:"
    echo "  sudo usermod -aG docker \$USER"
    echo "  newgrp docker   # or log out and back in"
    echo ""
    sudo docker "$@"
    return $?
  fi

  echo "Cannot access Docker (permission denied on /var/run/docker.sock)."
  echo ""
  echo "Do not run: sudo curl ... | sh"
  echo "That only elevates curl, not docker compose."
  echo ""
  echo "Fix (pick one):"
  echo "  1. Add your user to the docker group:"
  echo "       sudo usermod -aG docker \$USER"
  echo "       newgrp docker"
  echo "  2. Or run docker with sudo for this install:"
  echo "       DOCKER_CMD=\"sudo docker\" curl -fsSL .../install-relay.sh | sh"
  echo ""
  exit 1
}

docker_compose() {
  if docker compose version >/dev/null 2>&1; then
    docker_cmd compose "$@"
    return $?
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    if [ -n "${DOCKER_CMD:-}" ]; then
      # shellcheck disable=SC2086
      $DOCKER_CMD docker-compose "$@"
    elif docker info >/dev/null 2>&1; then
      docker-compose "$@"
    else
      sudo docker-compose "$@"
    fi
    return $?
  fi
  echo "docker compose not found. Install Docker Compose plugin or docker-compose."
  exit 1
}
