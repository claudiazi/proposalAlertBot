import { checkAddress } from "@polkadot/util-crypto";
import { Context } from "grammy";
import { MenuTemplate, MenuMiddleware, createBackMainMenuButtons, deleteMenuFromContext } from "grammy-inline-menu";
import _ from "lodash";
import { getAlertCollection } from "../mongo/index.js";
import { StatelessQuestion } from '@grammyjs/stateless-question';
import { botParams, getKeyboard } from "../../config.js";

const alerts = [
    {
        name: "new",
        selected: true,
    },
    {
        name: "voted",
        selected: true,
    },
    {
        name: "done",
        selected: true,
    }
];

let userAlerts = alerts;

export const addAlert = new MenuTemplate(async (ctx: Context) => {
    let info = `What events would you like to get alerts for?\n\n` + 
    `new - get notified when a motion is created for a proposal that your wallet is involved in\n` + 
    `voted - get notified when that motion is voted on\n` +
    `done - get notified when that motion is fully voted on`;
    if (userAlerts.filter(e => e.selected).length == 0) {
        info += `\n\nPlease select at least one event for which you would like to receive alerts.`;
    }
    return { text: info, parse_mode: "Markdown" };
});

addAlert.select(
    "a",
    ctx => {
        return userAlerts.map(a => a.name);
    },
    {
        showFalseEmoji: true,
        isSet: (ctx, key) => userAlerts.find(
            e => e.name === key
        ).selected,
        set: (ctx, key, newState) => {
            userAlerts.find(
                e => e.name == key
            ).selected = newState;
            return true;
        },
        columns: 1
    }
);

addAlert.interact(
    "Next step >",
    "ns",
    {
        do: async (ctx) => {
            await deleteMenuFromContext(ctx);
            var replyMsg = `You have selected the following events:
            `;
            userAlerts
                .filter(u => u.selected)
                .forEach(
                    e =>
                    (replyMsg += `
    - ${userAlerts.find(m => m.name == e.name).name}`)
                );
            replyMsg += `
            
Please send me a public address of a ${botParams.settings.network.name} account ` +
                `that you want to link to these events.`;
            enterAddress.replyWithMarkdown(ctx, replyMsg);
            return false;
        },
        hide: ctx => {
            if (userAlerts.filter(e => e.selected).length == 0)
                return true;
            return false;
        },
    }
);

export const enterAddress = new StatelessQuestion("adr", async (ctx) => {
    let isValid = true;
    try {
        isValid = checkAddress(
            ctx.message.text,
            parseInt(botParams.settings.network.prefix)
        )[0];
    } catch (error) {
        isValid = false;
    }

    if (!isValid) {
        const message = "Incorrect address. Please try again.";
        enterAddress.replyWithMarkdown(ctx, message);
        return;
    }
    const alertCol = await getAlertCollection();
    const userAlert = await alertCol.findOne({ chatId: ctx.chat.id, address: ctx.message.text });

    if (userAlert) {
        const message = "You already have an alert set for this address!";
        await ctx.reply(message, {
            reply_markup: {
                keyboard: (await getKeyboard(ctx)).build(),
                resize_keyboard: true
            },
        });
    }
    else {
        await alertCol.insertOne({
            chatId: ctx.chat.id,
            address: ctx.message.text,
            new: userAlerts.find(
                e => e.name === "new"
            ).selected,
            voted: userAlerts.find(
                e => e.name === "voted"
            ).selected,
            done: userAlerts.find(
                e => e.name === "done"
            ).selected,
            createdAt: new Date()
        });
        const message = "Alert setup! ✅";
        await ctx.reply(message, {
            reply_markup: {
                keyboard: (await getKeyboard(ctx)).build(),
                resize_keyboard: true
            },
        });
    }
});

export const addAlertMiddleware = new MenuMiddleware('aa/', addAlert);