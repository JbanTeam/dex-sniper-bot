# Dex Sniper Bot

Dex Sniper Bot — это телеграм-бот для трейдеров, который автоматически повторяет сделки выбранных кошельков в сетях Binance Smart Chain (PancakeSwap v2) и Polygon (Uniswap v2). Пользователь добавляет интересующие токены и подписывается на кошельки, сделки которых хочет отслеживать, а так же задает параметры повтора сделок. При новых сделках бот дублирует их, если параметры дублирования соответствуют.

Бот разработан с использованием:

- TypeScript, NestJS - серверная логика и телеграм-интеграция
- PostgreSQL, TypeORM - хранение информации о пользователях, токенах, кошельках, подписках
- Redis - кеширование, хранение сессий
- Docker, Docker Compose - удобный запуск и деплой
- Viem - работа с блокчейном
- Anvil - развертывание тестовой DEX
- Jest - unit и интеграционное тестирование
- Husky, Lint staged - git hooks, lint сообщений коммита

---

## Функциональность

🔹 Базовые сети

- Поддержка сетей Binance Smart Chain (BSC) и Polygon
- Подключение к DEX: PancakeSwapV2 и UniswapV2

💰 Управление токенами

- Добавление до 5 токенов в каждой сети
- Удаление всех или конкретных токенов
- Просмотр списка токенов
- Получение баланса токенов и нативной валюты

🔄 Автокопирование сделок

- Подписка на любые EVM-кошельки
- Автоматическое повторение сделок покупки/продажи
- Настройка лимитов на покупку/продажу
- Проверка доступности средств
- Уведомления при нехватке баланса

📤 Переводы средств

- Отправка токенов (ERC-20)
- Отправка нативной валюты (BNB, POl)

📊 Мониторинг и контроль

- Список кошельков
- Список подписок
- Отображение текущих лимитов дублирования сделок

---

## User flow

При запуске бота пользователь регистрируется, создаются кошельки для сетей Binance Smart Chain (BSC) и Polygon.

Для начала работы:

1. Добавьте токен, которым вы будете торговать, командой /addtoken `[адрес_токена]`.
2. Подпишитесь на кошелек, сделки с которого вы хотите повторять, командой /follow `[адрес_кошелька]`.
3. Настройте повтор сделок, командой /replicate `[buy/sell]` `[лимит_суммы]`. Лимит устанавливается на количество токенов.
4. Пополните баланс.

Если пользователь удаляет токен или подписку, параметры повтора сделок, установленные для этого токена и этой подписки, тоже удаляются.
При удалении токена его баланс не будет отображаться, чтобы его увидеть нужно заново добавить токен.

/help - детальное описание всех команд.

## Установка и запуск

Необходимо добавить в .env, .env.dev ваш TELEGRAM_BOT_TOKEN.

При старте в режиме разработки разворачиваются контейнеры с приложением, postgres, redis и anvil.
Устанавливается тестовый баланс для кошельков (1000 в нативнвой валюте).
При первом запуске разворачивается тестовая DEX (UniswapV2).
Когда добавляется новый токен, автоматически разворачивается контракт такого же тестового токена (все параметры идентичны, кроме адреса).
Добавляется ликвидность и депозит WBNB (wrapped native token). Пользователю выдается 1000000 токенов.
Проскальзывание установлено в 3%.

Токены для тестирования (BSC):
Baby Doge Coin - 0xc748673057861a797275CD8A068AbB95A902e8de
PancakeSwap Token - 0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82

Адрес подписки для тестирования (автоматически создается при запуске anvil - баланс 10000 в нативной валюте)
0x70997970C51812dc3A010C7d01b50e0d17dc79C8

Для имитации совершения сделки на DEX используйте команды:
/faketo - обмен 1 BNB/POL на 1000 токенов (для повтора сделки необходимо ввести команду /replicate buy 1000)
/fakefrom - обмен 1000 токенов на 1 BNB/POL (для повтора сделки необходимо ввести команду /replicate sell 1000)

Обмен происходит на первый добавленный токен.

Предусмотрена возможность подключения других бот провайдеров (discord, whatsapp); а также добавление других сетей, не только которые поддерживаются viem (ton, sol).

### Требования

- **Docker** версии 26.1.1 или выше.

### Установка

1. Клонируйте репозиторий:

```bash
git clone https://github.com/JbanTeam/dex-sniper-bot.git
```

2. Перейдите в папку проекта:

```bash
cd dex-sniper-bot
```

3. Установите зависимости:

```bash
npm install
```

4. Запустите сервер в docker контейнере:

- **в dev режиме**

```bash
npm run dc:cmp:dev
```

С пересборкой image:

```bash
npm run dc:cmp:devb
```

- **в prod режиме**

```bash
npm run dc:cmp:prod
```

С пересборкой image:

```bash
npm run dc:cmp:prodb
```

5. Начальная миграция имеется в проекте и она будет применена автоматически. Чтобы сгенерировать и применить новую миграцию:

```bash
npm run migration:gen -- src/db/migrations/{имя_миграции}
npm run migration:run:local
```

6. Остановка и удаление контейнера:

```bash
npm run dc:cmp:down
```

### Тестирование

1. Unit

1.1 Запуск всех unit тестов:

```bash
npm run test
```

1.2 Запуск unit тестов по файлам:

```bash
npm run test -- --testPathPattern=src/modules/redis/tests/redis.service.test.ts
npm run test -- --testPathPattern=src/modules/wallet/tests/wallet.service.test.ts
npm run test -- --testPathPattern=src/modules/user/tests/user.service.test.ts
npm run test -- --testPathPattern=src/modules/user-token/tests/user-token.service.test.ts
npm run test -- --testPathPattern=src/modules/blockchain/tests/blockchain.service.test.ts
npm run test -- --testPathPattern=src/modules/blockchain/viem/tests/viem.provider.test.ts
npm run test -- --testPathPattern=src/modules/blockchain/viem/tests/viem-helper.provider.test.ts
npm run test -- --testPathPattern=src/modules/blockchain/viem/anvil/tests/anvil.provider.test.ts
npm run test -- --testPathPattern=src/modules/bot-providers/telegram/handlers/tests/TgCommandHandler.test.ts
npm run test -- --testPathPattern=src/modules/bot-providers/telegram/handlers/tests/TgQueryHandler.test.ts
```

2. Integration

2.1 Запустите тестовую базу данных (Postgres и Redis):

```bash
npm run db:test:up
```

2.2 Запуск всех integration тестов:

```bash
npm run test:integration
```

2.2 Запуск integration тестов по файлам:

```bash
npm run test:integration tests/wallet.integration.test.ts
npm run test:integration tests/user.integration.test.ts
npm run test:integration tests/user-token.integration.test.ts
npm run test:integration tests/blockchain.integration.test.ts
npm run test:integration tests/subscription.integration.test.ts
npm run test:integration tests/replication.integration.test.ts
```

2.3 Остановка и удаление контейнера с тестовой базой данных:

```bash
npm run db:test:down
```
