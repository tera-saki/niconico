const { By, until } = require('selenium-webdriver')
const axios = require('axios')
const Redis = require("ioredis")
const _ = require('lodash')

const { fe, createDriver } = require('./function')
const redis = new Redis()
const config = require('../config/config')

const expiredays = 10
const expiresecs = expiredays * 24 * 60 * 60

async function login(driver) {
  await driver.get('https://www.nicovideo.jp/my/nicorepo/all?type=videoUpload')
  const mail_input = await fe(driver, '//input[@id="input__mailtel"]')
  await mail_input.sendKeys(config.email)
  const password_input = await fe(driver, '//input[@id="input__password"]')
  await password_input.sendKeys(config.password)
  const login_btn = await fe(driver, '//input[@id="login__submit"]')
  await login_btn.click()
}

async function closeModal(driver) {
  try {
    const button = await driver.findElement(By.className('UserPageAnnounceContainer-useNewMyPageButton'))
    await button.click()
  } catch (e) {
    ;
  }
}

async function getNicorepo(driver) {
  await driver.wait(until.elementLocated(By.className('NicorepoTimeline-item')))
  const repos = (await driver.findElements(By.className('NicorepoTimeline-item'))).reverse()
  const results = []
  for (const repo of repos) {
    const senderName = await repo.findElement(By.className('NicorepoItem-senderName'))
    const user = await senderName.getText()
    const content = await repo.findElement(By.className('NicorepoItem-content'))
    const title = await content.findElement(By.className('NicorepoItem-contentDetailTitle')).getText()
    const url_q = await content.getAttribute('href')
    const url = url_q.split('?')[0]
    results.push({ title, user, url })
  }
  return results
}

async function extractNewRepos(repos) {
  const exist = (
    await redis.pipeline(
      repos.map(({ url }) => ['exists', url])
    ).exec()
  ).map(([err, res]) => res)
  const newRepos = _.zip(repos, exist).filter(r => !r[1]).map(r => r[0])
  await redis.pipeline(
    newRepos.map(({ url, title }) => ['setex', url, expiresecs, title])
  ).exec()
  return newRepos
}

async function sendToSlack(results) {
  if (results.length === 0) {
    return
  }
  let text = ''
  for (const result of results) {
    text += `${result.title} (${result.user})\n ${result.url}\n`
  }
  await axios.post(config.hookUrl, { text })
}

async function main() {
  const driver = await createDriver()
  try {
    await login(driver)
    await closeModal(driver)
    const repos = await getNicorepo(driver)
    const newRepos = await extractNewRepos(repos)
    await sendToSlack(newRepos)
  } catch (e) {
    console.log(e);
  } finally {
    await driver.quit()
  }
}

main().then(() => {
  process.exit(0)
})
