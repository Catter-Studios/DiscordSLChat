import chalk               from "chalk";
import * as dotenv         from "dotenv";
import {DiscordBot, SLBot} from "./Bot.js";

dotenv.config();

const splitRegex = /,\s*/ig;

const bots = [];
export const debug = process.env["DEBUG"];

const appId = process.env["APP_ID"];
const appSecret = process.env["APP_SECRET"];
const token = process.env["BOT_TOKEN"];
const guildSnowflake = process.env["DISCORD_SERVER"];
const channelSnowflakes = process.env["DISCORD_CHANNELS"].split(splitRegex);

const groups = process.env["SL_GROUPS"].split(splitRegex);
const firstName = process.env["SL_FIRST_NAME"];
const lastName = process.env["SL_LAST_NAME"];
const slPassword = process.env["SL_PASSWORD"];

setupErrorHandling();
initBots();
await connectBots();
await startListening();

function initBots()
{
	const slBot = new SLBot(firstName, lastName, slPassword, groups);
	const discordBot = new DiscordBot(token, guildSnowflake, channelSnowflakes);
	slBot.setDest(discordBot);
	discordBot.setDest(slBot);
	bots.push(slBot);
	bots.push(discordBot);
}

async function connectBots()
{
	for(const bot of bots)
	{
		await bot.connect();
	}
}

async function startListening()
{
	for(const bot of bots)
	{
		await bot.listen();
	}
}

function setupErrorHandling()
{
	process.on("exit", onError);
	process.on("SIGINT", onError);
	process.on("SIGUSR1", onError);
	process.on("SIGUSR2", onError);
	process.on("uncaughtException", onError);
}

async function onError(err)
{
	if(err)
	{
		console.log(chalk.red("Fatal error") + ": ", err);
	}

	for(const bot of bots)
	{
		await bot.exit();
	}

	process.exit(1);
	return;
}
