const NodeMailer = require('nodemailer');
const Path = require('path');
const Consola = require('consola');
const Express = require('express');
const MailManager = require('./lib/MailManager');
require('dotenv').config();

if (
	!(process.env.MAIL_SERVER && process.env.MAIL_SERVER_PORT && process.env.MAIL_USERNAME && process.env.MAIL_PASSWORD && process.env.PORT)
) {
	console.error('MAIL_SERVER, MAIL_SERVER_PORT, MAIL_USERNAME, MAIL_PASSWORD or PORT not set!');

	process.exit(1);
}

let MAIL_SERVER_PORT = parseInt(process.env.MAIL_SERVER_PORT);
let API_PORT = parseInt(process.env.PORT) || 22003;

if (isNaN(MAIL_SERVER_PORT)) {
	console.error('MAIL_SERVER_PORT is not a number!');

	process.exit(1);
}

if (isNaN(API_PORT)) {
	console.error('API_PORT is not a number!');

	process.exit(1);
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

const mailManager = MailManager.getInstance(Path.join(__dirname, 'mails'), transport)

const server = Express();

server.use(Express.json());

const main = async () => {
	mailManager.load()

	server.use(require('./lib/routes'));

	await new Promise((res) => server.listen(API_PORT, () => res()));

	Consola.success(`Listening on port ${API_PORT}`);
};

main();
