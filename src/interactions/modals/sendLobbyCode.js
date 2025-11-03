// Handler para enviar código de lobby a todos los equipos

import { tournamentManager } from '../../services/tournament/manager.js';
import { EmbedBuilder as DiscordEmbed } from 'discord.js';
import { TOURNAMENT_COLORS } from '../../utils/constants.js';

export async function handleSendLobbyCode(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!tournamentManager.hasActiveTournament()) {
      return await interaction.editReply({
        content: '❌ No hay torneo activo'
      });
    }

    const tournament = tournamentManager.getActiveTournament();
    const matchNumber = interaction.fields.getTextInputValue('match_number');
    const lobbyCode = interaction.fields.getTextInputValue('lobby_code');

    // Crear embed del código de lobby
    const lobbyEmbed = new DiscordEmbed()
      .setTitle('🎮 CÓDIGO DE LOBBY')
      .setDescription(`**Match #${matchNumber}**`)
      .addFields(
        { 
          name: '📋 Código de Lobby', 
          value: `\`\`\`${lobbyCode}\`\`\``, 
          inline: false 
        },
        {
          name: '📌 Instrucciones',
          value: '• Copia el código de arriba\n• Únete a la lobby de Warzone\n• Ingresa el código\n• Espera a que comience la partida',
          inline: false
        }
      )
      .setColor(TOURNAMENT_COLORS.success)
      .setTimestamp()
      .setFooter({ text: `Torneo: ${tournament.name}` });

    // Obtener canal de lobby alert
    console.log(`🔍 Buscando canal lobby-alert...`);
    
    let lobbyAlertChannel = null;
    
    // Buscar canal que contenga "lobbyalert" o "lobby-alert" en el nombre
    lobbyAlertChannel = interaction.guild.channels.cache.find(
      ch => ch.type === 0 && (
        ch.name.toLowerCase().includes('lobbyalert') || 
        ch.name.toLowerCase().includes('lobby-alert')
      )
    );
    
    if (lobbyAlertChannel) {
      console.log(`✅ Canal lobby-alert encontrado: ${lobbyAlertChannel.name} (ID: ${lobbyAlertChannel.id})`);
    } else {
      console.log(`❌ No se encontró canal lobby-alert`);
    }
    
    // Enviar a canal de lobby alert
    let lobbyAlertSent = false;
    if (lobbyAlertChannel) {
      try {
        await lobbyAlertChannel.send({
          content: '@everyone',
          embeds: [lobbyEmbed]
        });
        lobbyAlertSent = true;
        console.log(`✅ Código enviado a lobby-alert: ${lobbyAlertChannel.name}`);
      } catch (error) {
        console.error('❌ Error enviando a lobby-alert:', error.message);
      }
    }

    // Enviar a todos los canales de equipos
    const teams = tournament.availableTeams || [];
    let sentCount = 0;
    let failedCount = 0;

    console.log(`📊 Total de equipos registrados: ${teams.length}`);

    for (const team of teams) {
      console.log(`\n🔍 Procesando equipo: ${team.name}`);
      
      let teamChannel = null;
      
      // Buscar canal de texto del equipo usando team.channels.text
      if (team.channels && team.channels.text) {
        teamChannel = interaction.guild.channels.cache.get(team.channels.text);
        console.log(`  Búsqueda por team.channels.text (${team.channels.text}): ${teamChannel ? `✅ ${teamChannel.name}` : '❌ No encontrado'}`);
      }
      
      // Si no se encuentra, buscar por nombre del equipo
      if (!teamChannel) {
        const teamNameClean = team.name.replace(/\s+/g, '').toLowerCase();
        teamChannel = interaction.guild.channels.cache.find(
          ch => ch.type === 0 && (
            ch.name.toLowerCase().includes(teamNameClean) ||
            ch.name.toLowerCase().replace(/\s+/g, '').includes(teamNameClean)
          )
        );
        console.log(`  Búsqueda por nombre (${teamNameClean}): ${teamChannel ? `✅ ${teamChannel.name}` : '❌ No encontrado'}`);
      }
      
      if (teamChannel) {
        try {
          await teamChannel.send({
            content: team.roleId ? `📢 <@&${team.roleId}>` : '', // Mencionar el rol del equipo si existe
            embeds: [lobbyEmbed]
          });
          sentCount++;
          console.log(`  ✅ Mensaje enviado a ${teamChannel.name}`);
          // Pequeño delay para evitar rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`  ❌ Error enviando mensaje:`, error.message);
          failedCount++;
        }
      } else {
        console.error(`  ❌ No se encontró canal para ${team.name}`);
        failedCount++;
      }
    }

    // Respuesta al administrador
    await interaction.editReply({
      content: `✅ **Código de Lobby Enviado**\n\n` +
        `📊 **Match:** #${matchNumber}\n` +
        `🔑 **Código:** \`${lobbyCode}\`\n\n` +
        `📤 **Enviado a:**\n` +
        `• Canal lobby-alert: ${lobbyAlertSent ? '✅' : '❌'}\n` +
        `• ${sentCount}/${teams.length} canales de equipos\n` +
        (failedCount > 0 ? `⚠️ ${failedCount} equipos no recibieron el mensaje` : '')
    });

    // Actualizar panel
    const { updatePanelAutomatically } = await import('../commands/panel.js');
    await updatePanelAutomatically(interaction.guild);

  } catch (error) {
    console.error('Error enviando código de lobby:', error);
    
    const errorMsg = interaction.deferred || interaction.replied 
      ? 'editReply' 
      : 'reply';
      
    await interaction[errorMsg]({ 
      content: '❌ Error al enviar el código de lobby', 
      ephemeral: true 
    }).catch(() => {});
  }
}
