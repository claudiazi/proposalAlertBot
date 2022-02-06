import { MenuTemplate, createBackMainMenuButtons, deleteMenuFromContext } from "grammy-inline-menu";
import { Context, InlineKeyboard, InputFile } from "grammy";
import { getAlertCollection } from "../mongo/index.js";
import { listAlertsMiddleware } from "./listAlerts.js";
import { escapeMarkdown, getAccountName, send } from "../../tools/utils.js";

let alert;

export const showAlert = new MenuTemplate(async (ctx: Context) => {
    const alertCol = await getAlertCollection();
    alert = await alertCol.findOne({ address: ctx.match[1] });
    let info = `Alert for *${escapeMarkdown(await getAccountName(alert.address))}*\n\n` +
        `You will be informed of the following events regarding this address:\n\n` +
        `New proposal motion: ${alert.new ? "✅" : "❌"}\n\n` +
        `Motion voted: ${alert.voted ? "✅" : "❌"}\n\n` +
        `Motion done: ${alert.done ? "✅" : "❌"}\n\n`;
    return { text: info, parse_mode: "MarkdownV2" };
});

showAlert.select(
    "s",
    ["new", "voted", "done"],
    {
        showFalseEmoji: true,
        isSet: (ctx, key) => alert[key],
        set: async (ctx, key, newState) => {
            const alertCol = await getAlertCollection();
            alert[key] = newState;
            await alertCol.updateOne({ address: alert.address }, { $set: alert });
            return true;
        },
        columns: 1
    }
);

showAlert.interact("Delete Alert", "da", {
    do: async (ctx: Context) => {
        await deleteMenuFromContext(ctx);
        const alertCol = await getAlertCollection();
        await alertCol.deleteOne({ address: alert.address });
        const message = `Alert for ${alert.address} deleted.`;
        await send(ctx.chat.id, message, "Markdown");
        listAlertsMiddleware.replyToContext(ctx, `la/`);
        return false;
    },
    joinLastRow: false
});

showAlert.manualRow(createBackMainMenuButtons());