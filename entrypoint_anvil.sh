#!/bin/sh

# Функция для сохранения состояния Anvil перед выходом
save_state() {
  echo "Saving Anvil state..."
  sleep 2
  curl -s -X POST --data '{"jsonrpc":"2.0","method":"anvil_dumpState","params":[],"id":1}' \
       -H "Content-Type: application/json" http://dex_sniper-anvil:8545 > /anvil_data/anvil-state.json
  echo "Anvil state saved."
  exit 0
}

# trap save_state SIGINT SIGTERM
trap 'save_state' INT TERM

# Запускаем Anvil с загрузкой состояния, если файл существует
if [ -f /data/anvil-state.json ]; then
  echo "Loading Anvil state..."
  anvil --load-state /anvil_data/anvil-state.json
else
  echo "Starting Anvil with new state..."
  anvil --state /anvil_data/anvil-state.json
fi