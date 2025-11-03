// Exportador de handlers de botones

import { handleTournamentRegisterButton } from './registration.js';
import { handleTournamentDashboard } from '../../interactions/commands/dashboard.js';
import { handleTournamentStart } from '../../interactions/commands/start.js';
import { handleTournamentReset } from '../../interactions/commands/reset.js';
import { handleSubmitResultImageButton } from './submitResultImage.js';
import { handlePanelSendLobbyCode } from './sendLobbyCodeButton.js';
import { 
  handlePanelCreateTournament,
  handlePanelHelp,
  handlePanelRegisterTeam
} from '../../interactions/commands/panel.js';
import { 
  handleViewRegisteredTeams,
  handleMyTeamInfo
} from './public-registration-buttons.js';

export const buttonHandlers = {
  'tournament_register_btn': handleTournamentRegisterButton,
  'tournament_dashboard_btn': handleTournamentDashboard,
  // Panel buttons
  'panel_create_tournament': handlePanelCreateTournament,
  'panel_view_dashboard': handleTournamentDashboard,
  'panel_start_tournament': handleTournamentStart,
  'panel_view_teams': handlePanelViewTeams,
  'panel_register_team': handlePanelRegisterTeam,
  'panel_reset_tournament': handleTournamentReset,
  'panel_send_lobby_code': handlePanelSendLobbyCode,
  'panel_help': handlePanelHelp,
  // Public registration panel buttons
  'view_registered_teams': handleViewRegisteredTeams,
  'my_team_info': handleMyTeamInfo,
  // Dynamic handlers
  _dynamic: {
    submit_result: handleSubmitResultImageButton
  }
};

// Handler para ver equipos
async function handlePanelViewTeams(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    const { tournamentManager } = await import('../../services/tournament/manager.js');
    const { EmbedBuilder: DiscordEmbed } = await import('discord.js');
    const { TOURNAMENT_COLORS } = await import('../../utils/constants.js');
    
    if (!tournamentManager.hasActiveTournament()) {
      return await interaction.editReply({ content: '❌ No hay torneo activo' });
    }
    
    const tournament = tournamentManager.getActiveTournament();
    const teams = tournament.availableTeams || [];
    
    const embed = new DiscordEmbed()
      .setTitle(`📋 Equipos Registrados - ${tournament.name}`)
      .setDescription(teams.length > 0 ? 
        `**${teams.length}/${tournament.maxTeams}** equipos registrados` : 
        'No hay equipos registrados aún'
      )
      .setColor(TOURNAMENT_COLORS.info)
      .setTimestamp();
    
    if (teams.length > 0) {
      const teamList = teams.map((team, index) => {
        const tag = team.tag ? `[${team.tag}]` : '';
        const memberCount = team.members ? team.members.length : 0;
        const membersList = team.members && team.members.length > 0 
          ? team.members.map(m => m.displayName).join(', ') 
          : 'Sin miembros aún';
        
        return `**${index + 1}. ${team.name}** ${tag}\n👥 Miembros (${memberCount}/${tournament.teamSize}): ${membersList}`;
      }).join('\n\n');
      
      embed.addFields({ name: '👥 Equipos', value: teamList.slice(0, 1024) });
    }
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error al ver equipos:', error);
    await interaction.editReply({ content: '❌ Error al mostrar los equipos' });
  }
}
