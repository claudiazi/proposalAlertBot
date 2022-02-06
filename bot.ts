import { Bot, GrammyError, HttpError } from "grammy";
import { botParams, getKeyboard } from "./config.js";
import { apiThrottler, APIThrottlerOptions } from "@grammyjs/transformer-throttler";
import { run, RunnerHandle } from "@grammyjs/runner";
import { getUserCollection } from "./src/mongo/index.js";
import { listAlertsMiddleware } from "./src/alert/listAlerts.js";
import { addAlertMiddleware, enterAddress } from "./src/alert/addAlert.js";
import { Bottleneck } from "@grammyjs/transformer-throttler/dist/deps.node";

export const start = async (): Promise<{ runnerHandle: RunnerHandle, tBot: Bot; }> => {

  /*
   *   BOT initialization
   */

  const bot = new Bot(botParams.settings.botToken);
  // const outConfig: Bottleneck.ConstructorOptions = {
  //   maxConcurrent: 1, // only 1 job at a time
  //   minTime: 1000, // wait this many milliseconds to be ready, after a job
  // };
  // const throttleOptions: APIThrottlerOptions = {
  //   out: outConfig
  // };
  //bot.api.config.use(apiThrottler(throttleOptions));

  /*
   *   /start command handler
   */

  bot.command("start", async (ctx) => {
    if (ctx.chat.type == "private") {
      const userCol = await getUserCollection();
      const user = await userCol.findOne({ chatId: ctx.chat.id });

      let message: string;
      //normal start
      if (!user) {
        await userCol.insertOne({
          firstName: ctx.chat.first_name,
          username: ctx.chat.username,
          chatId: ctx.chat.id,
          type: ctx.chat.type,
          blocked: false,
          createdAt: new Date()
        });
      }
      if (user && user.blocked) {
        await userCol.findOneAndUpdate({ chatId: ctx.chat.id },
          {
            $set: { blocked: false }
          }
        );
      }
      message = `Welcome to the ${botParams.settings.network.name} ProposalAlert bot.\n\n` +
        `The days of refreshing polkadot.js or doTreasury ` +
        `are over!\n\nSimply add an alert for your wallet and I will notify you here of any changes ` +
        `to your proposal requests.`;
      await ctx.reply(
        message,
        {
          reply_markup: {
            keyboard: (await getKeyboard(ctx)).build(),
            resize_keyboard: true
          },
          parse_mode: "Markdown",
        }
      );
    }
  });

  /*
   *   /menu command handler
   */

  bot.command("menu", async (ctx) => {
    if (ctx.chat.type == "private") {
      const message = "Here you go";
      await ctx.reply(
        message,
        {
          reply_markup: {
            keyboard: (await getKeyboard(ctx)).build(),
            resize_keyboard: true
          },
          parse_mode: "Markdown",
        }
      );
    }
  });

  /*
   *   react bot on '➕ Add alert' message
   */

  bot.hears("➕ Add alert", async (ctx) => {
    if (ctx.chat.type == "private") {
      addAlertMiddleware.replyToContext(ctx);
    }
  });

  bot.use(addAlertMiddleware);

  bot.use(listAlertsMiddleware);

  bot.use(enterAddress.middleware());

  /*
   *   react bot on '📒 My addresses/alerts' message
   */

  bot.hears("📒 My addresses/alerts", async (ctx) => {
    if (ctx.chat.type == "private") {
      listAlertsMiddleware.replyToContext(ctx);
    }
  });

  /*
   *   Handle all unhandled callback queries
   */

  bot.on("callback_query:data", async (ctx, next) => {
    console.log("Unknown button event with payload", ctx.callbackQuery.data);
    await ctx.answerCallbackQuery(); // remove loading animation
  });

  /*
   *   Collect and show in console all bot errors
   */
  bot.catch(async (err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof GrammyError) {
      if (e.description.includes("bot was blocked by the user")) {
        const userCol = await getUserCollection();
        await userCol.findOneAndUpdate({ chatId: ctx.chat.id },
          {
            $set: { blocked: true }
          }
        );
        console.log(new Date(), `Bot was blocked by user with chatid ${e.payload.chat_id}`);
        return;
      }
      console.error("Error in request:", e.description);
    } else if (e instanceof HttpError) {
      console.error("Could not contact Telegram:", e);
    } else {
      console.error("Unknown error:", e);
    }
  });
  const runnerHandle = run(bot);
  console.log(new Date(), "Bot started as", bot);
  return { runnerHandle, tBot: bot };
};