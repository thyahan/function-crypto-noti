import * as functions from 'firebase-functions';
import * as puppeteer from 'puppeteer';
import axios from 'axios';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as FormData from 'form-data';

import {graphUrl, discordWebhook} from './config';
import {IScreenshot} from './@types';

const SCHEDULE_EXPRESSION = '0 3,7,11,15,19,23 * * *';
// const SCHEDULE_EXPRESSION = '*/1 * * * *';
const TIME_ZONE = 'Asia/Bangkok';
const DELAY_MINLISECOND = 25 * 1000;
const TIME_OUT = 60 * 1000;

async function screenshot({filename, delay}: IScreenshot) {
  console.log('start screenshot');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.setViewport({
    width: 1280,
    height: 720,
    isLandscape: true,
    isMobile: true,
  });

  await page.goto(graphUrl, {
    waitUntil: 'networkidle2',
    timeout: TIME_OUT,
  });
  await page.waitForTimeout(delay);
  await page.screenshot({path: filename});
  await browser.close();
}

async function discordSendNoti(filename: string) {
  console.log('sending discord notification');
  const date = new Date().toLocaleString('en-US', {timeZone: TIME_ZONE});

  const file = fs.createReadStream(filename);

  const formData = new FormData();

  formData.append('content', 'btc 4hrs ' + date);
  formData.append('embeds', file);

  await axios.all(
    discordWebhook.map(webhook => {
      return axios.post(webhook, formData, {headers: {...formData.getHeaders()}});
    })
  );
}

async function onRun() {
  console.log('involking btc_noti');

  const name = Date.now().toString();
  const filename = path.join(os.tmpdir(), `${name}.png`);

  await screenshot({
    filename,
    delay: DELAY_MINLISECOND,
  });

  await discordSendNoti(filename);

  console.log('btc noti completed');

  return null;
}

export const btc_noti = functions
  .region('asia-southeast1')
  .runWith({
    timeoutSeconds: 540,
    memory: '4GB',
  })
  .pubsub.schedule(SCHEDULE_EXPRESSION)
  .timeZone(TIME_ZONE)
  .onRun(onRun);
