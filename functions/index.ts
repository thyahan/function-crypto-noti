import * as functions from 'firebase-functions';
import * as puppeteer from 'puppeteer';
import axios from 'axios';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as FormData from 'form-data';

import {graphUrl, discordWebhook, binanceAPI} from './config';
import {IScreenshot, IBinanceAvgPriceResponse} from './@types';

const SCHEDULE_EXPRESSION = '0 3,7,11,15,19,23 * * *';
// const SCHEDULE_EXPRESSION = '*/1 * * * *';
const TIME_ZONE = 'Asia/Bangkok';
const DELAY_MINLISECOND = 45 * 1000;
const TIME_OUT = 60 * 1000;

function getDate(): string {
  const [date, time] = new Date().toLocaleString('en-US', {timeZone: TIME_ZONE, hour12: false}).split(', ');
  const mdy = date.split('/');

  return `${mdy[1]}/${mdy[0]}/${mdy[2]} ${time}`;
}

async function getBTCPrice(): Promise<string> {
  const url = `${binanceAPI}/avgPrice?symbol=BTCUSDT`;
  const res: IBinanceAvgPriceResponse = await axios.get(url);

  return parseFloat(res.data.price).toLocaleString('en-US', {maximumFractionDigits: 4});
}

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
    waitUntil: 'networkidle0',
    timeout: TIME_OUT,
  });
  await page.waitForTimeout(delay);
  await page.screenshot({path: filename});
  await browser.close();
}

async function discordSendNoti(filename: string) {
  console.log('sending discord notification');
  const file = fs.createReadStream(filename);

  const formData = new FormData();

  const price = await getBTCPrice();
  const content = `**${price}**\n----------------\n${getDate()}`;

  formData.append('content', content);
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
