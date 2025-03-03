import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Bot, session } from 'grammy';
import { UserService } from '@modules/user/user.service';
import { RedisService } from '@modules/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { startMessage } from '@src/utils/constants';
import { BotContext, SessionData } from '@src/types/types';
// import { BlockchainService } from '../blockchain/blockchain.service';
// import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: Bot<BotContext>;

  constructor(
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,

    // private readonly blockchainService: BlockchainService,
    // private readonly subscriptionService: SubscriptionService,
  ) {
    this.bot = new Bot<BotContext>(this.configService.get<string>('TELEGRAM_BOT_TOKEN', ''));
    this.setupSession();
    this.registerMiddlewares();
    this.registerCommands();
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

      ctx.session.userId = user.id;
      ctx.session.chatId = ctx.chat.id;
      ctx.session.telegramUserId = ctx.from.id;

      ctx.state = { action };

      await next();
    });
  }

  private registerCommands() {
    this.bot.command('start', async ctx => {
      const { action } = ctx.state;

      if (action === 'get') {
        await ctx.reply(startMessage, { parse_mode: 'HTML' });
        return;
      }

      await ctx.reply(startMessage, { parse_mode: 'HTML' });
      await ctx.reply(`Вы были успешно зарегистрированы!`, { parse_mode: 'HTML' });
    });
  }

  private registerErrorHandler() {
    this.bot.catch(err => {
      console.log(err.error);
      console.error(`Telegram error: ${err.message}`);
    });
  }

  async sendMessage(chatId: number, message: string) {
    await this.bot.api.sendMessage(chatId, message);
  }

  async notifyUser({ userId, message, ctx }: { userId: number; message: string; ctx: BotContext }) {
    if (ctx.session.chatId) {
      return await this.sendMessage(ctx.session.chatId, message);
    }

    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.sendMessage(user.chatId, message);
  }
}
