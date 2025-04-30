import { parseAbi } from 'viem';

export const startMessage = `
<strong>Добро пожаловать в DexSniperMegaBot!</strong> 🔥🔥🔥

Бот автоматически регистрирует ваш кошелек в сетях <b><u>Binance Smart Chain</u></b> и <b><u>Polygon</u></b>.

<b><u>Бот имеет следующую функциональность:</u></b>
пользователь может добавлять до 5 токенов для каждой из сетей, удалять токены из списка;
просмотр баланса для каждого из токенов;
подписка на другие кошельки для дублирования их сделок;
настройка дублирования сделок: купля/продажа, лимит суммы;
просмотр своих подписок, удаление кошелька из списка;
оповещение о недостатке средств для дублирования сделок;
перевод токенов на другой кошелек.

Используйте команду /help, чтобы увидеть список команд.
`;

export const helpMessage = `
Доступные команды:
/start - Приветствие, функциональность
/help - Помощь
/addtoken - Добавить токен, /addtoken [адрес_токена]
/removetoken - Удалить токены, /removetoken [адрес_токена] - удалить токен
/balance - Посмотреть баланс
/subscriptions - Посмотреть мои подписки
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

// { command: 'start', description: ' Приветствие, функциональность' },
//       { command: 'help', description: 'Помощь' },
//       { command: 'addtoken', description: 'Добавить токен, /addtoken [адрес_токена]' },
//       { command: 'removetoken', description: 'Удалить токены, /removetoken [адрес_токена] - удалить токен' },
//       { command: 'mytokens', description: 'Посмотреть мои токены' },
//       { command: 'follow', description: 'Подписаться на кошелек, /follow [адрес_кошелька]' },
//       { command: 'unfollow', description: 'Отписаться от кошелька, /unfollow [адрес_кошелька]' },
//       { command: 'subscriptions', description: 'Посмотреть мои подписки' },
//       { command: 'replicate', description: 'Установить какие сделки повторять, /replicate [buy/sell] [лимит суммы]' },
//       { command: 'balance', description: 'Посмотреть баланс' },
//       { command: 'send', description: 'Отправить токены, /send [адрес токена] [сумма] [адрес получателя]' },
//       { command: 'send', description: 'Отправить токены, /send [адрес токена] [сумма] [адрес получателя]' },

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

const httpStatusMap = new Map([
  [100, 'Continue'],
  [101, 'Switching Protocols'],
  [102, 'Processing'],
  [103, 'Early Hints'],
  [200, 'OK'],
  [201, 'Created'],
  [202, 'Accepted'],
  [203, 'Non-Authoritative Information'],
  [204, 'No Content'],
  [205, 'Reset Content'],
  [206, 'Partial Content'],
  [300, 'Multiple Choices'],
  [301, 'Moved Permanently'],
  [302, 'Found'],
  [303, 'See Other'],
  [304, 'Not Modified'],
  [307, 'Temporary Redirect'],
  [308, 'Permanent Redirect'],
  [400, 'Bad Request'],
  [401, 'Unauthorized'],
  [402, 'Payment Required'],
  [403, 'Forbidden'],
  [404, 'Not Found'],
  [405, 'Method Not Allowed'],
  [406, 'Not Acceptable'],
  [407, 'Proxy Authentication Required'],
  [408, 'Request Timeout'],
  [409, 'Conflict'],
  [410, 'Gone'],
  [411, 'Length Required'],
  [412, 'Precondition Failed'],
  [413, 'Payload Too Large'],
  [414, 'URI Too Long'],
  [415, 'Unsupported Media Type'],
  [416, 'Range Not Satisfiable'],
  [417, 'Expectation Failed'],
  [418, "I'm a teapot"],
  [422, 'Unprocessable Entity'],
  [425, 'Too Early'],
  [426, 'Upgrade Required'],
  [428, 'Precondition Required'],
  [429, 'Too Many Requests'],
  [431, 'Request Header Fields Too Large'],
  [451, 'Unavailable For Legal Reasons'],
  [500, 'Internal Server Error'],
  [501, 'Not Implemented'],
  [502, 'Bad Gateway'],
  [503, 'Service Unavailable'],
  [504, 'Gateway Timeout'],
  [505, 'HTTP Version Not Supported'],
  [506, 'Variant Also Negotiates'],
  [507, 'Insufficient Storage'],
  [508, 'Loop Detected'],
  [510, 'Not Extended'],
  [511, 'Network Authentication Required'],
]);

export { httpStatusMap };
