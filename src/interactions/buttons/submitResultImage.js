// Handler para el botón de enviar resultado manual (sin IA)

import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { tournamentManager } from '../../services/tournament/manager.js';
import { ERROR_MESSAGES } from '../../utils/constants.js';

export async function handleSubmitResultImageButton(interaction) {
  try {
    // Verificar que hay un torneo activo
    if (!tournamentManager.hasActiveTournament()) {
      return await interaction.reply({
        content: ERROR_MESSAGES.NO_ACTIVE_TOURNAMENT,
        ephemeral: true
      });
    }

    const tournament = tournamentManager.getActiveTournament();

    // Obtener el ID del mensaje de la imagen desde el customId
    const messageId = interaction.customId.replace('submit_result_', '');

    // Encontrar el equipo basado en el canal
    const channelName = interaction.channel.name;
    const team = tournamentManager.findTeamByChannelName(channelName);
    
    if (!team) {
      return await interaction.reply({
        content: `❌ No se pudo identificar el equipo. Asegúrate de estar en el canal correcto.\nCanal: ${interaction.channel.name}`,
        ephemeral: true
      });
    }

    // Crear modal para ingresar resultados manualmente
    const modal = new ModalBuilder()
      .setCustomId(`submit_result_manual_${team.name}_${messageId}`)
      .setTitle('📊 Registrar Resultados');

    // Input para nombre del equipo (pre-llenado)
    const teamNameInput = new TextInputBuilder()
      .setCustomId('team_name')
      .setLabel('Nombre del Equipo')
      .setStyle(TextInputStyle.Short)
      .setValue(team.name)
      .setRequired(true);

    // Input para posición
    const positionInput = new TextInputBuilder()
      .setCustomId('position')
      .setLabel('Posición Final (1-15)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ej: 1 (para primer lugar)')
      .setMinLength(1)
      .setMaxLength(2)
      .setRequired(true);

    // Input para kills
    const killsInput = new TextInputBuilder()
      .setCustomId('kills')
      .setLabel('Total de Kills del Equipo')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ej: 25')
      .setMinLength(1)
      .setMaxLength(3)
      .setRequired(true);

    // Input para notas adicionales (opcional)
    const notesInput = new TextInputBuilder()
      .setCustomId('notes')
      .setLabel('Notas Adicionales (Opcional)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Ej: Buena rotación, zona final complicada...')
      .setRequired(false)
      .setMaxLength(500);

    const row1 = new ActionRowBuilder().addComponents(teamNameInput);
    const row2 = new ActionRowBuilder().addComponents(positionInput);
    const row3 = new ActionRowBuilder().addComponents(killsInput);
    const row4 = new ActionRowBuilder().addComponents(notesInput);

    modal.addComponents(row1, row2, row3, row4);

    await interaction.showModal(modal);

  } catch (error) {
    console.error('Error en submit result image button:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ 
        content: '❌ Error al abrir el formulario de resultados', 
        ephemeral: true 
      });
    }
  }
}
