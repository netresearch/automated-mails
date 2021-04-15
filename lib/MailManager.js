const Consola = require('consola');
const Transport = require('nodemailer/lib/mailer');
const NodeCron = require('node-cron');
const Path = require('path');
const FS = require('fs');

/**
 * @typedef {object} Mail
 * @property {string} name
 * @property {string} subject
 * @property {string} time
 * @property {string[]} recipients
 * @property {{[variable: string]: any}} variables
 * @property {string} text
 * @property {string} html
 */

class MailManager {
	/**
	 * @type {MailManager | null}
	 * @private
	 */
	static instance = null;

	/**
	 * @param {string} path Path to the mail templates
	 * @param {Transport} transport
	 * @private
	 */
	constructor(path, transport) {
		this.transport = transport;
		this.path = path;

		this.loaded = false;

		/** @type {Map<string, Mail>} */
		this.loadedMails = new Map();

		this.sentMails = 0;
	}

	load() {
		Consola.info('Scanning configured mails...');

		const mailFilenames = FS.readdirSync(this.path).filter((f) => f.endsWith('.json'));

		Consola.success(`Found ${mailFilenames.length} mails!`);

		for (const filename of mailFilenames) {
			Consola.debug(`Loading ${filename}...`);

			const splitFilename = filename.split('.');
			splitFilename.pop();

			const cleanFilename = splitFilename.join('.');

			/** @type {Mail} */
			let mail;

			try {
				mail = require(Path.join(this.path, filename));

				if (typeof mail.name !== 'string' || !mail.name.length) {
					throw new Error('Name too short or not a string');
				} else if (typeof mail.subject !== 'string' || !mail.subject.length) {
					throw new Error('Subject too short or not a string');
				} else if (typeof mail.time !== 'string' || mail.time.length < 11) {
					throw new Error('Time schedule too short or not a string');
				}
			} catch (error) {
				Consola.error(`Mail configuration "${cleanFilename}" is incorrect.`, error);

				return;
			}

			if (!mail.recipients) {
				mail.recipients = [];
			}

			if (!mail.variables) {
				mail.variables = {};
			}

			if (!mail.html) {
				mail.html = FS.readFileSync(Path.join(this.path, `${cleanFilename}.html`), 'utf-8');
			}

			if (!mail.text) {
				mail.text = FS.readFileSync(Path.join(this.path, `${cleanFilename}.txt`), 'utf-8');
			}

			const { recipients, variables } = mail;

			NodeCron.schedule(mail.time, () => this.sendMail(mail));

			this.loadedMails.set(mail.name, mail);

			Consola.success(
				`Loaded ${mail.name} (${recipients.length} recipients, ${Object.keys(variables).length} variables)!`
			);
		}

		this.loaded = true;
	}

	/**
	 * @param {string} name
	 */
	sendTestMail(name) {
		Consola.info(`Sending ${name}...`);

		if (!this.loaded) {
			throw new Error('MailManager not loaded');
		}

		const mail = this.loadedMails.get(name);

		if (!mail) {
			throw new Error('Mail not found');
		}

		return this.sendMail(mail);
	}

	/**
	 * @param {Mail} mail
	 * @private
	 */
	async sendMail({ subject, recipients, variables, html, text }) {
		Consola.info(`Sending ${subject} to ${recipients.length} mail addresses...`);

		try {
			variables.DATE = new Date().toLocaleDateString();
			variables.TIME = new Date().toLocaleTimeString();

			for (const variable in variables) {
				html = html.replace(`{${variable}}`, variables[variable]);
				text = html.replace(`{${variable}}`, variables[variable]);
			}

			delete variables.DATE;
			delete variables.TIME;

			await this.transport.sendMail({
				to: process.env.MAIL_USERNAME,
				bcc: recipients,
				html,
				text,
				subject
			});

			Consola.success(`Sent ${subject} to ${recipients.length} mail addresses!`);

			this.sentMails++;
		} catch (error) {
			Consola.error(error);
		}
	}

	/**
	 * @param {Mail[]} mails
	 */
	import(mails) {
		for (const mail of mails) {
			Consola.debug(`Loading ${mail.name}...`);

			// TODO Do some checking of the mail object

			this.loadedMails.delete(mail.name);
			this.loadedMails.set(mail.name, mail);

			Consola.success(
				`Loaded ${mail.name} (${mail.recipients.length} recipients, ${
					Object.keys(mail.variables).length
				} variables)!`
			);
		}
	}

	/**
	 * @param {string} name
	 * @param {Mail} mail
	 */
	importMail(name, mail) {
		Consola.debug(`Loading ${name}...`);

		// TODO Do some checking of the mail object

		this.loadedMails.delete(name);
		this.loadedMails.set(name, mail);

		Consola.success(
			`Loaded ${name} (${mail.recipients.length} recipients, ${
				Object.keys(mail.variables).length
			} variables)!`
		);
	}

	export() {
		const mails = [];

		for (const mail of this.loadedMails.values()) {
			mails.push(mail);
		}

		return mails;
	}

	/**
	 * @param {string} path Path to the mail templates
	 * @param {Transport} transport Mail transport
	 */
	static getInstance(path, transport) {
		if (!this.instance) {
			this.instance = new MailManager(path, transport);
		}

		return this.instance;
	}
}

module.exports = MailManager;
