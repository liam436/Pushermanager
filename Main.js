const {
    Client, 
    GatewayIntentBits, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    PermissionFlagsBits,
    REST,
    Routes
} = require('discord.js');
require('dotenv').config();

// Bot configuration
const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Configuration for private channels
const OPGAVE_CATEGORY_NAME = 'OPGAVER';
const OPGAVE_LOG_CHANNEL_NAME = 'opgave-log'; // Or whatever log channel you want
const CHANNEL_PREFIX = 'opgave';
const randomNumber = Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000;
const channelName = `${CHANNEL_PREFIX}-${randomNumber}`;

// Create Discord client
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds
    ] 
});

// Colors for embeds
const COLORS = {
    PRIMARY: 0x3498db,    // Blue
    SUCCESS: 0x2ecc71,   // Green
    DANGER: 0xe74c3c,    // Red
    WARNING: 0xf39c12    // Orange
};

// Register slash commands
async function registerCommands() {
const commands = [
    new SlashCommandBuilder()
        .setName('opgave')
        .setDescription('Opret en ny opgave for serveren')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('pusherinfo')
        .setDescription('Se information om opgaver en bruger har færdiggjort')
        .addUserOption(option =>
            option.setName('bruger')
                .setDescription('Vælg brugeren du vil se information om')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(cmd => cmd.toJSON());

    

    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

    try {
        console.log('🔄 Registrerer slash commands...');
        
        // Register commands globally (takes up to 1 hour to appear)
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );

        console.log('✅ Slash commands registreret globally!');
        
        // Also register for each guild (appears immediately for testing)
        const guilds = client.guilds.cache.map(guild => guild.id);
        for (const guildId of guilds) {
            await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, guildId),
                { body: commands }
            );
            console.log(`✅ Commands registered for guild: ${guildId}`);
        }
        
    } catch (error) {
        console.error('❌ Fejl ved registrering af commands:', error);
    }
}

// Bot ready event
client.once('ready', async () => {
    console.log(`🚀 Bot er klar! Logget ind som ${client.user.tag}`);
    await registerCommands();
});

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'opgave') {
        await handleOpgaveCommand(interaction);
    }

    if (interaction.commandName === 'pusherinfo') {
    await handlePusherInfo(interaction);
    }

});

// Handle button interactions and modals
client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
        await handleButtonInteraction(interaction);
    } else if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
    }
});

// Main opgave command handler
async function handleOpgaveCommand(interaction) {
    try {
        // Check if user is admin
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('🚫 Ingen Tilladelse')
                .setDescription('Du skal være administrator for at bruge denne kommando!')
                .setColor(COLORS.DANGER)
                .setTimestamp()
                .setFooter({ text: 'Opgave System', iconURL: client.user.displayAvatarURL() });

            return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // Create beautiful main embed
        const mainEmbed = new EmbedBuilder()
            .setTitle('📋 Pusher System')
            .setDescription('**Tryk på knappen nedenfor for at oprette en ny opgave**\n\n' +
                          '🔹 Kun administratorer kan oprette opgaver\n' +
                          '🔹 Opgaver vil blive sendt til den specificerede kanal\n' +
                          '🔹 Andre brugere kan acceptere eller afvise opgaverne')
            .setColor(COLORS.PRIMARY)
            .setTimestamp()
            .setFooter({ text: 'Pusher System', iconURL: client.user.displayAvatarURL() });

        // Create button
        const button = new ButtonBuilder()
            .setCustomId('create_opgave')
            .setLabel('🆕 Opret Opgave')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        await interaction.reply({ embeds: [mainEmbed], components: [row] });

    } catch (error) {
        console.error('Fejl i opgave command:', error);
        await interaction.reply({ 
            content: '❌ Der opstod en fejl ved udførelse af kommandoen.', 
            ephemeral: true 
        });
    }
}

// Handle button clicks
async function handleButtonInteraction(interaction) {
    try {
        const { customId } = interaction;

        if (customId === 'create_opgave') {
            await handleCreateOpgaveButton(interaction);
        } else if (customId.startsWith('accept_opgave_')) {
            await handleAcceptOpgave(interaction);
        } else if (customId.startsWith('reject_opgave_')) {
            await handleRejectOpgave(interaction);
        } else if (customId.startsWith('complete_opgave_')) {
            await handleCompleteOpgave(interaction);
        } else if (customId.startsWith('incomplete_opgave_')) {
            await handleIncompleteOpgave(interaction);
        }

    } catch (error) {
        console.error('Fejl i button interaction:', error);
        await interaction.reply({ 
            content: '❌ Der opstod en fejl ved behandling af din anmodning.', 
            ephemeral: true 
        });
    }
}

// Create opgave button handler
async function handleCreateOpgaveButton(interaction) {
    // Check admin permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('🚫 Ingen Tilladelse')
            .setDescription('Kun administratorer kan oprette opgaver!')
            .setColor(COLORS.DANGER)
            .setTimestamp();

        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    // Create modal
    const modal = new ModalBuilder()
        .setCustomId('opgave_modal')
        .setTitle('📝 Opret Ny Opgave');

    // Create input fields
    const navnInput = new TextInputBuilder()
        .setCustomId('opgave_navn')
        .setLabel('📌 Navn på opretter?')
        .setPlaceholder('F.eks. Jens Jensen')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

    const beskrivelseinput = new TextInputBuilder()
        .setCustomId('opgave_beskrivelse')
        .setLabel('👤 Hvad er opgaven?')
        .setPlaceholder('Sælger Kokain')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500);

    const maengdeInput = new TextInputBuilder()
        .setCustomId('opgave_maengde')
        .setLabel('🔢 Hvor meget er mængden?')
        .setPlaceholder('F.eks. 2000, 5000 etc.')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50);

    const kanalInput = new TextInputBuilder()
        .setCustomId('opgave_kanal')
        .setLabel('📺 Hvilken kanal?')
        .setPlaceholder('Skriv kanalnavnet (uden #)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50);

    // Add inputs to modal
    const row1 = new ActionRowBuilder().addComponents(navnInput);
    const row2 = new ActionRowBuilder().addComponents(beskrivelseinput);
    const row3 = new ActionRowBuilder().addComponents(maengdeInput);
    const row4 = new ActionRowBuilder().addComponents(kanalInput);

    modal.addComponents(row1, row2, row3, row4);

    await interaction.showModal(modal);
}

// Handle modal submission
async function handleModalSubmit(interaction) {
    if (interaction.customId !== 'opgave_modal') return;

    try {
        // Get form data
        const navn = interaction.fields.getTextInputValue('opgave_navn');
        const beskrivelse = interaction.fields.getTextInputValue('opgave_beskrivelse');
        const maengde = interaction.fields.getTextInputValue('opgave_maengde');
        const kanalNavn = interaction.fields.getTextInputValue('opgave_kanal');

        // Find the channel
        const targetChannel = interaction.guild.channels.cache.find(
            channel => channel.name.toLowerCase() === kanalNavn.toLowerCase() && channel.isTextBased()
        );

        if (!targetChannel) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Kanal Ikke Fundet')
                .setDescription(`Kunne ikke finde en kanal med navnet **${kanalNavn}**\n\n` +
                              '🔍 Tjek at:\n' +
                              '• Kanalnavnet er stavet korrekt\n' +
                              '• Kanalen eksisterer på denne server\n' +
                              '• Du ikke inkluderer # i navnet')
                .setColor(COLORS.DANGER)
                .setTimestamp();

            return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // Create opgave embed
        const opgaveEmbed = new EmbedBuilder()
            .setTitle('📋 Ny Opgave Oprettet!')
            .setDescription(`**${navn}**`)
            .addFields(
                { name: '📝 Beskrivelse', value: beskrivelse, inline: false },
                { name: '📊 Mængde', value: maengde, inline: true },
                { name: '👤 Oprettet af', value: `<@${interaction.user.id}>`, inline: true },
                { name: '📅 Dato', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setColor(COLORS.PRIMARY)
            .setTimestamp()
            .setFooter({ text: 'Opgave System • Tryk på en knap for at reagere', iconURL: client.user.displayAvatarURL() });

        // Create action buttons
        const acceptButton = new ButtonBuilder()
            .setCustomId(`accept_opgave_${Date.now()}`)
            .setLabel('✅ Accepter')
            .setStyle(ButtonStyle.Success);

        const rejectButton = new ButtonBuilder()
            .setCustomId(`reject_opgave_${Date.now()}`)
            .setLabel('❌ Afvis')
            .setStyle(ButtonStyle.Danger);

        const actionRow = new ActionRowBuilder().addComponents(acceptButton, rejectButton);

        // Send to target channel
        await targetChannel.send({ embeds: [opgaveEmbed], components: [actionRow] });

        // Confirm to user
        const confirmEmbed = new EmbedBuilder()
            .setTitle('✅ Opgave Sendt!')
            .setDescription(`Din opgave **"${navn}"** er blevet sendt til <#${targetChannel.id}>`)
            .setColor(COLORS.SUCCESS)
            .setTimestamp();

        await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });

    } catch (error) {
        console.error('Fejl ved modal submit:', error);
        await interaction.reply({ 
            content: '❌ Der opstod en fejl ved oprettelse af opgaven.', 
            ephemeral: true 
        });
    }
}

// Create private opgave channel
async function createOpgaveChannel(interaction, creatorId, acceptorId) {
    try {
        const guild = interaction.guild;
        
        // Find or create the category
        let category = guild.channels.cache.find(
            channel => channel.type === 4 && channel.name.toLowerCase() === OPGAVE_CATEGORY_NAME.toLowerCase()
        );

        if (!category) {
            category = await guild.channels.create({
                name: OPGAVE_CATEGORY_NAME,
                type: 4, // Category type
                reason: 'Opgave system - kategori for opgave kanaler'
            });
        }

        // Generate unique channel name
        const channelId = Math.random().toString(36).substr(2, 8);
        const channelName = `${CHANNEL_PREFIX}-${channelId}`;

        // Create private text channel
        const privateChannel = await guild.channels.create({
            name: channelName,
            type: 0, // Text channel
            parent: category.id,
            reason: 'Opgave system - privat kanal for opgave',
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: ['ViewChannel'],
                },
                {
                    id: creatorId,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
                },
                {
                    id: acceptorId,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
                },
                {
                    id: client.user.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'],
                }
            ],
        });

        // Send welcome message in private channel
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('📋 Privat Opgave Kanal')
            .setDescription('Denne kanal er oprettet til jeres opgave samarbejde!')
            .addFields(
                { name: '👤 Opgave Opretter', value: `<@${creatorId}>`, inline: true },
                { name: '✅ Opgave Accepteret af', value: `<@${acceptorId}>`, inline: true },
                { name: '📅 Oprettet', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setColor(COLORS.PRIMARY)
            .setTimestamp()
            .setFooter({ text: 'Opgave System • Privat Kanal', iconURL: client.user.displayAvatarURL() });

        await privateChannel.send({ embeds: [welcomeEmbed] });

        return privateChannel;

    } catch (error) {
        console.error('Fejl ved oprettelse af privat kanal:', error);
        return null;
    }
}

// Handle accept opgave
async function handleAcceptOpgave(interaction) {
    try {
        // Get the original embed to extract creator info
        const originalEmbed = interaction.message.embeds[0];
        const creatorField = originalEmbed.fields.find(field => field.name === '👤 Oprettet af');
        const creatorMention = creatorField ? creatorField.value : null;
        const creatorId = creatorMention ? creatorMention.match(/<@(\d+)>/)?.[1] : null;

        if (!creatorId) {
            return await interaction.reply({ 
                content: '❌ Kunne ikke finde opgave opretteren.', 
                ephemeral: true 
            });
        }

        // Create private channel for the opgave
        const privateChannel = await createOpgaveChannel(interaction, creatorId, interaction.user.id);

        // Disable original buttons in the original channel
        const originalButtons = interaction.message.components[0].components.map(button => 
            ButtonBuilder.from(button).setDisabled(true)
        );
        const disabledRow = new ActionRowBuilder().addComponents(originalButtons);

        // Update original message to show it's been accepted
        const acceptedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(COLORS.SUCCESS)
            .addFields({ name: '✅ Status', value: `Accepteret af <@${interaction.user.id}>`, inline: false });

        await interaction.update({ 
            embeds: [acceptedEmbed], 
            components: [disabledRow] 
        });

        if (privateChannel) {
            // Send the opgave details to private channel
            const opgaveDetailsEmbed = new EmbedBuilder()
                .setTitle('📋 Opgave Detaljer')
                .setDescription(originalEmbed.description)
                .addFields(...originalEmbed.fields)
                .addFields({ name: '✅ Accepteret af', value: `<@${interaction.user.id}>`, inline: true })
                .setColor(COLORS.SUCCESS)
                .setTimestamp()
                .setFooter({ text: 'Opgave System • Marker status når du er færdig', iconURL: client.user.displayAvatarURL() });

            // Create completion buttons for private channel
            const completeButton = new ButtonBuilder()
                .setCustomId(`complete_opgave_${Date.now()}_${interaction.user.id}_${creatorId}`)
                .setLabel('✅ Færdig')
                .setStyle(ButtonStyle.Success);

            const incompleteButton = new ButtonBuilder()
                .setCustomId(`incomplete_opgave_${Date.now()}_${interaction.user.id}`)
                .setLabel('❌ Ikke Færdig')
                .setStyle(ButtonStyle.Secondary);

            const completionRow = new ActionRowBuilder().addComponents(completeButton, incompleteButton);

            await privateChannel.send({ 
                embeds: [opgaveDetailsEmbed], 
                components: [completionRow] 
            });
        }

    } catch (error) {
        console.error('Fejl ved accept:', error);
        await interaction.reply({ 
            content: '❌ Der opstod en fejl ved acceptering af opgaven.', 
            ephemeral: true 
        });
    }
}

// Handle reject opgave
async function handleRejectOpgave(interaction) {
    try {
        // Disable original buttons
        const originalButtons = interaction.message.components[0].components.map(button => 
            ButtonBuilder.from(button).setDisabled(true)
        );
        const disabledRow = new ActionRowBuilder().addComponents(originalButtons);

        // Update original message to show it's been rejected
        const rejectedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(COLORS.DANGER)
            .addFields({ name: '❌ Status', value: `Afvist af <@${interaction.user.id}>`, inline: false });

        await interaction.update({ 
            embeds: [rejectedEmbed], 
            components: [disabledRow] 
        });

    } catch (error) {
        console.error('Fejl ved afvisning:', error);
        await interaction.reply({ 
            content: '❌ Der opstod en fejl ved afvisning af opgaven.', 
            ephemeral: true 
        });
    }
}

// Send completion notification to creator
async function sendCompletionNotification(guild, creatorId, completedBy, opgaveTitle, completedAt) {
    try {
        const creator = await guild.members.fetch(creatorId);
        if (!creator) return;

        const completionEmbed = new EmbedBuilder()
            .setTitle('🎉 Opgave Fuldført!')
            .setDescription(`Din opgave er blevet fuldført med succes!`)
            .addFields(
                { name: '📋 Opgave', value: opgaveTitle || 'Unavngivet opgave', inline: false },
                { name: '👤 Fuldført af', value: `<@${completedBy.id}>`, inline: true },
                { name: '🏷️ Bruger', value: `${completedBy.username}#${completedBy.discriminator}`, inline: true },
                { name: '⏰ Tidspunkt', value: `<t:${Math.floor(completedAt / 1000)}:F>`, inline: false },
                { name: '📅 Fuldført for', value: `<t:${Math.floor(completedAt / 1000)}:R>`, inline: true }
            )
            .setColor(COLORS.SUCCESS)
            .setTimestamp()
            .setThumbnail(completedBy.displayAvatarURL({ dynamic: true, size: 128 }))
            .setFooter({ 
                text: 'Opgave System • Tak fordi du bruger systemet!', 
                iconURL: guild.client.user.displayAvatarURL() 
            });

        // Try to send DM first, then fallback to a channel mention
        try {
            await creator.send({ embeds: [completionEmbed] });
            console.log(`✅ Sent completion notification to ${creator.user.tag} via DM`);
        } catch (dmError) {
            console.log(`⚠️ Could not send DM to ${creator.user.tag}, they may have DMs disabled`);
            
            // Find a suitable channel to notify (you might want to customize this)
            const notificationChannel = guild.channels.cache.find(
                channel => channel.isTextBased() && 
                channel.permissionsFor(guild.client.user).has(['SendMessages', 'ViewChannel'])
            );
            
            if (notificationChannel) {
                const publicNotification = new EmbedBuilder()
                    .setTitle('🎉 Opgave Fuldført!')
                    .setDescription(`<@${creatorId}>, din opgave er blevet fuldført!`)
                    .addFields(
                        { name: '📋 Opgave', value: opgaveTitle || 'Unavngivet opgave', inline: false },
                        { name: '👤 Fuldført af', value: `<@${completedBy.id}>`, inline: true },
                        { name: '⏰ Tidspunkt', value: `<t:${Math.floor(completedAt / 1000)}:R>`, inline: true }
                    )
                    .setColor(COLORS.SUCCESS)
                    .setTimestamp();
                    
                await notificationChannel.send({ embeds: [publicNotification] });
                console.log(`✅ Sent completion notification to ${notificationChannel.name} channel`);
            }
        }

    } catch (error) {
        console.error('Fejl ved afsendelse af completion notification:', error);
    }
}

// Handle complete opgave (Updated with new functionality)
async function handleCompleteOpgave(interaction) {
    try {
        // Extract user ID and creator ID from custom ID
        const customIdParts = interaction.customId.split('_');
        const userId = customIdParts[customIdParts.length - 2];
        const creatorId = customIdParts[customIdParts.length - 1];
        
        // Check if the person clicking is the one who accepted
        if (interaction.user.id !== userId) {
            return await interaction.reply({ 
                content: '❌ Kun personen der accepterede opgaven kan markere den som færdig.', 
                ephemeral: true 
            });
        }

        // Get opgave title from the embed
        const opgaveEmbed = interaction.message.embeds.find(embed => embed.title === '📋 Opgave Detaljer');
        const opgaveTitle = opgaveEmbed ? opgaveEmbed.description.replace(/\*\*/g, '') : null;

        const completeEmbed = new EmbedBuilder()
            .setTitle('🎊 Opgave Fuldført!')
            .setDescription(`**<@${interaction.user.id}>** har fuldført opgaven!`)
            .addFields(
                { name: '⏰ Fuldført', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                { name: '👤 Fuldført af', value: `<@${interaction.user.id}>`, inline: true },
                { name: '🏆 Status', value: '**FÆRDIG** ✅', inline: true }
            )
            .setColor(COLORS.SUCCESS)
            .setTimestamp()
            .setFooter({ text: 'Opgave System • Opgaven er fuldført!', iconURL: client.user.displayAvatarURL() });

        // Disable completion buttons
        const originalButtons = interaction.message.components[0].components.map(button => 
            ButtonBuilder.from(button).setDisabled(true)
        );
        const disabledRow = new ActionRowBuilder().addComponents(originalButtons);

        await interaction.update({ 
            embeds: [...interaction.message.embeds], 
            components: [disabledRow] 
        });

        // Send completion message in the private channel
        await interaction.followUp({ embeds: [completeEmbed] });

        // Send notification to the creator
        await sendCompletionNotification(
            interaction.guild, 
            creatorId, 
            interaction.user, 
            opgaveTitle, 
            Date.now()
        );

        // Send log to admin channel
const logChannel = interaction.guild.channels.cache.find(
    channel => channel.name === OPGAVE_LOG_CHANNEL_NAME && channel.isTextBased()
);

if (logChannel) {
const opgaveEmbed = interaction.message.embeds.find(embed => embed.title === '📋 Opgave Detaljer');
const opgaveTitle = opgaveEmbed?.fields.find(f => f.name === '📝 Beskrivelse')?.value || 'Ukendt';
const maengde = opgaveEmbed?.fields.find(f => f.name === '📊 Mængde')?.value || 'Ikke angivet';
const beskrivelse = opgaveTitle; // since the "opgave" is the beskrivelse now


    const logEmbed = new EmbedBuilder()
    .setTitle('📝 Log: Opgave Fuldført')
    .addFields(
        { name: '👤 Bruger', value: `<@${interaction.user.id}>`, inline: true },
        { name: '📦 Mængde', value: maengde, inline: true },
        { name: '📝 Beskrivelse', value: beskrivelse, inline: false },
        { name: '⏰ Tidspunkt', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: false }
    )
    .setColor(COLORS.PRIMARY)
    .setTimestamp();


    await logChannel.send({ embeds: [logEmbed] });
}


        // Delete the private channel after a short delay
        setTimeout(async () => {
            try {
                const deleteWarningEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Kanal Slettes')
                    .setDescription('Denne kanal vil blive slettet om 30 sekunder da opgaven er fuldført.')
                    .setColor(COLORS.WARNING)
                    .setTimestamp();

                await interaction.channel.send({ embeds: [deleteWarningEmbed] });

                // Delete after 30 seconds
                setTimeout(async () => {
                    try {
                        if (interaction.channel.deletable) {
                            await interaction.channel.delete('Opgave fuldført - automatisk sletning');
                            console.log(`✅ Deleted private channel after completion`);
                        }
                    } catch (deleteError) {
                        console.error('Fejl ved sletning af kanal:', deleteError);
                    }
                }, 30000); // 30 seconds

            } catch (error) {
                console.error('Fejl ved sletnings-advarsel:', error);
            }
        }, 5000); // 5 seconds delay before showing delete warning

    } catch (error) {
        console.error('Fejl ved fuldførelse:', error);
        await interaction.reply({ 
            content: '❌ Der opstod en fejl ved markering som færdig.', 
            ephemeral: true 
        });
    }
}

// Handle incomplete opgave
async function handleIncompleteOpgave(interaction) {
    try {
        // Extract user ID from custom ID
        const userId = interaction.customId.split('_').pop();
        
        // Check if the person clicking is the one who accepted
        if (interaction.user.id !== userId) {
            return await interaction.reply({ 
                content: '❌ Kun personen der accepterede opgaven kan markere status.', 
                ephemeral: true 
            });
        }

        const incompleteEmbed = new EmbedBuilder()
            .setTitle('⏸️ Opgave Status Opdateret')
            .setDescription(`**<@${interaction.user.id}>** har markeret opgaven som ikke færdig endnu.`)
            .addFields(
                { name: '⏰ Opdateret', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                { name: '👤 Opdateret af', value: `<@${interaction.user.id}>`, inline: true },
                { name: '📊 Status', value: '**I GANG** 🔄', inline: true }
            )
            .setColor(COLORS.WARNING)
            .setTimestamp()
            .setFooter({ text: 'Opgave System • Opgaven er stadig i gang', iconURL: client.user.displayAvatarURL() });

        // Send status update in the private channel
        await interaction.reply({ embeds: [incompleteEmbed] });

    } catch (error) {
        console.error('Fejl ved ikke-færdig markering:', error);
        await interaction.reply({ 
            content: '❌ Der opstod en fejl ved opdatering af status.', 
            ephemeral: true 
        });
    }
}

async function handlePusherInfo(interaction) {
    const user = interaction.options.getUser('bruger');
    const logChannel = interaction.guild.channels.cache.find(
        channel => channel.name === OPGAVE_LOG_CHANNEL_NAME && channel.isTextBased()
    );

    if (!logChannel) {
        return await interaction.reply({ 
            content: '❌ Kunne ikke finde log-kanalen.', 
            ephemeral: true 
        });
    }

    await interaction.deferReply({ ephemeral: true });

    let fetchedMessages = [];
    let lastId;

    // Fetch up to 1000 messages
    for (let i = 0; i < 10; i++) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const messages = await logChannel.messages.fetch(options);
        if (messages.size === 0) break;

        fetchedMessages.push(...messages.values());
        lastId = messages.last().id;
    }

    const userMessages = fetchedMessages
        .filter(msg =>
            msg.embeds.length &&
            msg.embeds[0].title === '📝 Log: Opgave Fuldført' &&
            msg.embeds[0].fields.some(field => field.name === '👤 Bruger' && field.value.includes(user.id))
        );

    if (userMessages.length === 0) {
        return await interaction.editReply({ 
            content: `ℹ️ Ingen færdiggjorte opgaver fundet for <@${user.id}>.` 
        });
    }

    const perPage = 5;
    let currentPage = 0;

const buildEmbed = (page) => {
    const start = page * perPage;
    const end = start + perPage;
    const pageItems = userMessages.slice(start, end);

    const embed = new EmbedBuilder()
        .setTitle(`📊 Opgaveoversigt for ${user.username}`)
        .setDescription(`Antal færdiggjorte opgaver: **${userMessages.length}**\nSide ${page + 1} af ${Math.ceil(userMessages.length / perPage)}`)
        .setColor(COLORS.PRIMARY)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text:'Pusher System', iconURL: client.user.displayAvatarURL() , })
        .setTimestamp();

    pageItems.forEach((msg, i) => {
        const fields = msg.embeds[0].fields;

        const beskrivelse = fields.find(f => f.name === '📝 Beskrivelse')?.value || 'Ingen beskrivelse';
        const maengde = fields.find(f => f.name === '📦 Mængde')?.value || 'Ikke angivet';
        const tidspunkt = fields.find(f => f.name === '⏰ Tidspunkt')?.value || 'Ukendt tidspunkt';

        embed.addFields(
            { name: '📦 Mængde', value: `**${maengde}**`, inline: true },
            { name: '🕒 Udført', value: `*${tidspunkt}*`, inline: true },
            { name: '📖 Beskrivelse', value: `${beskrivelse}`, inline: false }
        );
    });

    return embed;
};


    const getActionRow = (page, totalPages) => {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('prev_page')
                .setLabel('⏮️ Forrige')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId('next_page')
                .setLabel('⏭️ Næste')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= totalPages - 1)
        );
    };

    const totalPages = Math.ceil(userMessages.length / perPage);
    const dm = await interaction.user.send({
        embeds: [buildEmbed(currentPage)],
        components: totalPages > 1 ? [getActionRow(currentPage, totalPages)] : []
    });

    await interaction.editReply({ content: `📬 Info sendt til din DM.` });

    if (totalPages <= 1) return;

    // Create collector
    const collector = dm.createMessageComponentCollector({ time: 60_000 });

    collector.on('collect', async (btn) => {
        if (btn.user.id !== interaction.user.id) return btn.reply({ content: 'Du må ikke bruge disse knapper.', ephemeral: true });

        btn.deferUpdate();
        if (btn.customId === 'next_page' && currentPage < totalPages - 1) currentPage++;
        if (btn.customId === 'prev_page' && currentPage > 0) currentPage--;

        await dm.edit({
            embeds: [buildEmbed(currentPage)],
            components: [getActionRow(currentPage, totalPages)]
        });
    });

    collector.on('end', async () => {
        if (dm.editable) {
            await dm.edit({
                components: [] // Disable buttons when time runs out
            });
        }
    });
}



// Error handling
client.on('error', console.error);
client.on('warn', console.warn);

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Login to Discord
const token = process.env.BOT_TOKEN;
client.login(token);

// Export client for potential external use
module.exports = client;