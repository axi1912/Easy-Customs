// Handler para el modal de registro manual de resultados

import { EmbedBuilder } from 'discord.js';
import { googleSheetsService } from '../../services/google/sheets.js';

export async function handleSubmitResultManual(interaction) {
    try {
        await interaction.deferReply({ ephemeral: false });

        const teamChannel = interaction.channel;
        const teamName = interaction.fields.getTextInputValue('team_name');
        const position = parseInt(interaction.fields.getTextInputValue('position'));
        const totalKills = parseInt(interaction.fields.getTextInputValue('kills'));
        const notes = interaction.fields.getTextInputValue('notes') || '';

        // Validar posición
        if (isNaN(position) || position < 1 || position > 15) {
            await interaction.editReply({
                content: '❌ La posición debe ser un número entre 1 y 15.',
                ephemeral: true
            });
            return;
        }

        // Validar kills
        if (isNaN(totalKills) || totalKills < 0) {
            await interaction.editReply({
                content: '❌ Los kills deben ser un número válido (0 o mayor).',
                ephemeral: true
            });
            return;
        }

        // Calcular puntuación
        const scoreTable = {
            1: 20, 2: 18, 3: 16, 4: 14, 5: 12,
            6: 10, 7: 8, 8: 6, 9: 4, 10: 2
        };
        const positionScore = scoreTable[position] || 0;
        const killsScore = totalKills * 1;
        const finalScore = positionScore + killsScore;

        // Crear embed de resultados
        const resultEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle(`Resultado - ${teamName.toUpperCase()}`)
            .setDescription('Resultado registrado manualmente')
            .addFields(
                { 
                    name: 'Posición Final', 
                    value: `#${position}`, 
                    inline: true 
                },
                { 
                    name: 'Total Kills', 
                    value: `${totalKills} kills`, 
                    inline: true 
                }
            )
            .setTimestamp()
            .setFooter({ text: `Enviado por ${interaction.user.tag}` });

        if (notes) {
            resultEmbed.addFields({
                name: 'Notas',
                value: notes
            });
        }

        // Guardar en Google Sheets
        const resultData = {
            teamName: teamName,
            position: position,
            totalKills: totalKills,
            multiplier: 1.0,
            finalScore: finalScore,
            submittedBy: interaction.user.tag,
            userId: interaction.user.id,
            notes: notes
        };

        const success = await googleSheetsService.submitResult(resultData, 'current');

        if (success) {
            resultEmbed.setDescription('✅ Resultado guardado exitosamente en Google Sheets');

            await interaction.editReply({
                embeds: [resultEmbed]
            });

            await interaction.followUp({
                content: `✅ **Resultado guardado!**\n\nEl resultado ha sido registrado en Google Sheets y el leaderboard se ha actualizado automáticamente.`,
                ephemeral: true
            });
        } else {
            await interaction.editReply({
                content: '❌ Error al guardar en Google Sheets. Por favor, contacta a un administrador.',
                ephemeral: true
            });
        }

    } catch (error) {
        console.error('Error en handleSubmitResultManual:', error);
        await interaction.editReply({
            content: '❌ Ocurrió un error al procesar el resultado. Por favor, intenta nuevamente.',
            ephemeral: true
        }).catch(() => {});
    }
}
