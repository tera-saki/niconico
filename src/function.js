const { Builder, By, Key, until } = require('selenium-webdriver');
const { Options } = require('selenium-webdriver/chrome')

async function fe(driver, xpath) {
  return await driver.findElement(By.xpath(xpath))
}

async function createDriver() {
  const options = new Options().addArguments(['--headless', '--lang=ja'])
  return await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build()
}

module.exports = { fe, createDriver }
