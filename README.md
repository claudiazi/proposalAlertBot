Credits to [gabrieljaegerde](https://github.com/gabrieljaegerde/tipAlert_telegram) whose project this one was built on top of.

# Proposal Alert Telegram Bot

With this bot users can easily track their treasury proposals as they pass through council. Whenever there is an update to it, they will receive a notification on telegram.

Looking to support me?
KSM: HyQGoQZk5BM3Wt6nUhjW1QbPWrSRFmR4eeEihPJH84WdDsA

## Usage

Setting up an alert is super easy:

Step 1: Select the proposal motion events that you want to be notified for (new motion, motion vote, motion fully voted)

Step 2: Enter address of wallet that should be tracked

A user can easily view, edit and delete any of their alerts.

## Installation

##### Database
Create a mongodb with [atlas](https://www.mongodb.com/atlas/database) for example.

##### Telegram API Key
Create a bot api key on telegram by messaging the BotFather.

##### .env
Create a .env file with the .env-sample structure. Fill in the required fields.

```npm install```

```tsc```

```node dist/index.js```

### License
Apache License 2.0
