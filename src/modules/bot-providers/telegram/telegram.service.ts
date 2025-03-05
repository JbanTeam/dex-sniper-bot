import { Address } from 'viem';
import { ConfigService } from '@nestjs/config';
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Bot, GrammyError, HttpError, InlineKeyboard, session } from 'grammy';

import { UserService } from '@modules/user/user.service';
import { RedisService } from '@modules/redis/redis.service';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { chains, startMessage } from '@src/utils/constants';
import { BotContext, Network, SessionData } from '@src/types/types';

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: Bot<BotContext>;

  constructor(
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly blockchainService: BlockchainService,
  ) {
    this.bot = new Bot<BotContext>(this.configService.get<string>('TELEGRAM_BOT_TOKEN', ''));
    this.setCommands();
    this.setupSession();
    this.registerMiddlewares();
    this.registerCommands();
    this.addEventListeners();
    this.registerErrorHandler();
  }

  onModuleInit() {
    this.bot
      .start()
      .then(() => console.log('Bot started'))
      .catch(console.error);
  }

  private setupSession() {
    this.bot.use(
      session({
        initial(): SessionData {
          return {};
        },
        storage: this.redisService.getStorage(),
      }),
    );
  }

  private registerMiddlewares() {
    this.bot.use(async (ctx, next) => {
      if (!ctx.from) return;
      if (!ctx.chat) return;

      if (ctx.session.chatId === ctx.chat.id && ctx.session.telegramUserId === ctx.from.id) {
        ctx.state = { action: 'get' };
        await next();
        return;
      }

      const { user, action } = await this.userService.getOrCreateUser({
        chatId: ctx.chat.id,
        telegramUserId: ctx.from.id,
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      ctx.session.userId = user.id;
      ctx.session.chatId = ctx.chat.id;
      ctx.session.telegramUserId = ctx.from.id;
      ctx.session.wallets = [...user.wallets];

      ctx.state = { action };

      await next();
    });
  }

  private setCommands() {
    this.bot.api
      .setMyCommands([
        { command: '/start', description: 'Приветствие, функциональность' },
        { command: '/help', description: 'Помощь' },
        { command: '/addtoken', description: 'Добавить токен, /addtoken [адрес_токена]' },
        { command: '/removetoken', description: 'Добавить токен, /removetoken [адрес_токена]' },
        { command: '/balance', description: 'Посмотреть баланс' },
        { command: '/my_subscribes', description: 'Посмотреть мои подписки' },
      ])
      .catch(console.error);
  }

  private registerCommands() {
    this.bot.command('start', async ctx => {
      const { action } = ctx.state;

      if (action === 'get') {
        await ctx.reply(startMessage, { parse_mode: 'HTML' });
        return;
      }

      await ctx.reply(startMessage, { parse_mode: 'HTML' });

      const walletMessages = ctx.session.wallets?.map(wallet => {
        return `<b>${wallet.network}</b> - <code>${wallet.address}</code>`;
      });

      const registrationMessge = `<b>Вы были успешно зарегистрированы!</b>\n\n<b>Ваши кошельки:</b>\n${walletMessages?.join('\n')}`;

      await ctx.reply(registrationMessge, { parse_mode: 'HTML' });
    });

    this.bot.command('addtoken', async ctx => {
      if (!ctx.message || !ctx.session.userId) return;

      const [, tokenAddress] = ctx.message.text.split(' ');
      if (!tokenAddress) {
        await ctx.reply('Введите адрес токена. Пример: /addtoken [адрес_токена]');
        return;
      }

      ctx.session.tempToken = tokenAddress;

      const keyboard = new InlineKeyboard();
      const chainsArr = Object.entries(chains(this.configService));
      chainsArr.forEach(([keyNetwork, value]) => {
        keyboard.text(value.name, `net-${keyNetwork}`);
      });

      await ctx.reply('Выберите сеть, в которой находится ваш токен', { reply_markup: keyboard });
    });

    this.bot.command('balance', async ctx => {
      if (!ctx.message || !ctx.session.userId || !ctx.session.wallets) return;

      const keyboard = new InlineKeyboard();
      ctx.session.wallets.forEach(wallet => {
        keyboard.text(`${wallet.network}: ${wallet.address}`, `wallet-${wallet.id}`);
      });

      await ctx.reply('Выберите кошелек', { reply_markup: keyboard });
    });
  }

  private registerErrorHandler() {
    this.bot.catch(err => {
      const ctx = err.ctx;
      console.error(`Error while handling update ${ctx.update.update_id}:`);
      const e = err.error;
      if (e instanceof GrammyError) {
        console.error('Error in request:', e.description);
      } else if (e instanceof HttpError) {
        console.error('Could not contact Telegram:', e);
      } else {
        console.error('Unknown error:', e);
      }
    });
  }

  async sendMessage({ chatId, message }: { chatId: number; message: string }) {
    await this.bot.api.sendMessage(chatId, message);
  }

  async notifyUser({ userId, message, ctx }: { userId: number; message: string; ctx: BotContext }) {
    if (ctx.session.chatId) {
      return await this.sendMessage({ chatId: ctx.session.chatId, message });
    }

    const user = await this.userService.findById({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.sendMessage({ chatId: user.chatId, message });
  }

  private addEventListeners() {
    this.bot.callbackQuery(/^net-(.+)/, async ctx => {
      await this.networkKeyboardCb(ctx);
    });

    this.bot.callbackQuery(/^wallet-(.+)/, async ctx => {
      await this.balanceKeyboardCb(ctx);
    });
  }

  private async balanceKeyboardCb(ctx: BotContext) {
    if (!ctx.match || !ctx.session.userId || !ctx.session.wallets) return;
    const walletId = +ctx.match[1];

    try {
      const wallet = ctx.session.wallets.find(wallet => wallet.id === walletId);

      if (!wallet) {
        await ctx.reply('Кошелек не найден');
        return;
      }

      const balance = await this.blockchainService.getBalance({
        address: wallet.address as Address,
        network: wallet.network,
      });

      let reply = `<b>Баланс кошелька:</b>\n`;
      reply += `<b>Сеть:</b> ${wallet.network}\n`;
      reply += `<b>Адрес:</b> <code>${wallet.address}</code>\n`;
      reply += `<b>Баланс:</b> ${balance}\n`;

      await ctx.deleteMessage();
      await ctx.reply(reply, { parse_mode: 'HTML' });
    } catch (error) {
      await ctx.deleteMessage();
      await ctx.reply(`${error.message}`);
    }
  }

  private async networkKeyboardCb(ctx: BotContext) {
    if (!ctx.match || !ctx.session.tempToken || !ctx.session.userId) return;
    const network = ctx.match[1] as Network;
    const tokenAddress = ctx.session.tempToken;
    const userId = ctx.session.userId;

    try {
      const tokens = await this.userService.addToken({
        userId,
        address: tokenAddress as Address,
        network: network,
      });

      delete ctx.session.tempToken;

      let reply = `Токен успешно добавлен 🔥🔥🔥\n\n<u>Ваши токены:</u>\n`;

      tokens.forEach((token, index) => {
        reply += `${index + 1}. <b>Сеть:</b> <u>${token.network}</u> / <b>Токен:</b> <u>${token.name} (${token.symbol})</u>\n<code>${token.address}</code>\n\n`;
      });

      await ctx.deleteMessage();
      await ctx.reply(reply, { parse_mode: 'HTML' });
    } catch (error) {
      await ctx.deleteMessage();
      await ctx.reply(`${error.message}`);
    }
  }
}
