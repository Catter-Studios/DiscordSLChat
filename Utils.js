/*
 Log file name
 @type {string}
 */
import * as fs from "fs";
import {doLog} from "./index.js";

const logFile = "log.txt";

/*
 Prints a message
 @param {string} header - The header of the message (typically the bot name)
 @param {function} headerColour - A chalk function of the colour to use for the header
 @param {string} txt - The text of the message to send
 @param {Object} [obj] - An optional object to print along with the message
 @returns {void}
 */
export function doPrint(header, headerColour, txt, obj)
{
	let output = "[";

	if(headerColour)
	{
		output += headerColour(header);
	}
	else
	{
		output += header;
	}

	output += "] ";
	output += txt;

	if(obj)
	{
		console.log(output, obj);
	}
	else
	{
		console.log(output);
	}
}

/*
 Logs text to file
 @param {string} txt - The text to log
 @returns {void}
 */
export function log(txt)
{
	if( !doLog )
	{
		return;
	}

	const timestamp = getTimestamp();
	fs.appendFileSync(logFile, `[${timestamp}] ${txt}\n`);
}

/*
Get a formatted timestamp
@returns {string}
 */
function getTimestamp()
{
	return new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
}
