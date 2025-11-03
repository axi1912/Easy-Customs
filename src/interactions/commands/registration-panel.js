// Handler para el comando de panel de registro público

import { createPublicRegistrationPanelContent } from './public-registration.js';
import { ERROR_MESSAGES } from '../../utils/constants.js';

export async function handlePublicRegistrationPanel(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    
    // Verificar permisos del bot en el canal objetivo
    const botPermissions = targetChannel.permissionsFor(interaction.client.user);
    if (!botPermissions.has(['SendMessages', 'EmbedLinks', 'UseExternalEmojis'])) {
      return await interaction.editReply({
        content: `❌ No tengo permisos para enviar mensajes con embeds en ${targetChannel}.`
      });
    }

    // Crear el contenido del panel
    const panelContent = await createPublicRegistrationPanelContent();
    
    if (!panelContent) {
      return await interaction.editReply({
        content: ERROR_MESSAGES.NO_ACTIVE_TOURNAMENT
      });
    }
    
    // Enviar el panel al canal objetivo
    await targetChannel.send(panelContent);

    await interaction.editReply({
      content: `✅ Panel de registro creado en ${targetChannel}.`
    });

  } catch (error) {
    console.error('Error creando panel de registro:', error);
    
    const errorMessage = error.message.startsWith('❌') ? 
      error.message : 
      ERROR_MESSAGES.GENERIC_ERROR;
      
    await interaction.editReply({ content: errorMessage });
  }
}