type User = {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

type Chat = {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type MessageEntity = {
  type:
    | 'mention'
    | 'hashtag'
    | 'bot_command'
    | 'url'
    | 'email'
    | 'bold'
    | 'italic'
    | 'code'
    | 'pre'
    | 'text_link'
    | 'text_mention';
  offset: number;
  length: number;
  url?: string;
  user?: User;
};

type InlineKeyboardButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

type InlineKeyboardMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

type Message = {
  message_id: number;
  from?: User;
  chat: Chat;
  date: number;
  text?: string;
  entities?: MessageEntity[];
  reply_markup?: InlineKeyboardMarkup;
};

type CallbackQuery = {
  id: number;
  from: User;
  message?: Message;
  inline_message_id?: string;
  chat_instance?: string;
  data?: string;
};

type TelegramUpdate = {
  update_id: number;
  message?: Message;
  callback_query?: CallbackQuery;
};

type TelegramUpdateResponse = {
  ok: boolean;
  result: TelegramUpdate[];
  description?: string;
};

export {
  TelegramUpdateResponse,
  TelegramUpdate,
  User,
  Chat,
  MessageEntity,
  InlineKeyboardButton,
  InlineKeyboardMarkup,
  Message,
  CallbackQuery,
};
