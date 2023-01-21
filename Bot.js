import nmv, {UUID}  from "@caspertech/node-metaverse";
import chalk        from "chalk";
import * as Discord from "discord.js";
import {debug}      from "./index.js";
import {doPrint}    from "./Utils.js";

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

// Intentionally not exported; instantiate subclasses only
class Bot
{
	bot; // Set in subclass; polymorphic
	botType; // Set in subclass
	//connect; // Implement in subclass; no params
	dest; // Destination bots; managed in superclass but used in subclass
	//listen; // Implement in subclass; no params
	//sendMessage; // Implement in subclass; int index, string msg
	//exit; // Implement in subclass; no params

	formatMessage(sender, msg)
	{
		if(msg.match(emptyRegex))
		{
			return null;
		}

		return `<${sender}> ${msg}`;
	}

	formatSystemMessage(event, sender, msg)
	{
		return `[${event}] [${sender}] ${msg}`;
	}

	print(txt, obj = null)
	{
		doPrint(this.botType.header, this.botType.colour, txt, obj);
	}

	printDebug(txt, obj = null)
	{
		if(debug)
		{
			doPrint(this.botType.header + " - Debug", this.botType.colour, txt, obj);
		}
	}

	setDest(dest)
	{
		this.dest = dest;
	}
}

export class SLBot
	extends Bot
{
	botType = BotTypes.SL;
	firstName;
	groups;
	id;
	lastName;
	password;

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

	async connect()
	{
		const loginParameters = new nmv.LoginParameters();
		loginParameters.firstName = this.firstName;
		loginParameters.lastName = this.lastName;
		loginParameters.password = this.password;
		//loginParameters.start = "last";

		this.bot = new nmv.Bot(loginParameters, slPerms);
		this.print("Logging in");
		await this.bot.login();
		this.print("Logged in");
		await this.bot.connectToSim();
		this.print("Waiting for event queue");
		await this.bot.waitForEventQueue();
		this.print("Connected to sim");
	}

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
	}

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

	sendMessage(index, msg)
	{
		if(index < 0 || index >= this.groups.length || !msg)
		{
			this.printDebug("Invalid param -- " + index + ", '" + msg + "'");
			return;
		}

		this.printDebug("Attempting message -- " + index + ", '" + msg + "' to " + this.groups[index]);
		this.printDebug("Comms: ", this.bot.clientCommands.comms.sendGroupMessage);
		//this.printDebug("Commands: ",this.bot.clientCommands);
		//this.printDebug("Bot: ", this.bot );

		// Promise ignored; async is desired here
		this.bot.clientCommands.comms.sendGroupMessage(this.groups[index], msg);
	}
}

export class DiscordBot
	extends Bot
{
	botType = BotTypes.DISCORD;
	channelSnowflakes;
	channels;
	guild;
	guildSnowflake;
	token;

	constructor(token, guildSnowflake, channelSnowflakes)
	{
		super();

		this.token = token;
		this.guildSnowflake = guildSnowflake;
		this.channelSnowflakes = channelSnowflakes;

		this.print("Guild: " + this.guildSnowflake);
		this.print("Channels: " + this.channelSnowflakes);
	}

	async connect()
	{
		const Intents = Discord.GatewayIntentBits;

		//console.log(Discord.GatewayIntentBits);
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

		this.print("Logging in");
		await this.bot.login(this.token);

		this.guild = await this.bot.guilds.fetch(this.guildSnowflake);
		this.channels = [];

		for(const channel of this.channelSnowflakes)
		{
			this.channels.push(await this.guild.channels.fetch(channel));
		}
	}

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
	}

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

	async getDisplayName(id)
	{
		this.printDebug("Fetching display name for id " + id);
		return (await this.guild.members.fetch(id)).displayName;
	}

	// All promises here ignored because these need to be async
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

	// Channel is unused because each message has its own
	onMessageDeleteBulk(msgs, channel)
	{
		for(const msg of msgs)
		{
			this.onMessageDelete(msg);
		}
	}

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

	// User ignored because it's in the message
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
		const index = this.findIndex(msg.channelId);

		if(index < 0)
		{
			this.printDebug("Invalid index");
			return;
		}

		this.dest.sendMessage(index, this.formatMessage(sender, `:${emoji}: @ {${text}}`));
	}

	// User ignored because it's in the message
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

	onReactionRemoveAll(message, reactions)
	{
		for(const reaction of reactions)
		{
			this.onReactionRemove(reaction);
		}
	}

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

	async processMentions(msg)
	{
		let matches = msg.match(mentionRegex);

		while(matches)
		{
			this.printDebug("Found mention: ", matches[0]);

			const username = matches[1];
			const member = await this.guild.members.fetch({
				                                              query: username,
				                                              limit: 1
			                                              });

			if(member)
			{
				msg = msg.replaceAll(matches[0], `<@${member.id}>`);
			}

			matches = msg.match(mentionRegex);
		}

		return msg;
	}

	sendMessage(index, msg)
	{
		if(index < 0 || index >= this.channels.length || !msg)
		{
			this.printDebug("Invalid message on sending");
			return;
		}

		this.print(msg);
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

	validMessage(msg)
	{
		return !(msg.author.id === this.bot.user.id || discordIgnore.find((id) => id === msg.author.id));
	}
}
