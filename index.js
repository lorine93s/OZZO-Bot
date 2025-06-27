require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const WalletVerification = require('./features/walletVerify');
const ApplyGrant = require('./features/applyGrant');
const AdminNFTTracker = require('./features/ozzoComplete');
const { handleNFTPagination, handleNFTViewButton, handleRefreshStatus } = require('./slash_commands/walletStatus')

// Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const walletVerification = new WalletVerification(client);
const applyGrant = new ApplyGrant(client);
const ozzoNFT = new AdminNFTTracker(client);


// Command Collection
client.commands = new Collection();

// Load Commands
const commandsPath = path.join(__dirname, 'slash_commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  client.commands.set(command.data.name, command);
}

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  client.guilds.cache.forEach(async guild => {
    try {
      await walletVerification.setupVerificationChannel(guild);
      await applyGrant.setupGrantChannel(guild);
    } catch (err) {
      console.error(`Error setting up channels in ${guild.name}:`, err);
    }
  });
  
  ozzoNFT.startTracking();

});

client.on('interactionCreate', async interaction => {
  
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'walletVerification') {
      await walletVerification.handleVerifyModal(interaction);
    } else if (interaction.customId === 'grantApplication') {
      // await handleModalSubmit(interaction);
      await applyGrant.handleModalSubmit(interaction);
    }
  } else if (interaction.isButton()) {
        if (interaction.customId === 'start_wallet_verification') {
            await walletVerification.handleVerifyButton(interaction);
        } else if (interaction.customId === 'start_grant_application') {
            // await handleGrantButton(interaction);
            await applyGrant.handleGrantButton(interaction);
        } else if (interaction.customId.startsWith('approveGrant_') || interaction.customId.startsWith('rejectGrant_')) {
            await applyGrant.handleGrantReview(interaction);
        } else if (interaction.customId.startsWith('view_nfts_')) {
            await handleNFTViewButton(interaction);
        } else if (interaction.customId.startsWith('nft_page_')) {
            await handleNFTPagination(interaction);
        } else if (interaction.customId.startsWith('refresh_status_')) {
        await handleRefreshStatus(interaction);
      }
    }
});

// Slash Command Handler
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({ 
        content: 'There was an error while executing this command!',
        ephemeral: true 
      });
    }
  }
});


client.login(process.env.DISCORD_TOKEN);
