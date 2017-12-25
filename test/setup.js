'use strict';

const chai = require('chai');
const mocha = require('mocha');
const dirtyChai = require('dirty-chai');

chai.use(dirtyChai);

global.expect = chai.expect;
global.mocha = mocha;
