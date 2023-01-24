import nmv, {UUID}  from "@caspertech/node-metaverse";
import chalk        from "chalk";
import * as Discord from "discord.js";
import {debug}        from "./index.js";
import {doPrint, log} from "./Utils.js";

const slPerms = nmv.BotOptionFlags.LiteObjectStore | nmv.BotOptionFlags.StoreMyAttachmentsOnly;
const mentionRegex = /@(\S+)/ig;
const emptyRegex = /^\s*$/ig;
const discordIgnore = ["888420645283692576"];
const slIgnore = ["71a34da3-268c-4d04-8dc9-63a69cb91bb1", "6279bf98-c639-448a-96bb-00f0a7c42801"];
export const BotTypes = {
	SL     : {
		header: "SL",
		colour: chalk.blue
	},
	DISCORD: {
		header: "Discord",
		colour: chalk.yellow
	}
};

/*
Class representing a general bot
@description This is intentionally not exported.  You should only ever instantiate subclasses.
 */
class Bot
{
	/*
	The bot object itself
	@type {Object}
	@description This should only be set in subclasses
	 */
	bot;

	/*
	The bot object's type
	@type {BotTypes}
	@description This should only be set in subclasses
	 */
	botType;

	/*
	The destination bot
	@type {Bot}
	@description This is managed in the superclass (Bot) but is also used in subclasses
	 */
	dest;

	/*
	Whether or not the bot is connected
	@type {boolean}
	@description This should be managed by subclasses
	 */
	connected;

	/*
	Formats a message
	@param {string} sender - The name of the sender
	@param {string} msg - The message sent
	 */
	formatMessage(sender, msg)
	{
		if(msg.match(emptyRegex))
		{
			return null;
		}

		return `<${sender}> ${msg}`;
	}

	/*
	Formats a system message
	@param {string} event - The event giving rise to this message
	@param {string} sender - The name of the sender
	@param {string} msg - The message sent
	 */
	formatSystemMessage(event, sender, msg)
	{
		return `[${event}] [${sender}] ${msg}`;
	}

	/*
	Prints a message
	@param {string} txt - The text to pront
	@param {Object} [obj] - An optional object to print
	 */
	print(txt, obj = null)
	{
		doPrint(this.botType.header, this.botType.colour, txt, obj);
	}

	/*
	Prints a debug message
	@param {string} txt - The text to pront
	@param {Object} [obj] - An optional object to print
	 */
	printDebug(txt, obj = null)
	{
		if(debug)
		{
			doPrint(this.botType.header + " - Debug", this.botType.colour, txt, obj);
		}
	}

	/*
	Sets the destination bot for messages originating from this bot
	@param {Bot} dest - The bot to send messages to
	 */
	setDest(dest)
	{
		this.dest = dest;
	}
}

/*
Class representing a Second Life bot
@extends Bot
 */
export class SLBot
	extends Bot
{
	/*
	The bot type
	@type {BotTypes}
	 */
	botType = BotTypes.SL;

	/*
	The Second Life First Name
	@type {string}
	 */
	firstName;

	/*
	The groups this bot should manage
	@type {string[]}
	 */
	groups;

	/*
	This bot's UUID
	@type {string}
	 */
	id;

	/*
	The Second Life Last Name
	@type {string}
	 */
	lastName;

	/*
	The Second Life Password
	@type {string}
	 */
	password;

	/*
	Construct an SLBot instance
	@constructor
	@param {string} firstName - The Second Life First Name
	@param {string} lastName - The Second Life Last Name
	@param {string} password - The Second Life Password
	@param {string[]} groups - The UUIDs for the groups this bot will manage
	 */
	constructor(firstName, lastName, password, groups)
	{
		super();
		this.firstName = firstName;

		if(lastName && !lastName.match(/^\s*$/i))
		{
			this.lastName = lastName;
		}
		else
		{
			this.lastName = "Resident";
		}

		this.password = password;
		this.groups = groups;

		this.print("First name: " + this.firstName);
		this.print("Last name: " + this.lastName);
		this.print("Groups: ", this.groups);
	}

	/*
	Connects the bot to Second Life
	@returns {Promise<void>}
	 */
	async connect()
	{
		const loginParameters = new nmv.LoginParameters();
		loginParameters.firstName = this.firstName;
		loginParameters.lastName = this.lastName;
		loginParameters.password = this.password;

		if( !this.bot )
		{
			this.bot = new nmv.Bot(loginParameters, slPerms);
		}

		this.print("Logging in");
		await this.bot.login();
		this.print("Logged in");
		await this.bot.connectToSim();
		this.print("Waiting for event queue");
		await this.bot.waitForEventQueue();
		this.print("Connected to sim");
		this.connected = true;
	}

	/*
	Disconnects the bot
	@returns {Promise<void>}
	 */
	async exit()
	{
		this.print("Disconnecting from " + this.botType.header);

		try
		{
			await this.bot.close();
		}
		catch(error)
		{
			this.print(`<${chalk.red("Error")}> Problem exiting ${this.botType.header} - `, error);
		}

		this.connected = false;
	}

	/*
	Finds the index of a given group UUID
	@param {string} groupId - The group UUID
	@returns {integer} - The index
	 */
	findIndex(groupId)
	{
		for(let x = 0; x < this.groups.length; x++)
		{
			if(this.groups[x] === groupId)
			{
				return x;
			}
		}

		return -1;
	}

	/*
	Starts this bot listening for messages on Second Life
	@returns {Promise<void>}
	 */
	async listen()
	{
		this.id = UUID.getString(this.bot.agentID());
		this.bot.clientEvents.onGroupChat.subscribe(this.onGroupChat.bind(this));

		this.bot.clientEvents.onGroupChatSessionJoin.subscribe((event) =>
		                                                       {
			                                                       if(event.success)
			                                                       {
				                                                       console.log(
					                                                       "We have joined a chat session! Group ID: " +
					                                                       event.sessionID);
			                                                       }
			                                                       else
			                                                       {
				                                                       console.log(
					                                                       "We have FAILED to join a chat session! Group ID: " +
					                                                       event.sessionID);
			                                                       }
		                                                       });

		for(const group of this.groups)
		{
			this.printDebug("Attempting to start group chat session for " + group);
			await this.bot.clientCommands.comms.startGroupChatSession(group, "");
		}

		this.print("Listening");
	}

	/*
	Group chat event callback
	@description This promise can be safely ignored due to async functionality
	@param {object} event - The event
	@returns {void}
	 */
	onGroupChat(event)
	{
		this.printDebug("Message sent: ", event);

		const sender = event.fromName;
		const senderId = UUID.getString(event.from);

		this.printDebug("Message author id: " + UUID.getString(event.from));
		this.printDebug("My id: " + UUID.getString(this.bot.agentID()));

		if(senderId === this.id || slIgnore.find((ele) => ele === senderId))
		{
			this.printDebug("This was me or an ignore; ignoring");
			return;
		}

		const text = event.message;
		const groupId = UUID.getString(event.groupID);
		const index = this.findIndex(groupId);

		if(index < 0)
		{
			this.printDebug("Invalid index: " + index);
			return;
		}

		this.printDebug("Sending to Discord");
		this.dest.sendMessage(index, this.formatMessage(sender, text));
	}

	/*
	Sends a message to Second Life
	@param {integer} index - The index of the group to send to
	@param {string} msg - The message to send
	@returns {void}
	 */
	sendMessage(index, msg)
	{
		if(index < 0 || index >= this.groups.length || !msg)
		{
			this.printDebug("Invalid param -- " + index + ", '" + msg + "'");
			return;
		}

		log(msg);
		this.printDebug("Attempting message -- " + index + ", '" + msg + "' to " + this.groups[index]);
		this.printDebug("Comms: ", this.bot.clientCommands.comms.sendGroupMessage);
		//this.printDebug("Commands: ",this.bot.clientCommands);
		//this.printDebug("Bot: ", this.bot );

		// Promise ignored; async is desired here
		this.bot.clientCommands.comms.sendGroupMessage(this.groups[index], msg);
	}
}

/*
Class representing a Discord bot
@extends Bot
 */
export class DiscordBot
	extends Bot
{
	/*
	The bot's type
	@type {BotTypes}
	 */
	botType = BotTypes.DISCORD;

	/*
	The list of channel snowflake IDs this bot will manage
	@type {string[]}
	 */
	channelSnowflakes;

	/*
	The list of channels this bot is managing
	@type {Channel[]}
	 */
	channels;

	/*
	The guild this bot is managing
	@type {Guild}
	 */
	guild;

	/*
	The guild snowflake id of the guild this bot will manage
	@type {string}
	 */
	guildSnowflake;

	/*
	The secret token to connect to Discord
	@type {string}
	 */
	token;

	/*
	Constructs a Discord bot
	@constructor
	@param {string} token - The secret token
	@param {string} guildSnowflake - The snowflake id of the guild to manage
	@param {string[]} channelSnowflakes - The snowflake ids of the channels to manage
	 */
	constructor(token, guildSnowflake, channelSnowflakes)
	{
		super();

		this.token = token;
		this.guildSnowflake = guildSnowflake;
		this.channelSnowflakes = channelSnowflakes;

		this.print("Guild: " + this.guildSnowflake);
		this.print("Channels: " + this.channelSnowflakes);
	}

	/*
	Connect this bot to Discord
	@returns {Promise<void>}
	 */
	async connect()
	{
		const Intents = Discord.GatewayIntentBits;

		if( !this.bot )
		{
			this.bot = new Discord.Client({
				                              intents: [Intents.Guilds, Intents.GuildMembers, Intents.GuildBans,
				                                        Intents.GuildEmojisAndStickers, Intents.GuildIntegrations,
				                                        Intents.GuildWebhooks, Intents.GuildInvites,
				                                        Intents.GuildVoiceStates, Intents.GuildPresences,
				                                        Intents.GuildMessages, Intents.GuildMessageReactions,
				                                        Intents.GuildMessageTyping, Intents.DirectMessages,
				                                        Intents.DirectMessageReactions, Intents.DirectMessageTyping,
				                                        Intents.MessageContent]
			                              });
		}

		this.print("Logging in");
		await this.bot.login(this.token);

		if( !this.guild )
		{
			this.guild = await this.bot.guilds.fetch(this.guildSnowflake);
		}

		if( !this.channels )
		{
			this.channels = [];

			for(const channel of this.channelSnowflakes)
			{
				this.channels.push(await this.guild.channels.fetch(channel));
			}
		}

		this.connected = true;
	}

	/*
	Disconnects this bot from Discord
	@returns {Promise<void>}
	 */
	async exit()
	{
		this.print("Disconnecting from " + this.botType.header);

		try
		{
			await this.bot.destroy();
		}
		catch(error)
		{
			this.print(`<${chalk.red("Error")}> Problem exiting ${this.botType.header} - `, error);
		}

		this.connected = false;
	}

	/*
	Finds the index of the given snowflake id
	@param {string} channelSnowflake - The snowflake to find the index of
	@returns {integer} - The index of the given channel
	 */
	findIndex(channelSnowflake)
	{
		for(let x = 0; x < this.channelSnowflakes.length; x++)
		{
			if(this.channelSnowflakes[x] === channelSnowflake)
			{
				return x;
			}
		}

		return -1;
	}

	/*
	Gets the display name of a given user
	@param {string} id - The user's snowflake id
	@returns {Promise<string>}
	 */
	async getDisplayName(id)
	{
		this.printDebug("Fetching display name for id " + id);
		return (await this.guild.members.fetch(id)).displayName;
	}

	/*
	Starts this bot listening
	@description All promises returned here are ignored because this code needs to be asynchronous
	@returns {void}
	 */
	listen()
	{
		this.bot.on("messageCreate", this.onMessageCreate.bind(this)); // msg
		this.bot.on("messageDelete", this.onMessageDelete.bind(this)); // msg
		this.bot.on("messageDeleteBulk", this.onMessageDeleteBulk.bind(this)); // msg[], channel
		this.bot.on("messageUpdate", this.onMessageUpdate.bind(this)); // old, new
		this.bot.on("messageReactionAdd", this.onReactionAdd.bind(this)); // reaction, user
		this.bot.on("messageReactionRemove", this.onReactionRemove.bind(this)); // reaction, user
		this.bot.on("messageReactionRemoveAll", this.onReactionRemoveAll.bind(this)); // msg, reaction[]
		this.bot.on("messageReactionRemoveEmoji", this.onRemoveEmoji.bind(this)); // reaction
		this.print("Listening");
	}

	/*
	Called when a message is created/sent
	@description This promise can be safely ignored due to async functionality
	@param {Message} msg - The message sent
	@returns {Promise<void>}
	 */
	async onMessageCreate(msg)
	{
		this.printDebug("Message sent: ", msg);
		this.printDebug("Message author id: " + msg.author.id);
		this.printDebug("My id: " + this.bot.user.id);

		if(!this.validMessage(msg))
		{
			this.printDebug("Invalid message; ignored");
			return;
		}

		const text = msg.content;
		const sender = await this.getDisplayName(msg.author.id);
		const index = this.findIndex(msg.channelId);

		if(index < 0)
		{
			this.printDebug("Invalid index");
			return;
		}

		this.printDebug("Sending to SL");
		this.dest.sendMessage(index, this.formatMessage(sender, text));
	}

	/*
	 Called when a message is deleted
	 @description This promise can be safely ignored due to async functionality
	 @param {Message} msg - The message deleted
	 @returns {Promise<void>}
	 */
	async onMessageDelete(msg)
	{
		this.printDebug("Message deleted: ", msg);

		if(!this.validMessage(msg))
		{
			return;
		}

		const text = msg.content;
		const sender = await this.getDisplayName(msg.author.id);
		const index = this.findIndex(msg.channelId);

		if(index < 0)
		{
			this.printDebug("Invalid index");
			return;
		}

		this.dest.sendMessage(index, this.formatSystemMessage("Deleted", sender, text));
	}

	/*
	 Called when multiple messages are deleted
	 @description Channel goes unused here because each msg has its own channel
	 @param {Message[]} msgs - The messages
	 @param [Channel] channel - The channel the messages were deleted from
	 @returns {void}
	 */
	onMessageDeleteBulk(msgs, channel)
	{
		for(const msg of msgs)
		{
			this.onMessageDelete(msg);
		}
	}

	/*
	 Called when a message is updated
	 @description This promise can be safely ignored due to async functionality
	 @param {Message} oldMessage - The old message
	 @param {Message} newMessage - The new message
	 @returns {Promise<void>}
	 */
	async onMessageUpdate(oldMessage, newMessage)
	{
		this.printDebug("Message updated from: ", oldMessage);
		this.printDebug("Message updated to: ", newMessage);

		if(!this.validMessage(oldMessage) || !this.validMessage(newMessage))
		{
			this.printDebug("Invalid message; ignoring");
			return;
		}

		const oldText = oldMessage.content;
		const newText = newMessage.content;
		const sender = await this.getDisplayName(oldMessage.author.id);
		const index = this.findIndex(oldMessage.channelId);

		if(index < 0)
		{
			this.printDebug("Invalid index");
			return;
		}

		this.printDebug("Sending to SL");
		this.dest.sendMessage(index, this.formatSystemMessage("Changed", sender, `{${oldText}} -> {${newText}}`));
	}

	/*
	 Called when a reaction is added
	 @description The user is ignored because it's present in the message
	 @description This promise can be safely ignored due to async functionality
	 @param {Reaction} reaction - The reaction added
	 @param {User} [user] - The user who added the reaction
	 @returns {Promise<void>}
	 */
	async onReactionAdd(reaction, user)
	{
		this.printDebug("Reaction added: ", reaction);

		if(!this.validMessage(reaction.message))
		{
			return;
		}

		const msg = reaction.message;
		const text = msg.content;
		const sender = await this.getDisplayName(msg.author.id);
		const emoji = reaction.emoji.name;
		this.printDebug("Emoji: ", reaction.emoji);
		const index = this.findIndex(msg.channelId);

		if(index < 0)
		{
			this.printDebug("Invalid index");
			return;
		}

		this.dest.sendMessage(index, this.formatMessage(sender, `:${emoji}: @ {${text}}`));
	}

	/*
	 Called when a reaction is removed
	 @description The user is ignored because it's present in the message
	 @description This promise can be safely ignored due to async functionality
	 @param {Reaction} reaction - The reaction removed
	 @param {User} [user] - The user who added the reaction
	 @returns {Promise<void>}
	 */
	async onReactionRemove(reaction, user)
	{
		this.printDebug("Reaction removed: ", reaction);

		if(!this.validMessage(reaction.message))
		{
			return;
		}

		const msg = reaction.message;
		const text = msg.content;
		const sender = await this.getDisplayName(msg.author.id);
		const emoji = reaction.emoji.name;
		const index = this.findIndex(msg.channelId);

		if(index < 0)
		{
			this.printDebug("Invalid index");
			return;
		}

		this.dest.sendMessage(index, this.formatMessage(sender, `Removed :${emoji}: @ {${text}}`));
	}

	/*
	 Called when all reactions are removed
	 @param {Message} message - The message from which the reactions were deleted
	 @param {Reaction[]} reactions - The reactions deleted
	 @returns {void}
	 */
	onReactionRemoveAll(message, reactions)
	{
		for(const reaction of reactions)
		{
			this.onReactionRemove(reaction);
		}
	}

	/*
	 Called when a bot removes an emoji
	 @description This promise can be safely ignored due to async functionality
	 @param {Reaction} reaction - The emoji removed
	 @returns {Promise<void>}
	 */
	async onRemoveEmoji(reaction)
	{
		this.printDebug("Emoji removed: ", reaction);

		if(!this.validMessage(reaction.message))
		{
			return;
		}

		const msg = reaction.message;
		const text = msg.content;
		const sender = await this.getDisplayName(msg.author.id);
		const emoji = reaction.emoji.name;
		const index = this.findIndex(msg.channelId);

		if(index < 0)
		{
			this.printDebug("Invalid index");
			return;
		}

		this.dest.sendMessage(index, this.formatMessage(sender, `Removed :${emoji}: @ {${text}}`));
	}

	/*
	Convert mentions of usernames to actual Discord mentions
	@param {string} msg - The message to process
	@returns {Promise<string>}
	 */
	async processMentions(msg)
	{
		let matches = msg.matchAll(mentionRegex);

		for( const match of matches )
		{
			this.printDebug("Found mention: "+  match[0] + " (" + match[1] + ")" );

			const memberId = (await this.guild.members.fetch({
				                                              query: match[1],
				                                              limit: 1
			                                              })).keys().next().value;

			if(memberId)
			{
				this.printDebug(match[0] + " -> " + `<@${memberId}> :`, memberId);
				msg = msg.replaceAll(match[0], `<@${memberId}>`);
			}
		}

		return msg;
	}

	/*
	Sends a message to Discord
	@param {integer} index - The index of the channel to send the message to
	@param {string} msg - The message to send
	@returns {void}
	 */
	sendMessage(index, msg)
	{
		if(index < 0 || index >= this.channels.length || !msg)
		{
			this.printDebug("Invalid message on sending");
			return;
		}

		this.print(msg);
		log(msg);

		// Mentions need to be processed before the message is sent
		// But the message does not need to be sent before this method is called again
		// Thus, process the promise from processMentions but ignore the one from send
		this.processMentions(msg).then((function(msg2)
		{
			this.printDebug("Index: " + index);
			this.printDebug("Channel: ", this.channels[index]);

			// Promise ignored; async is desired here
			this.channels[index].send(msg2);
		}).bind(this));
	}

	/*
	Decides whether a given message is valid or not
	@param {Message} msg - The message
	@returns {boolean}
	 */
	validMessage(msg)
	{
		if( msg.author.id === this.bot.user.id )
		{
			this.printDebug("Invalid message - from me");
			return false;
		}

		if( discordIgnore.find((id) => id === msg.author.id) )
		{
			this.printDebug( "Invalid message - ignored id");
			return false;
		}

		return true;
	}
}
