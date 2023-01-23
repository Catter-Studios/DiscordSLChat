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
