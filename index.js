import chalk               from "chalk";
import * as dotenv         from "dotenv";
import {DiscordBot, SLBot} from "./Bot.js";

dotenv.config();

const splitRegex = /,\s*/ig;

const bots = [];
export const debug = process.env["DEBUG"];

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

/*
Initialises the bots with their necessary login info
@return {void}
 */
function initBots()
{
	const slBot = new SLBot(firstName, lastName, slPassword, groups);
	const discordBot = new DiscordBot(token, guildSnowflake, channelSnowflakes);
	slBot.setDest(discordBot);
	discordBot.setDest(slBot);
	bots.push(slBot);
	bots.push(discordBot);
}

/*
Connects the bots to their respective servers
@return {void}
 */
async function connectBots()
{
	for(const bot of bots)
	{
		await bot.connect();
	}
}

/*
Starts the bots listening
@return {void}
 */
async function startListening()
{
	for(const bot of bots)
	{
		await bot.listen();
	}
}

/*
Setup error handling.
@return {void}
 */
function setupErrorHandling()
{
	process.on("exit", onFatalError);
	process.on("SIGINT", onFatalError);
	process.on("SIGUSR1", onFatalError);
	process.on("SIGUSR2", onFatalError);
	process.on("uncaughtException", onFatalError);
}

/*
	Called on fatal error - print the error and disconnect.
	@param {Object|string} err - Error object/string
	@returns {Promise<void>}
 */
async function onFatalError(err)
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
}
