import { parseAbi } from 'viem';

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

export const tgCommands = [
  { command: 'start', description: ' Приветствие, функциональность' },
  { command: 'help', description: 'Помощь' },
  { command: 'wallets', description: 'Посмотреть адреса кошельков' },
  { command: 'tokens', description: 'Посмотреть мои токены' },
  { command: 'subscriptions', description: 'Посмотреть мои подписки' },
  { command: 'replications', description: 'Посмотреть настройки дублирования сделок' },
  { command: 'balance', description: 'Посмотреть баланс' },
];

export const parsedFactoryAbi = parseAbi([
  'function allPairs(uint256) view returns (address)',
  'function allPairsLength() view returns (uint256)',
  'function createPair(address tokenA, address tokenB) nonpayable returns (address pair)',
  'function feeTo() view returns (address)',
  'function feeToSetter() view returns (address)',
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
  'function setFeeTo(address _feeTo) nonpayable',
  'function setFeeToSetter(address _feeToSetter) nonpayable',
]);

export const parsedRouterAbi = parseAbi([
  'function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) nonpayable returns (uint256 amountA, uint256 amountB, uint256 liquidity)',
  'function addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)',
  'function factory() view returns (address)',
  'function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut) pure returns (uint256 amountIn)',
  'function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) pure returns (uint256 amountOut)',
  'function getAmountsIn(uint256 amountOut, address[] path) view returns (uint256[] amounts)',
  'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)',
  'function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) pure returns (uint256 amountB)',
  'function removeLiquidity(address tokenA, address tokenB, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) nonpayable returns (uint256 amountA, uint256 amountB)',
  'function removeLiquidityETH(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) nonpayable returns (uint256 amountToken, uint256 amountETH)',
  'function removeLiquidityETHSupportingFeeOnTransferTokens(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) nonpayable returns (uint256 amountETH)',
  'function removeLiquidityETHWithPermit(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline, bool approveMax, uint8 v, bytes32 r, bytes32 s) nonpayable returns (uint256 amountToken, uint256 amountETH)',
  'function removeLiquidityETHWithPermitSupportingFeeOnTransferTokens(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline, bool approveMax, uint8 v, bytes32 r, bytes32 s) nonpayable returns (uint256 amountETH)',
  'function removeLiquidityWithPermit(address tokenA, address tokenB, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline, bool approveMax, uint8 v, bytes32 r, bytes32 s) nonpayable returns (uint256 amountA, uint256 amountB)',
  'function swapETHForExactTokens(uint256 amountOut, address[] path, address to, uint256 deadline) payable returns (uint256[] amounts)',
  'function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[] amounts)',
  'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable',
  'function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) nonpayable returns (uint256[] amounts)',
  'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) nonpayable',
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) nonpayable returns (uint256[] amounts)',
  'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) nonpayable',
  'function swapTokensForExactETH(uint256 amountOut, uint256 amountInMax, address[] path, address to, uint256 deadline) nonpayable returns (uint256[] amounts)',
  'function swapTokensForExactTokens(uint256 amountOut, uint256 amountInMax, address[] path, address to, uint256 deadline) nonpayable returns (uint256[] amounts)',
]);

export const parsedPairAbi = parseAbi([
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
  'event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to)',
  'event Mint(address indexed sender, uint256 amount0, uint256 amount1)',
  'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)',
  'event Sync(uint112 reserve0, uint112 reserve1)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function DOMAIN_SEPARATOR() view returns (bytes32)',
  'function MINIMUM_LIQUIDITY() view returns (uint256)',
  'function PERMIT_TYPEHASH() view returns (bytes32)',
  'function allowance(address, address) view returns (uint256)',
  'function approve(address spender, uint256 value) nonpayable returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function burn(address to) nonpayable returns (uint256 amount0, uint256 amount1)',
  'function decimals() view returns (uint8)',
  'function factory() view returns (address)',
  'function getReserves() view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast)',
  'function initialize(address _token0, address _token1) nonpayable',
  'function kLast() view returns (uint256)',
  'function mint(address to) nonpayable returns (uint256 liquidity)',
  'function name() view returns (string)',
  'function nonces(address) view returns (uint256)',
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) nonpayable',
  'function price0CumulativeLast() view returns (uint256)',
  'function price1CumulativeLast() view returns (uint256)',
  'function skim(address to) nonpayable',
  'function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes data) nonpayable',
  'function symbol() view returns (string)',
  'function sync() nonpayable',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function transfer(address to, uint256 value) nonpayable returns (bool)',
  'function transferFrom(address from, address to, uint256 value) nonpayable returns (bool)',
]);
