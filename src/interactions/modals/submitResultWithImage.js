// Handler para el modal de envío de resultados con imagen

import { tournamentManager } from '../../services/tournament/manager.js';
import { googleSheetsService } from '../../services/google/sheets.js';
import { EmbedBuilder as DiscordEmbed } from 'discord.js';
import { TOURNAMENT_COLORS } from '../../utils/constants.js';

// Sistema de multiplicadores de Warzone
const MULTIPLIERS = {
  1: 1.6,      // 1° lugar
  2: 1.4, 3: 1.4, 4: 1.4, 5: 1.4,  // 2°-5° lugar
  6: 1.2, 7: 1.2, 8: 1.2, 9: 1.2, 10: 1.2,  // 6°-10° lugar
  11: 1.0, 12: 1.0, 13: 1.0, 14: 1.0, 15: 1.0  // 11°-15° lugar
};

export async function handleSubmitResultWithImageModal(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Extraer datos del modal
    const teamName = interaction.fields.getTextInputValue('team_name');
    const position = parseInt(interaction.fields.getTextInputValue('position'));
    const kills = parseInt(interaction.fields.getTextInputValue('kills'));
    const notes = interaction.fields.getTextInputValue('notes') || 'N/A';

    // Extraer messageId del customId
    const customIdParts = interaction.customId.split('_');
    const messageId = customIdParts[customIdParts.length - 1];
    
    // Obtener la URL de la imagen del mensaje original
    let imageUrl = '';
    try {
      const originalMessage = await interaction.channel.messages.fetch(messageId);
      imageUrl = originalMessage.attachments.first()?.url || '';
    } catch (error) {
      console.error('No se pudo obtener la imagen:', error);
    }

    // Validaciones
    if (isNaN(position) || position < 1 || position > 15) {
      return await interaction.editReply({
        content: '❌ La posición debe ser un número entre 1 y 15.'
      });
    }

    if (isNaN(kills) || kills < 0) {
      return await interaction.editReply({
        content: '❌ Los kills deben ser un número válido (0 o mayor).'
      });
    }

    const tournament = tournamentManager.getActiveTournament();
    if (!tournament) {
      return await interaction.editReply({
        content: '❌ No hay un torneo activo.'
      });
    }

    // Calcular multiplicador y puntuación
    const multiplier = MULTIPLIERS[position] || 0;
    const finalScore = kills * multiplier;

    // Guardar en Google Sheets
    try {
      await googleSheetsService.submitResult({
        teamName,
        tournamentName: tournament.name,
        position,
        kills,
        multiplier,
        finalScore,
        submittedBy: interaction.user.username,
        timestamp: new Date().toISOString(),
        notes,
        imageUrl
      });
    } catch (error) {
      console.error('Error guardando en Google Sheets:', error);
    }

    // Crear embed de desglose
    const embed = new DiscordEmbed()
      .setTitle('✅ Resultados Registrados Exitosamente')
      .setDescription(`**${teamName}** - Desglose de la Partida`)
      .setColor(TOURNAMENT_COLORS.success)
      .setThumbnail(imageUrl || null)
      .addFields(
        { name: '🏆 Posición Final', value: `#${position}`, inline: true },
        { name: '💀 Total de Kills', value: `${kills} kills`, inline: true },
        { name: '✖️ Multiplicador', value: `x${multiplier}`, inline: true },
        { name: '📊 Puntuación Final', value: `**${finalScore.toFixed(1)} puntos**`, inline: false },
        { name: '📝 Notas', value: notes, inline: false }
      )
      .addFields({
        name: '🔢 Cálculo',
        value: `\`${kills} kills × ${multiplier} multiplicador = ${finalScore.toFixed(1)} puntos\``,
        inline: false
      })
      .setFooter({ text: `Registrado por ${interaction.user.username}` })
      .setTimestamp();

    if (imageUrl) {
      embed.setImage(imageUrl);
    }

    await interaction.editReply({ embeds: [embed] });

    // Anuncio COMPLETO en el canal del equipo para que admins puedan verificar
    await interaction.channel.send({ embeds: [embed] });
    const bracketsChannel = interaction.guild.channels.cache.get(tournament.channels.brackets);
    if (bracketsChannel) {
      try {
        const { updateBracketsTable } = await import('../commands/bracket.js');
        await updateBracketsTable(bracketsChannel, tournament);
      } catch (error) {
        console.error('Error actualizando tabla de posiciones:', error);
      }
    }

  } catch (error) {
    console.error('Error en submit result with image modal:', error);
    
    const errorMessage = error.message.startsWith('❌') ? 
      error.message : 
      '❌ Error al procesar los resultados';
      
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
