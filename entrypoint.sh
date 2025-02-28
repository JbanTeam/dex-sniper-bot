#!/bin/sh

echo "Applying migrations..."
if [ "$NODE_ENV" = "production" ]; then
  npm run migration:run && {
  echo "Migrations applied successfully!"
} || {
  echo "Failed to apply migrations!"
  exit 1
}
else
  npm run migration:run:dev && {
    echo "Migrations applied successfully!"
  } || {
    echo "Failed to apply migrations!"
    exit 1
  }
fi

sleep 5

echo "Starting server..."
if [ "$NODE_ENV" = "production" ]; then
  exec npm run start:prod
else
  exec npm run start:dev
fi

# Применение миграций и запуск сервера с записью в лог файл

# LOG_FILE="migration.log"

# > $LOG_FILE

# log() {
#   echo "$1" | tee -a $LOG_FILE
# }

# # # log "Waiting for database to be ready..."
# # # until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" >> $LOG_FILE 2>&1; do
# # #   sleep 2
# # # done
# # # log "Database is ready!"

# log "Applying migrations..."
# for i in {1..5}; do
#   if [ "$NODE_ENV" = "production" ]; then
#     npm run migration:run >> $LOG_FILE 2>&1 && {
#     log "Migrations applied successfully!"
#     break
#   }
#   else
#     npm run migration:run:dev >> $LOG_FILE 2>&1 && {
#     log "Migrations applied successfully!"
#     break
#   }
#   fi
#   log "Migration attempt $i failed, retrying in 5 seconds..."
#   sleep 5
# done

# if grep -q "Migrations applied successfully!" $LOG_FILE; then
#   log "Migration process completed."
# else
#   log "Failed to apply migrations!"
#   exit 1
# fi

# sleep 5

# log "Starting server..."
# if [ "$NODE_ENV" = "production" ]; then
#   exec npm run start:prod >> $LOG_FILE 2>&1
# else
#   npm run start:dev >> $LOG_FILE 2>&1
# fi
