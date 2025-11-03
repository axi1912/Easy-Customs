// Handlers para botones del panel público de registro

import { EmbedBuilder as DiscordEmbed } from 'discord.js';
import { tournamentManager } from '../../services/tournament/manager.js';
import { ERROR_MESSAGES, TOURNAMENT_COLORS } from '../../utils/constants.js';

export async function handleViewRegisteredTeams(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!tournamentManager.hasActiveTournament()) {
      return await interaction.editReply({
        content: ERROR_MESSAGES.NO_ACTIVE_TOURNAMENT
      });
    }

    const tournament = tournamentManager.getActiveTournament();
    const availableTeams = tournament.availableTeams || [];

    if (availableTeams.length === 0) {
      return await interaction.editReply({
        content: '❌ No hay equipos registrados aún.'
      });
    }

    let description = `**📋 Lista de Equipos Registrados**\n\n`;
    
    availableTeams.forEach((team, index) => {
      const memberCount = team.members.length;
      const isFull = memberCount >= tournament.teamSize;
      const status = isFull ? '🔒 Completo' : `🟢 ${memberCount}/${tournament.teamSize}`;
      
      description += `**${index + 1}. ${team.name}** ${team.tag ? `[${team.tag}]` : ''}\n`;
      description += `　└ ${status}`;
      
      if (memberCount > 0) {
        description += ` - ${team.members.map(m => m.displayName).join(', ')}`;
      }
      
      description += '\n\n';
    });

    const embed = new DiscordEmbed()
      .setTitle(`🏆 ${tournament.name} - Equipos`)
      .setDescription(description)
      .setColor(TOURNAMENT_COLORS.info)
      .setFooter({ 
        text: `Total: ${availableTeams.length} equipos • Máximo: ${tournament.maxTeams}` 
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error mostrando equipos registrados:', error);
    await interaction.editReply({ content: ERROR_MESSAGES.GENERIC_ERROR });
  }
}

export async function handleMyTeamInfo(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!tournamentManager.hasActiveTournament()) {
      return await interaction.editReply({
        content: ERROR_MESSAGES.NO_ACTIVE_TOURNAMENT
      });
    }

    const tournament = tournamentManager.getActiveTournament();
    const availableTeams = tournament.availableTeams || [];
    
    // Buscar el equipo del usuario
    const userTeam = availableTeams.find(team => 
      team.members.some(member => member.userId === interaction.user.id)
    );

    if (!userTeam) {
      return await interaction.editReply({
        content: '❌ No estás registrado en ningún equipo. Selecciona un equipo del menú desplegable para unirte.'
      });
    }

    const membersList = userTeam.members.map((member, index) => 
      `${index + 1}. **${member.displayName}** ${member.userId === interaction.user.id ? '(tú)' : ''}`
    ).join('\n');

    const isComplete = userTeam.members.length >= tournament.teamSize;
    const statusEmoji = isComplete ? '✅' : '⏳';
    const statusText = isComplete ? 'Equipo Completo' : `Faltan ${tournament.teamSize - userTeam.members.length} jugador(es)`;

    const embed = new DiscordEmbed()
      .setTitle(`${statusEmoji} Mi Equipo: ${userTeam.name}`)
      .setDescription(
        `${userTeam.tag ? `**Tag:** [${userTeam.tag}]\n` : ''}` +
        `**Estado:** ${statusText}\n` +
        `**Miembros:** ${userTeam.members.length}/${tournament.teamSize}\n\n` +
        `**📋 Jugadores:**\n${membersList}\n\n` +
        `${userTeam.channels ? `**📢 Canal:** <#${userTeam.channels.text}>\n**🎙️ Voz:** <#${userTeam.channels.voice}>` : '🔄 Configurando canales...'}`
      )
      .setColor(isComplete ? TOURNAMENT_COLORS.success : TOURNAMENT_COLORS.warning)
      .setFooter({ 
        text: `Torneo: ${tournament.name}` 
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error mostrando información del equipo:', error);
    await interaction.editReply({ content: ERROR_MESSAGES.GENERIC_ERROR });
  }
}