const { Router } = require('express');
const mailManager = require('./MailManager').getInstance();

const router = Router();

const mailManagerLoaded = (req, res, next) => (!mailManager.loaded ? res.status(503).end() : next());

router.get('/mails', mailManagerLoaded, (req, res) => {
	res.json(mailManager.export());
});

router.post('/mails/', mailManagerLoaded, (req, res) => {
	if (typeof req.body !== 'object' || !Array.isArray(req.body)) {
		return res.status(400).end();
	}

	mailManager.import(req.body);

	res.end();
});

router.get('/mails/:name', mailManagerLoaded, async (req, res) => {
	if (typeof req.params.name !== 'string' || !req.params.name.length) {
		return res.status(400).end();
	}

	const mail = mailManager.loadedMails.get(req.params.name);

	if (req.headers.accept && req.headers.accept === 'text/html') {
		res.header('content-type', 'text/html').end(mail.html);
	} else if (req.headers.accept && req.headers.accept === 'text/plain') {
		res.header('content-type', 'text/plain').end(mail.text);
	} else {
		res.json(mail);
	}
});

router.post('/mails/:name', mailManagerLoaded, (req, res) => {
	if (typeof req.params.name !== 'string' || !req.params.name.length) {
		console.log('lul')
		return res.status(400).end();
	} else if (typeof req.body !== 'object' || Array.isArray(req.body)) {
		console.log('body')
		return res.status(400).end();
	}

	mailManager.importMail(req.params.name, req.body);

	res.end();
});

router.post('/mails/:name/send', mailManagerLoaded, async (req, res) => {
	if (typeof req.params.name !== 'string' || !req.params.name.length) {
		return res.status(400).end();
	}

	await mailManager.sendTestMail(req.params.name);

	res.end();
});

module.exports = router;
