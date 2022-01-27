// @ts-check

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
 * @property {string?} from
 * @property {string} to
 * @property {string[]?} cc
 * @property {string[]?} bcc
 * @property {string[]?} recipients DEPRECATED: Use `bcc` instead
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

		/** @type {Map<string, NodeCron.ScheduledTask>} */
		this.scheduledMails = new Map();

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

			try {
				/** @type {Mail} */
				const mail = JSON.parse(FS.readFileSync(Path.join(this.path, filename), 'utf-8'));

				if (!mail.html) {
					mail.html = FS.readFileSync(Path.join(this.path, `${cleanFilename}.html`), 'utf-8');
				}

				if (!mail.text) {
					mail.text = FS.readFileSync(Path.join(this.path, `${cleanFilename}.txt`), 'utf-8');
				}

				this.loadMail(mail);

				Consola.success(`Loaded ${mail.name} (${Object.keys(mail.variables).length} variables)!`);
			} catch (error) {
				Consola.error(`Mail configuration "${cleanFilename}" is incorrect.`, error);

				return;
			}
		}

		this.loaded = true;
	}

	/**
	 * @param {Mail} mail
	 */
	loadMail(mail) {
		if (typeof mail.name !== 'string' || !mail.name.length) {
			throw new Error('Name too short or not a string');
		} else if (typeof mail.subject !== 'string' || !mail.subject.length) {
			throw new Error('Subject too short or not a string');
		} else if (typeof mail.time !== 'string' || mail.time.length < 11) {
			throw new Error('Time schedule too short or not a string');
		} else if (typeof mail.to !== 'string') {
			throw new Error('`to` is not set');
		}

		if (!mail.from) {
			mail.from = process.env.MAIL_USERNAME;
		}

		if (!mail.cc) {
			mail.cc = [];
		}

		if (!mail.bcc) {
			mail.bcc = [];
		}

		if (mail.recipients) {
			Consola.warn('"recipients" is deprecated. Use "bcc" instead.');
			mail.bcc.push(...mail.recipients);
		}

		if (!mail.variables) {
			mail.variables = {};
		}

		const scheduledMail = this.scheduledMails.get(mail.name);

		if (scheduledMail) {
			scheduledMail.stop();
		}

		this.scheduledMails.set(
			mail.name,
			NodeCron.schedule(mail.time, () => this.sendMail(mail.name))
		);

		this.loadedMails.set(mail.name, mail);
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

		return this.sendMail(name);
	}

	/**
	 * @param {string} mailName
	 * @private
	 */
	async sendMail(mailName) {
		const mail = this.loadedMails.get(mailName);

		if (!mail) {
			return;
		}

		const { from, to, cc, bcc, subject, variables } = mail;
		let { html, text } = mail;

		Consola.info(`Sending ${subject} to ${to} (${cc.length} addresses in CC, ${bcc.length} addresses in BCC)...`);

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
				from,
				to,
				cc,
				bcc,
				html,
				text,
				subject
			});

			Consola.success(`Sent ${subject} to ${to} (${cc.length} addresses in CC, ${bcc.length} addresses in BCC)...`);

			this.sentMails++;
		} catch (error) {
			Consola.error(error);
		}
	}

	/**
	 * @param {Mail[]} mails
	 */
	import(mails) {
		// Remove all mails
		for (const key of this.loadedMails.keys()) {
			this.loadedMails.delete(key);
			this.scheduledMails.delete(key);
		}

		for (const mail of mails) {
			this.importMail(mail.name, mail);
		}
	}

	/**
	 * @param {string} name
	 * @param {Mail} mail
	 */
	importMail(name, mail) {
		Consola.debug(`Loading ${name}...`);

		this.loadMail(mail);

		Consola.success(`Loaded ${name} (${Object.keys(mail.variables).length} variables)!`);
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
