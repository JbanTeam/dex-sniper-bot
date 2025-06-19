export const START_MESSAGE = `
<strong>Добро пожаловать в DexSniperMegaBot!</strong> 🔥🔥🔥

Бот автоматически регистрирует ваш кошелек в сетях:
<b>• Binance Smart Chain (BSC)</b>
<b>• Polygon</b>

<u><b>🔹 Основные возможности:</b></u>

<u>💰 Управление токенами:</u>
- Добавление до 5 токенов в каждой сети
- Удаление токенов (всех или конкретных)
- Проверка баланса

<u>🔄 Автоматическое дублирование сделок:</u>
- Подписка на кошельки
- Настройка лимитов покупки/продажи
- Оповещения о недостатке средств

<u>📤 Переводы средств:</u>
- Отправка нативных токенов и BEP-20/ERC-20
- Простой синтаксис команд

<u>📊 Мониторинг:</u>
- Просмотр токенов
- Просмотр подписок
- Просмотр кошельков
- Просмотр настроек дублирования сделок

<u>⚙️ Технические особенности:</u>
- Поддержка двух сетей (BSC - PancakeSwap / Polygon - Uniswap)
- Интуитивные команды
- Быстрые уведомления

Для начала работы:
1. Добавьте токен, которым вы будете торговать, командой /addtoken <i>[адрес_токена]</i>
2. Подпишитесь на кошелек, сделки с которого вы хотите повторять, командой /follow <i>[адрес_кошелька]</i>
3. Настройте повтор сделок, командой /replicate <i>[buy/sell] [лимит_суммы]</i>

📌 Используйте /help для более детального описания команд с примерами
`;

export const HELP_MESSAGE = `
Команды вводятся без квадратных скобок [...] и через пробел.

<u>Доступные команды:</u>
/start - Приветствие, описание функциональности бота
/help - Показать это сообщение с помощью
/wallets - Посмотреть адреса кошельков

<u>Управление токенами:</u>
/addtoken - Добавить токен (/addtoken <i>[адрес_токена]</i>)
/removetoken - Удалить токен(ы) (/removetoken - удалить все токены или все токены в сети; /removetoken <i>[адрес_токена]</i> - конкретный токен)
/tokens - Показать список моих токенов

<u>Управление подписками:</u>
/follow - Подписаться на кошелек (/follow <i>[адрес_кошелька]</i>)
/unfollow - Отписаться от кошелька (/unfollow <i>[адрес_кошелька]</i>)
/subscriptions - Показать мои текущие подписки

<u>Торговые функции:</u>
/replicate - Настроить повтор сделок (/replicate <i>[buy/sell] [лимит_суммы]</i>; /replicate buy 100 - установить лимит на покупку на 100 токенов; /replicate sell 100 - установить лимит на продажу на 100 токенов)
/replications - Посмотреть настройки дублирования сделок
/balance - Показать текущий баланс
/send - Отправить токены или нативную валюту (/send <i>[сумма] [адрес_получателя]</i> - отправить нативную валюту(BNB, POL); /send <i>[адрес_токена] [сумма] [адрес_получателя]</i> - отправить токен)
`;

export const commandsRegexp = {
  start: /^\/start/,
  help: /^\/help/,
  wallets: /^\/wallets/,
  addToken: /^\/addtoken/,
  removeToken: /^\/removetoken/,
  tokens: /^\/tokens/,
  follow: /^\/follow/,
  unfollow: /^\/unfollow/,
  subscriptions: /^\/subscriptions/,
  replicate: /^\/replicate/,
  replications: /^\/replications/,
  balance: /^\/balance/,
  send: /^\/send/,
  fakeTo: /^\/faketo/,
  fakeFrom: /^\/fakefrom/,
};

export const tgCommands = [
  { command: 'start', description: ' Приветствие, функциональность' },
  { command: 'help', description: 'Помощь' },
  { command: 'wallets', description: 'Посмотреть адреса кошельков' },
  { command: 'tokens', description: 'Посмотреть мои токены' },
  { command: 'subscriptions', description: 'Посмотреть мои подписки' },
  { command: 'replications', description: 'Посмотреть настройки дублирования сделок' },
  { command: 'balance', description: 'Посмотреть баланс' },
];

export const ENCRYPT_ALGORITHM = 'aes-256-gcm';
export const ENCRYPTED_KEY_LENGTH = 32;
export const ENCRYPTED_IV_LENGTH = 12;
export const LOG_ADDRESS_LENGTH = 26;
export const REGEXP_NUMBER = /^-?\d+$/;

export const eventsMap = {
  MONITOR_DEX_EVENT: 'monitorDex',
  NOTIFY_USER_EVENT: 'notifyUser',
};

export const EMPTY_PAIR_ADDRESS = '0x0000000000000000000000000000000000000000';
export const TRANSACTION_MAX_DEPTH = 3;
