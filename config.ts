import { Low, JSONFile } from 'lowdb';
import { Keyboard } from "grammy";
import { ApiPromise } from "@polkadot/api";
import { Bot } from "grammy";
import { RunnerHandle } from '@grammyjs/runner';
import { getUserCollection, initDb } from './src/mongo/index.js';
import { BlockCountAdapter } from './tools/blockCountAdapter.js';
import { BlockListener } from './src/network/blockListener.js';

type BotParams = {
  api: ApiPromise,
  localStorage: Low,
  settings: any,
  bot: Bot,
  runnerHandle: RunnerHandle;
  blockCountAdapter: BlockCountAdapter;
  blockListener: BlockListener
};

export const botParams: BotParams = {
  api: null,
  localStorage: null,
  settings: null,
  bot: null,
  runnerHandle: null,
  blockCountAdapter: null,
  blockListener: null
};

export const getKeyboard = async (ctx): Promise<Keyboard> => {
  return new Keyboard()
    .text("➕ Add alert").row()
    .text("📒 My addresses/alerts").row();
};

export const getDb = async (): Promise<void> => {
  await initDb();
};

export const getLocalStorage = (): Low => {
  const db = new Low(new JSONFile(process.env.LOCAL_STORAGE_DB_FILE_PATH));
  return db;
};

