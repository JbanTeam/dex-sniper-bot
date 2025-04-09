import { IncomingMessage, IncomingQuery } from '@src/types/types';

type TgUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

type TgChat = {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type TgMessageEntity = {
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
  user?: TgUser;
};

type TgSendMsgParams = {
  chatId: number;
  text: string;
  options?: TgSendMessageOptions;
};

type TgDeleteMsgParams = {
  chatId: number;
  messageId: number;
};

type TgSendMessageOptions = {
  parse_mode?: 'html' | 'markdown' | 'markdownv2';
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
  reply_markup?: object;
};

type TgCommandReturnType = {
  text: string;
  options?: TgSendMessageOptions;
};

type TgCommandFunction = (message: IncomingMessage) => Promise<{ text: string; options?: TgSendMessageOptions }>;
type TgQueryFunction = (query: IncomingQuery) => Promise<{ text: string; options?: TgSendMessageOptions }>;

type InlineKeyboardButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

type InlineKeyboardMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

type TgMessage = {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  date: number;
  text?: string;
  entities?: TgMessageEntity[];
  reply_markup?: InlineKeyboardMarkup;
};

type TgCallbackQuery = {
  id: number;
  from: TgUser;
  message?: TgMessage;
  inline_message_id?: string;
  chat_instance?: string;
  data?: string;
};

type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
};

type TgUpdateResponse = {
  ok: boolean;
  result: TgUpdate[];
  description?: string;
};

export {
  TgSendMsgParams,
  TgDeleteMsgParams,
  TgSendMessageOptions,
  TgCommandReturnType,
  TgCommandFunction,
  TgQueryFunction,
  TgUpdateResponse,
  TgUpdate,
  TgUser,
  TgChat,
  TgMessageEntity,
  InlineKeyboardButton,
  InlineKeyboardMarkup,
  TgMessage,
  TgCallbackQuery,
};
