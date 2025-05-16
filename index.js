const TelegramBot = require('node-telegram-bot-api');

// Configuration (set these in Railway)
const TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

// Initialize bot
const bot = new TelegramBot(TOKEN, { polling: true });

// Single command
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    '📩 Send us your message. We\'ll respond shortly!'
  );
});

// Forward all messages to admin
bot.on('message', (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  
  const chatId = msg.chat.id;
  
  // Forward to admin
  bot.sendMessage(
    ADMIN_CHAT_ID,
    `✉️ New message from ${chatId}:\n\n${msg.text}`
  );
  
  // Confirm to user
  bot.sendMessage(
    chatId,
    '✅ Thanks! We got your message:\n\n"' + msg.text + '"\n\nWe\'ll respond soon!'
  );
});

console.log('🤖 Forwarding bot is running');
