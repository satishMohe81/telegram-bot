const TelegramBot = require('node-telegram-bot-api');
const { PublicKey, Connection } = require('@solana/web3.js');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

// Environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_USER_ID = parseInt(process.env.ADMIN_USER_ID);
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Initialize Telegram bot
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Initialize Solana connection
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// Conversation states
const STATES = {
  AWAITING_COMMAND: 1,
  AWAITING_ADDRESS: 2,
  AWAITING_CONFIRMATION: 3,
  PROCESSING: 4
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

// Generate email text
async function generateEmailText(coinDetails, chatId) {
  const emailText = `Coin: ${coinDetails.name}\nSymbol: ${coinDetails.symbol}\nPrice: $${coinDetails.price}\nAddress: ${coinDetails.address}`;
  try {
    await bot.sendMessage(chatId, `Email text:\n${emailText}`);
    await notifyAdmin(`Email text generated for coin: ${coinDetails.name} (${coinDetails.address}) by user ${chatId}`);
  } catch (error) {
    await bot.sendMessage(chatId, 'Failed to generate email text.');
    await notifyAdmin(`Email text generation failed for user ${chatId}: ${error.message}`);
    throw error;
  }
}

// Fetch coin details from Solana and CoinGecko
async function getCoinDetails(address, chatId) {
  try {
    const publicKey = new PublicKey(address);
    const tokenInfo = await connection.getAccountInfo(publicKey);
    if (!tokenInfo) {
      throw new Error('Invalid or non-existent token address');
    }
    const response = await fetch(`${COINGECKO_API}/coins/solana/contract/${address}`);
    const data = await response.json();
    if (data.error) {
      return {
        name: 'Unknown Token',
        symbol: 'UNKNOWN',
        price: 0,
        address
      }; // Fallback for unlisted tokens
    }
    return {
      name: data.name || 'Unknown Token',
      symbol: data.symbol.toUpperCase() || 'UNKNOWN',
      price: data.market_data?.current_price?.usd || 0,
      address
    };
  } catch (error) {
    await bot.sendMessage(chatId, `Error fetching coin details: ${error.message}`);
    await notifyAdmin(`Error fetching coin details for address ${address} by user ${chatId}: ${error.message}`);
    return null;
  }
}

// Simulate task with random failure
async function simulateTask(chatId) {
  await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate 3-second task
  if (Math.random() < 0.5) { // 50% chance of failure
    throw new Error('Task failed');
  }
  return true;
}

// Handle /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, 'What do you want to do? (e.g., "promote")');
  await notifyAdmin(`User ${chatId} started bot.`);
  userStates.set(chatId, { state: STATES.AWAITING_COMMAND });
});

// Handle text messages
bot.on
