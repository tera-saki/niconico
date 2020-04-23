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
  await driver.get('https://www.nicovideo.jp/my/top')
  const mail_input = await fe(driver, '//input[@id="input__mailtel"]')
  await mail_input.sendKeys(config.email)
  const password_input = await fe(driver, '//input[@id="input__password"]')
  await password_input.sendKeys(config.password)
  const login_btn = await fe(driver, '//input[@id="login__submit"]')
  await login_btn.click()
}

async function getNicorepo(driver) {
  await driver.wait(until.elementLocated(By.className('NicorepoTimelineItem')))
  const repos = await driver.findElements(By.className('NicorepoTimelineItem'))
  const results = []
  for (const repo of repos) {
    const log_body = await repo.findElement(By.className('log-body'))
    const message = await log_body.getText()
    const user = await log_body.findElement(By.css('a')).getText()
    if (message.match('動画を投稿しました')) {
      const log_target = await repo.findElement(By.className('log-target-info'))
      const title = await log_target.findElement(By.css('a')).getText()
      const url_q = await log_target.findElement(By.css('a')).getAttribute('href')
      const url = url_q.split('?')[0]
      results.push({ title, user, url })
    }
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
