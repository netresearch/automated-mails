const { Router } = require('express');

const router = Router();

router.use('/api/v1/', require('./apiV1.js'));

module.exports = router;
