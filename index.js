const NodeMailer = require('nodemailer');
const FS = require('fs');
const NodeCron = require('node-cron');
const Path = require('path');
const Consola = require('consola');
require('dotenv').config();

let MAIL_SERVER_PORT = parseInt(process.env.MAIL_SERVER_PORT);

if (isNaN(MAIL_SERVER_PORT)) {
	console.error('MAIL_SERVER_PORT is not a number!');

	return;
}

const transport = NodeMailer.createTransport({
	host: process.env.MAIL_SERVER,
	port: MAIL_SERVER_PORT,
	secure: true,
	auth: {
		user: process.env.MAIL_USERNAME,
		pass: process.env.MAIL_PASSWORD
	}
});

/**
 * @param {string} filename
 * @param {string} subject
 * @param {string[]} recipients
 * @param {any} variables
 */
const sendMail = async (filename, subject, recipients, variables) => {
	Consola.info(`Sending ${subject} to ${recipients.length} mail addresses...`);

	let html = FS.readFileSync(Path.join(__dirname, 'mails', `${filename}.html`))
		.toString()
		.replace('{DATE}', new Date().toLocaleDateString())
		.replace('{TIME}', new Date().toLocaleTimeString());

	let text = FS.readFileSync(Path.join(__dirname, 'mails', `${filename}.txt`))
		.toString()
		.replace('{DATE}', new Date().toLocaleDateString())
		.replace('{TIME}', new Date().toLocaleTimeString());

	for (const variable in variables) {
		html = html.replace(`{${variable}}`, variables[variable]);
		text = html.replace(`{${variable}}`, variables[variable]);
	}

	await transport.sendMail({
		to: process.env.MAIL_USERNAME,
		bcc: recipients,
		html,
		text,
		subject
	});

	Consola.success(`Sent ${subject} to ${recipients.length} mail addresses!`);
};

const main = async () => {
	Consola.info('Scanning configured mails...');

	const mailFilenames = FS.readdirSync(Path.join(__dirname, 'mails')).filter((f) => f.endsWith('.json'));

	Consola.success(`Found ${mailFilenames.length} mails!`);

	for (const filename of mailFilenames) {
		Consola.debug(`Loading ${filename}...`);

		const splitFilename = filename.split('.');
		splitFilename.pop();

		const cleanFilename = splitFilename.join('.');

		const mail = require(Path.join(__dirname, 'mails', filename));

		if (!mail.recipients) {
			mail.recipients = [];
		}

		if (!mail.variables) {
			mail.variables = {};
		}

		const { recipients, variables } = mail;

		NodeCron.schedule(mail.time, () => sendMail(cleanFilename, mail.subject, recipients, variables));

		Consola.success(
			`Loaded ${mail.name} (${recipients.length} recipients, ${Object.keys(variables).length} variables)!`
		);
	}
};

main();
