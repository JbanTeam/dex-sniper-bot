import { CallbackQuery, Message } from './types';

function isMessageUpdate(update: Message | CallbackQuery): update is Message {
  return 'message_id' in update && 'chat' in update && typeof update.chat.id === 'number';
}

function isCallbackQueryUpdate(update: Message | CallbackQuery): update is CallbackQuery {
  return 'id' in update && 'from' in update && typeof update.from.id === 'number';
}

export { isMessageUpdate, isCallbackQueryUpdate };
