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
