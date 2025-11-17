import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Importar sistema modular de comandos
import { commands, commandHandlers } from './commands/index.js';

// Importar handlers de interacciones
import { buttonHandlers } from './interactions/buttons/index.js';
import { modalHandlers } from './interactions/modals/index.js';

// Importar servicios
import { googleSheetsService } from './services/google/sheets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ===================== INICIO DEL BOT =====================
client.once('ready', async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  
  // Inicializar Google Sheets
  console.log('🔄 Conectando con Google Sheets...');
  const sheetsConnected = await googleSheetsService.initialize();
  if (sheetsConnected) {
    console.log('✅ Google Sheets inicializado correctamente');
  } else {
    console.log('⚠️  Google Sheets no pudo conectarse (funcionalidad limitada)');
  }
  
  // Registrar comandos slash en el servidor (instantáneo)
  const rest = new REST().setToken(process.env.BOT_TOKEN);
  
  try {
    console.log('🔄 Registrando comandos slash en el servidor...');
    
    // Registrar en el servidor específico (instantáneo)
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
        { body: commands }
      );
      console.log(`✅ Comandos registrados en el servidor ${process.env.GUILD_ID}`);
    } else {
      // Fallback: registrar globalmente (tarda hasta 1 hora)
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
      );
      console.log('✅ Comandos registrados globalmente (puede tardar hasta 1 hora)');
    }
  } catch (error) {
    console.error('❌ Error registrando comandos:', error);
  }
});

// ===================== MANEJADOR DE INTERACCIONES =====================
client.on('interactionCreate', async interaction => {
  try {
    // Comandos slash del sistema de torneos
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;
      
      const handler = commandHandlers[commandName];
      if (handler) {
        await handler(interaction);
      } else {
        await interaction.reply({
          content: '❌ Comando no encontrado. Usa `/tournament-setup` para empezar.',
          ephemeral: true
        });
      }
    }

    // Botones del sistema de torneos
    else if (interaction.isButton()) {
      const { customId } = interaction;
      
      // Botones de confirmación de resultados son manejados por collectors
      // No los procesamos aquí para evitar conflictos
      if (customId.startsWith('confirm_result_') || 
          customId.startsWith('edit_result_') || 
          customId.startsWith('cancel_result_')) {
        // Estos botones son manejados por el collector en submitResultWithImage.js
        // No hacer nada aquí, el collector lo manejará
        return;
      }
      
      // Primero buscar handler exacto
      let handler = buttonHandlers[customId];
      
      // Si no existe, buscar handler dinámico
      if (!handler && buttonHandlers._dynamic) {
        for (const [prefix, dynamicHandler] of Object.entries(buttonHandlers._dynamic)) {
          if (customId.startsWith(prefix + '_')) {
            handler = dynamicHandler;
            break;
          }
        }
      }
      
      if (handler) {
        await handler(interaction);
      } else {
        await interaction.reply({
          content: '❌ Botón no reconocido.',
          ephemeral: true
        });
      }
    }

    // Select menus del sistema de torneos
    else if (interaction.isStringSelectMenu()) {
      const { customId } = interaction;
      
      if (customId === 'select_team_to_join') {
        const { handleSelectTeamToJoin } = await import('./interactions/commands/public-registration.js');
        await handleSelectTeamToJoin(interaction);
      } else {
        await interaction.reply({
          content: '❌ Menú de selección no reconocido.',
          ephemeral: true
        });
      }
    }

    // Modales del sistema de torneos
    else if (interaction.isModalSubmit()) {
      const { customId } = interaction;
      
      // Primero buscar handler exacto
      let handler = modalHandlers[customId];
      
      // Si no existe, buscar handler dinámico
      if (!handler && modalHandlers._dynamic) {
        for (const [prefix, dynamicHandler] of Object.entries(modalHandlers._dynamic)) {
          if (customId.startsWith(prefix + '_')) {
            handler = dynamicHandler;
            break;
          }
        }
      }
      
      if (handler) {
        await handler(interaction);
      } else {
        await interaction.reply({
          content: '❌ Modal no reconocido.',
          ephemeral: true
        });
      }
    }

  } catch (error) {
    console.error('❌ Error en interacción:', error);
    
    // Si el error es "Unknown Message", significa que el mensaje/canal fue eliminado
    // (común cuando se hace reset y se borran canales)
    if (error.code === 10008 || error.message?.includes('Unknown Message')) {
      console.log('⚠️ El mensaje o canal fue eliminado durante la operación');
      return; // No intentar responder, el canal ya no existe
    }
    
    const errorMessage = '❌ Ocurrió un error al procesar la interacción.';
    
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorMessage);
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    } catch (replyError) {
      console.error('No se pudo enviar mensaje de error:', replyError.message);
    }
  }
});

// ===================== MANEJO DE ERRORES =====================
client.on('error', error => {
  console.error('❌ Error del cliente Discord:', error);
});

// ===================== SISTEMA DE ENVÍO DE RESULTADOS CON IMAGEN =====================
client.on('messageCreate', async message => {
  try {
    // Ignorar mensajes del bot
    if (message.author.bot) return;
    
    // Verificar si el mensaje es en un canal de equipo (que empiece con "TEAM" o "team")
    const isTeamChannel = message.channel.type === 0 && // GuildText
                         (message.channel.name.toLowerCase().startsWith('team') || 
                          message.channel.name.toUpperCase().startsWith('TEAM'));
    
    if (!isTeamChannel) return;
    
    // Verificar si el mensaje tiene una imagen adjunta
    const hasImage = message.attachments.size > 0 && 
                     message.attachments.some(att => 
                       att.contentType && att.contentType.startsWith('image/')
                     );
    
    if (!hasImage) return;
    
    // Agregar botón para registrar resultados manualmente
    const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = await import('discord.js');
    
    const submitButton = new ButtonBuilder()
      .setCustomId(`submit_result_${message.id}`)
      .setLabel('📊 Registrar Resultado')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(submitButton);

    await message.reply({
      content: '📸 Imagen de resultados detectada!\n\nHaz clic en el botón para registrar los resultados manualmente:',
      components: [row]
    });

  } catch (error) {
    console.error('Error procesando imagen de resultados:', error);
  }
});

// ===================== MANEJO DE ERRORES =====================

process.on('unhandledRejection', error => {
  console.error('❌ Promise rechazada sin manejar:', error);
});

process.on('uncaughtException', error => {
  console.error('❌ Excepción no capturada:', error);
  process.exit(1);
});

// ===================== INICIAR EL BOT =====================
client.login(process.env.BOT_TOKEN);
