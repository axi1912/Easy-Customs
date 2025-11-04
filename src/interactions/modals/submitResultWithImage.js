import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';
import { googleSheetsService } from '../../services/google/sheets.js';
import { analyzeWarzoneResults } from '../../services/ai/imageAnalyzer.js';

export async function handleSubmitResultWithImage(interaction) {
    try {
        await interaction.deferReply({ ephemeral: false });

        const teamChannel = interaction.channel;
        const teamName = teamChannel.name.replace('team-', '').replace(/-/g, ' ').trim();

        const imageUrls = [...interaction.message.attachments.values()].map(att => att.url);

        if (imageUrls.length === 0) {
            await interaction.editReply({
                content: 'No se encontraron imagenes adjuntas. Por favor, asegurate de adjuntar las capturas de pantalla.',
                ephemeral: true
            });
            return;
        }

        const analyzing = await interaction.editReply({
            content: `IA analizando ${imageUrls.length} imagen(es)...\n\nEsto puede tomar unos segundos...`
        });

        const analysis = await analyzeWarzoneResults(imageUrls);

        if (!analysis.success) {
            await interaction.editReply({
                content: `Error al analizar las imagenes: ${analysis.error}\n\nPor favor, verifica que las capturas sean claras y contengan:\n- Pantalla de posicion final (#1, #2, etc.)\n- Pantalla de estadisticas con kills de cada jugador`,
                ephemeral: true
            });
            return;
        }

        const { position, totalKills, players, confidence } = analysis.data;

        const scoreTable = {
            1: 20, 2: 18, 3: 16, 4: 14, 5: 12,
            6: 10, 7: 8, 8: 6, 9: 4, 10: 2
        };
        const positionScore = scoreTable[position] || 0;
        const killsScore = totalKills * 1;
        const finalScore = positionScore + killsScore;

        const resultEmbed = new EmbedBuilder()
            .setColor(confidence === 'high' ? '#00FF00' : confidence === 'medium' ? '#FFA500' : '#FF0000')
            .setTitle(`Resultado - ${teamName.toUpperCase()}`)
            .setDescription(`Resultado analizado automaticamente por IA`)
            .addFields(
                { 
                    name: 'Posicion Final', 
                    value: `#${position}`, 
                    inline: true 
                },
                { 
                    name: 'Total Kills', 
                    value: `${totalKills} kills`, 
                    inline: true 
                },
                { 
                    name: 'Confianza IA', 
                    value: confidence === 'high' ? 'Alta' : confidence === 'medium' ? 'Media' : 'Baja', 
                    inline: true 
                },
                {
                    name: '\u200B',
                    value: '**Calculo de Puntuacion**'
                },
                { 
                    name: 'Puntos por Posicion', 
                    value: `+${positionScore} pts`, 
                    inline: true 
                },
                { 
                    name: 'Puntos por Kills', 
                    value: `+${killsScore} pts (${totalKills} x 1)`, 
                    inline: true 
                },
                { 
                    name: 'Puntuacion Final', 
                    value: `**${finalScore} puntos**`, 
                    inline: true 
                }
            )
            .setTimestamp()
            .setFooter({ text: `Enviado por ${interaction.user.tag}` });

        if (players && players.length > 0) {
            const killsBreakdown = players
                .sort((a, b) => b.kills - a.kills)
                .map((p, i) => `${i + 1}. **${p.name}**: ${p.kills} kills`)
                .join('\n');
            
            resultEmbed.addFields({
                name: 'Kills Individuales',
                value: killsBreakdown || 'No disponible'
            });
        }

        if (confidence === 'medium' || confidence === 'low') {
            resultEmbed.addFields({
                name: 'Nota',
                value: 'La IA tiene cierta incertidumbre sobre estos datos. Por favor, verifica manualmente las imagenes.'
            });
        }

        if (imageUrls.length > 0) {
            resultEmbed.setImage(imageUrls[0]);
            if (imageUrls.length > 1) {
                resultEmbed.setThumbnail(imageUrls[1]);
            }
        }

        const confirmButton = new ButtonBuilder()
            .setCustomId(`confirm_result_${Date.now()}`)
            .setLabel('Confirmar y Guardar')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId(`cancel_result_${Date.now()}`)
            .setLabel('Cancelar')
            .setStyle(ButtonStyle.Danger);

        const editButton = new ButtonBuilder()
            .setCustomId(`edit_result_${Date.now()}`)
            .setLabel('Editar Manualmente')
            .setStyle(ButtonStyle.Secondary);

        const actionRow = new ActionRowBuilder().addComponents(confirmButton, editButton, cancelButton);

        const confirmMessage = await interaction.editReply({
            content: null,
            embeds: [resultEmbed],
            components: [actionRow]
        });

        const collector = confirmMessage.createMessageComponentCollector({
            time: 300000
        });

        collector.on('collect', async (btnInteraction) => {
            if (btnInteraction.user.id !== interaction.user.id) {
                await btnInteraction.reply({
                    content: 'Solo quien envio el resultado puede confirmar o cancelar.',
                    ephemeral: true
                });
                return;
            }

            if (btnInteraction.customId.startsWith('confirm_result')) {
                await btnInteraction.deferUpdate();

                const resultData = {
                    teamName: teamName,
                    position: position,
                    totalKills: totalKills,
                    multiplier: 1.0,
                    finalScore: finalScore,
                    submittedBy: interaction.user.tag,
                    userId: interaction.user.id,
                    players: players
                };

                const success = await googleSheetsService.submitResult(resultData, 'current');

                if (success) {
                    resultEmbed.setColor('#00FF00');
                    resultEmbed.setDescription('Resultado confirmado y guardado en Google Sheets');

                    await confirmMessage.edit({
                        embeds: [resultEmbed],
                        components: []
                    });

                    await btnInteraction.followUp({
                        content: `Resultado guardado exitosamente!\n\nEl resultado ha sido registrado en Google Sheets y el leaderboard se ha actualizado automaticamente.`,
                        ephemeral: true
                    });
                } else {
                    await btnInteraction.followUp({
                        content: 'Error al guardar en Google Sheets. Por favor, contacta a un administrador.',
                        ephemeral: true
                    });
                }

                collector.stop();
            } else if (btnInteraction.customId.startsWith('edit_result')) {
                await btnInteraction.reply({
                    content: 'Edicion manual no implementada aun.\n\nPuedes:\n1. Cancelar y volver a enviar las imagenes\n2. Confirmar y luego un admin puede editar en Google Sheets',
                    ephemeral: true
                });
            } else if (btnInteraction.customId.startsWith('cancel_result')) {
                await btnInteraction.deferUpdate();

                await confirmMessage.edit({
                    content: 'Resultado cancelado. Puedes enviar nuevas imagenes cuando estes listo.',
                    embeds: [],
                    components: []
                });

                collector.stop();
            }
        });

        collector.on('end', () => {
            confirmMessage.edit({ components: [] }).catch(() => {});
        });

    } catch (error) {
        console.error('Error en handleSubmitResultWithImage:', error);
        await interaction.editReply({
            content: 'Ocurrio un error al procesar el resultado. Por favor, intenta nuevamente.',
            ephemeral: true
        }).catch(() => {});
    }
}