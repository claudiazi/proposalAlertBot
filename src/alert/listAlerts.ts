import { Context } from "grammy";
import { MenuTemplate, MenuMiddleware, createBackMainMenuButtons } from "grammy-inline-menu";
import _ from "lodash";
import { getAccountName } from "../../tools/utils.js";
import { getAlertCollection } from "../mongo/index.js";
import { showAlert } from "./showAlert.js";

let userAlerts;
let alertsPage;

export const listAlerts = new MenuTemplate(async (ctx: Context) => {
    const alertCol = await getAlertCollection();
    userAlerts = await alertCol.find({ chatId: ctx.chat.id }).toArray();
    if (!userAlerts || userAlerts.length === 0)
        return `You have not set any alerts yet.`;
    return `Click on the wallet for which you would like to view/edit alerts`;
});

listAlerts.chooseIntoSubmenu(
    "b",
    async (ctx: Context) => {
        if (!userAlerts || userAlerts.length === 0)
            return "";
        return userAlerts.map((alert) =>
            alert.address
        );
    },
    showAlert,
    {
        buttonText: async (ctx: Context, key) => {
            if (key === "")
                return;
            return await getAccountName(key, true);
        },
        maxRows: 5,
        columns: 1,
        getCurrentPage: async (ctx) => {
            return alertsPage;
        },
        setPage: async (ctx, page) => {
            alertsPage = page;
        },
        disableChoiceExistsCheck: true
    }
);

listAlerts.manualRow(createBackMainMenuButtons());

export const listAlertsMiddleware = new MenuMiddleware('la/', listAlerts);