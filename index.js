import chalk               from "chalk";
import * as dotenv         from "dotenv";
import {DiscordBot, SLBot} from "./Bot.js";
import {log}               from "./Utils.js";

// TODO: Add user masquerading
dotenv.config();

const splitRegex = /,\s*/ig;

const bots = [];
export const debug = process.env["DEBUG"];
export const doLog = process.env["LOG_CHAT"];

const token = process.env["BOT_TOKEN"];
const guildSnowflake = process.env["DISCORD_SERVER"];
const channelSnowflakes = process.env["DISCORD_CHANNELS"].split(splitRegex);

const groups = process.env["SL_GROUPS"].split(splitRegex);
const firstName = process.env["SL_FIRST_NAME"];
const lastName = process.env["SL_LAST_NAME"];
const slPassword = process.env["SL_PASSWORD"];
const retry = 60;

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
	process.on("exit", fatalError);
	process.on("SIGINT", checkConnections);
	process.on("SIGUSR1", checkConnections);
	process.on("SIGUSR2", checkConnections);
	process.on("uncaughtException", checkConnections);
}

/*
Checks the connections of all the bots and reconnects if need be
@description This promise can be safely ignored due to async functionality
@returns {Promise<void>}
 */
async function checkConnections()
{
	log("Something went wrong, checking connections in " + retry + " seconds");

	setTimeout(function(){
		for( const bot of bots )
		{
			if( bot.connected )
			{
				continue;
			}

			bot.connect();
			bot.listen();
		}
	},retry*1000);
}

/*
	Called on fatal error - print the error and disconnect.
	@param {Object|string} err - Error object/string
	@returns {Promise<void>}
 */
async function fatalError(err)
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
