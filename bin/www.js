#! /usr/bin/env node
const createServer = require('../index');

createServer().listen(4000, () => {
    console.log('app is start port 4000: localhost:4000');
})