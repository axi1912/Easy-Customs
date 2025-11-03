// Handler para el comando de registro de equipos por admins

import { tournamentManager } from '../../services/tournament/manager.js';
import { googleSheetsService } from '../../services/google/sheets.js';
import { EmbedBuilder as DiscordEmbedBuilder } from 'discord.js';
import { ERROR_MESSAGES, TOURNAMENT_COLORS } from '../../utils/constants.js';
import { Validator } from '../../utils/validators.js';

export async function handleAdminRegisterTeam(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!tournamentManager.hasActiveTournament()) {
      return await interaction.editReply({
        content: ERROR_MESSAGES.NO_ACTIVE_TOURNAMENT
      });
    }

    const tournament = tournamentManager.getActiveTournament();
    const teamName = interaction.options.getString('team-name');
    const teamTag = interaction.options.getString('team-tag') || '';

    // Validaciones
    Validator.validateTeamName(teamName);
    if (teamTag) Validator.validateTeamTag(teamTag);

    // Verificar si el equipo ya existe
    if (tournament.availableTeams?.some(team => team.name.toLowerCase() === teamName.toLowerCase())) {
      return await interaction.editReply({
        content: `❌ Ya existe un equipo con el nombre **${teamName}**.`
      });
    }

    // Verificar límite de equipos
    const currentTeamCount = tournament.availableTeams?.length || 0;
    if (currentTeamCount >= tournament.maxTeams) {
      return await interaction.editReply({
        content: `❌ Se ha alcanzado el límite máximo de equipos (${tournament.maxTeams}).`
      });
    }

    // Registrar equipo
    if (!tournament.availableTeams) {
      tournament.availableTeams = [];
    }

    const newTeam = {
      id: `team_${Date.now()}`,
      name: teamName,
      tag: teamTag,
      members: [], // Los miembros se asignarán cuando seleccionen el equipo
      createdBy: interaction.user.id,
      createdAt: new Date().toISOString(),
      channels: null, // Se crearán cuando el primer miembro se una
      roleId: null // Se creará cuando el primer miembro se una
    };

    tournament.availableTeams.push(newTeam);

    // Registrar en Google Sheets
    try {
      await googleSheetsService.registerTeam({
        name: teamName,
        captain: 'Pendiente', // Se asignará cuando alguien se una
        players: [],
        captainDiscord: 'Pendiente',
        userId: interaction.user.id
      }, tournament.id);
      console.log(`📊 Equipo ${teamName} registrado en Google Sheets`);
    } catch (sheetsError) {
      console.error('Error registrando en Google Sheets:', sheetsError);
      // No fallar si Google Sheets falla, continuar con el registro local
    }

    const embed = new DiscordEmbedBuilder()
      .setTitle('✅ Equipo Registrado')
      .setDescription(
        `El equipo **${teamName}** ${teamTag ? `[${teamTag}]` : ''} ha sido registrado exitosamente.\n\n` +
        `📊 **Equipos disponibles:** ${tournament.availableTeams.length}/${tournament.maxTeams}\n` +
        `👥 **Tamaño del equipo:** ${tournament.teamSize} jugadores\n\n` +
        `Los usuarios ahora pueden seleccionar este equipo desde el panel de registro.`
      )
      .setColor(TOURNAMENT_COLORS.success)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error en admin register team:', error);
    
    const errorMessage = error.message.startsWith('❌') ? 
      error.message : 
      '❌ Error al registrar el equipo';
      
    await interaction.editReply({ content: errorMessage });
  }
}