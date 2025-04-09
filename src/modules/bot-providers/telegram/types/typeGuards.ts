import { TgCallbackQuery, TgMessage } from './types';

function isMessageUpdate(update: TgMessage | TgCallbackQuery): update is TgMessage {
  return 'message_id' in update && 'chat' in update && typeof update.chat.id === 'number';
}

function isCallbackQueryUpdate(update: TgMessage | TgCallbackQuery): update is TgCallbackQuery {
  return 'id' in update && 'from' in update && typeof update.from.id === 'number';
}

export { isMessageUpdate, isCallbackQueryUpdate };
