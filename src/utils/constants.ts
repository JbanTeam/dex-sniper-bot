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
