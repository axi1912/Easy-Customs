// Handler para el modal de creación de torneo

import { tournamentManager } from '../../services/tournament/manager.js';
import { ChannelService } from '../../services/discord/channels.js';
import { RoleService } from '../../services/discord/roles.js';
import { EmbedBuilder } from '../../utils/embeds.js';
import { LIMITS } from '../../utils/constants.js';

export async function handleModalCreateTournament(interaction) {
  try {
    await interaction.deferReply({ flags: 64 }); // ephemeral

    // Obtener valores del modal
    const tournamentName = interaction.fields.getTextInputValue('tournament_name');
    const maxTeams = parseInt(interaction.fields.getTextInputValue('max_teams'));
    const teamSize = parseInt(interaction.fields.getTextInputValue('team_size'));
    const format = interaction.fields.getTextInputValue('tournament_format');
    const description = interaction.fields.getTextInputValue('tournament_description') || '';

    // Validar datos
    if (isNaN(maxTeams) || maxTeams < LIMITS.MIN_TEAMS || maxTeams > LIMITS.MAX_TEAMS) {
      return await interaction.editReply({
        content: `❌ El número de equipos debe ser entre ${LIMITS.MIN_TEAMS} y ${LIMITS.MAX_TEAMS}`
      });
    }

    if (isNaN(teamSize) || teamSize < LIMITS.MIN_TEAM_SIZE || teamSize > LIMITS.MAX_TEAM_SIZE) {
      return await interaction.editReply({
        content: `❌ El tamaño de equipo debe ser entre ${LIMITS.MIN_TEAM_SIZE} y ${LIMITS.MAX_TEAM_SIZE}`
      });
    }

    // Responder inmediatamente para evitar timeout
    await interaction.editReply({
      content: '⏳ **Creando torneo...**\n\nEsto puede tardar unos segundos mientras se configuran los canales y roles.'
    });

    // Crear infraestructura en segundo plano
    try {
      const participantRole = await RoleService.createParticipantRole(
        interaction.guild,
        tournamentName
      );

      const channels = await ChannelService.createTournamentChannels(
        interaction.guild,
        null,
        participantRole.id
      );

      // Crear torneo
      const tournament = tournamentManager.createTournament({
        name: tournamentName,
        maxTeams,
        teamSize,
        format,
        game: 'warzone',
        createdBy: interaction.user.id,
        categoryId: channels.category2 || channels.category1,
        channels,
        roles: { participant: participantRole.id }
      });

      // Enviar confirmación final
      const embed = EmbedBuilder.createTournamentSetupSuccess(tournament);
      await interaction.editReply({ 
        content: `✅ **¡Torneo creado exitosamente!**\n\n` +
          `🎮 **${tournamentName}** está listo.\n` +
          `👥 **Equipos máximos:** ${maxTeams}\n` +
          `🏁 **Formato:** ${format}\n\n` +
          `💡 **Próximos pasos:**\n` +
          `1️⃣ Los admins registran equipos desde el panel de administración\n` +
          `2️⃣ Usa \`/registration-panel\` cuando estés listo para abrir inscripciones`,
        embeds: [embed] 
      });

      // Anuncio público
      if (channels.announcements) {
        await ChannelService.sendTournamentAnnouncement(
          interaction.guild.channels.cache.get(channels.announcements),
          tournament
        );
      }

    } catch (infraError) {
      console.error('Error creando infraestructura del torneo:', infraError);
      await interaction.editReply({
        content: `❌ **Error al crear el torneo**\n\n${infraError.message || 'Error desconocido'}`
      });
    }

  } catch (error) {
    console.error('Error al crear torneo desde modal:', error);
    
    const errorMessage = error.message.startsWith('❌') ? 
      error.message : 
      '❌ Error al crear el torneo. Inténtalo de nuevo.';
      
    try {
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, flags: 64 });
      }
    } catch (replyError) {
      console.error('Error enviando respuesta de error:', replyError);
    }
  }
}
