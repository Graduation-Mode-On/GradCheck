#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/gradcheck}"

if ! command -v sudo >/dev/null 2>&1; then
  echo "This setup script requires sudo." >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

if ! command -v docker >/dev/null 2>&1; then
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo rm -f /etc/apt/keyrings/docker.gpg
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

sudo mkdir -p "$DEPLOY_PATH/app"
sudo chown -R "$USER:$USER" "$DEPLOY_PATH"
sudo usermod -aG docker "$USER"

if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow OpenSSH
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
fi

docker --version || sudo docker --version
docker compose version || sudo docker compose version
echo "Server setup complete. Log out and back in before running Docker without sudo."
