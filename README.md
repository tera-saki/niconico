## Prerequisites
server
- node
- choromium-driver (chromedriver)
- redis
```
sudo apt install chromium-driver chromium-l10n redis
```

client
- Slack (with Incoming Webhooks enable)

## Setting
Edit `config/config.js`
```
const config = {
    email: '',    <-- your email address
    password: '', <-- your password
    hookUrl: ''   <-- Webhook URL of slack chennel you want to post notifications
}
```

## Run
```
node src/index.js
```