import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';
import { googleSheetsService } from '../../services/google/sheets.js';
import { analyzeWarzoneResults } from '../../services/ai/imageAnalyzer.js';

/**
 * Handler para el modal de envÃo de resultados con imÃ¡genes
 * Ahora con anÃ¡lisis automÃ¡tico de IA
 */
export async function handleSubmitResultWithImage(interaction) {
    try {
        await interaction.deferReply({ ephemeral: false });

        // Obtener informaciÃn del equipo
        const teamChannel = interaction.channel;
        const teamName = teamChannel.name.replace('team-', '').replace(/-/g, ' ').trim();

        // Obtener los adjuntos (imÃ¡genes)
        const imageUrls = [...interaction.message.attachments.values()].map(att => att.url);

        if (imageUrls.length === 0) {
            await interaction.editReply({
                content: 'â No se encontraron imÃ¡genes adjuntas. Por favor, asegÃºrate de adjuntar las capturas de pantalla.',
                ephemeral: true
            });
            return;
        }

        // Indicar que la IA estÃ¡ analizando
        const analyzing = await interaction.editReply({
            content: ðŸ **IA analizando  imagen(es)...**\n\nEsto puede tomar unos segundos...
        });

        // Analizar con IA
        const analysis = await analyzeWarzoneResults(imageUrls);

        if (!analysis.success) {
            await interaction.editReply({
                content: âŒ **Error al analizar las imÃ¡genes:**\n\n\nPor favor, verifica que las capturas sean claras y contengan:\n- Pantalla de posiciÃn final (#1, #2, etc.)\n- Pantalla de estadÃsticas con kills de cada jugador,
                ephemeral: true
            });
            return;
        }

        const { position, totalKills, players, confidence } = analysis.data;

        // Calcular puntuaciÃn segÃºn la posiciÃn
        const scoreTable = {
            1: 20, 2: 18, 3: 16, 4: 14, 5: 12,
            6: 10, 7: 8, 8: 6, 9: 4, 10: 2
        };
        const positionScore = scoreTable[position] || 0;
        const killsScore = totalKills * 1; // 1 punto por kill
        const finalScore = positionScore + killsScore;

        // Crear embed detallado con resultados analizados
        const resultEmbed = new EmbedBuilder()
            .setColor(confidence === 'high' ? '#00FF00' : confidence === 'medium' ? '#FFA500' : '#FF0000')
            .setTitle(ðŸ Resultado - )
            .setDescription(**Resultado analizado automÃ¡ticamente por IA **)
            .addFields(
                { 
                    name: 'ðŸ PosiciÃn Final', 
                    value: **#** , 
                    inline: true 
                },
                { 
                    name: 'ðŸ' Total Kills', 
                    value: **** kills, 
                    inline: true 
                },
                { 
                    name: 'ðŸ' Confianza IA', 
                    value: confidence === 'high' ? 'Alta âœ' : confidence === 'medium' ? 'Media âš' : 'Baja â', 
                    inline: true 
                },
                {
                    name: '\u200B',
                    value: '**ðŸ"Š CÃ¡lculo de PuntuaciÃn**'
                },
                { 
                    name: 'Puntos por PosiciÃn', 
                    value: + pts, 
                    inline: true 
                },
                { 
                    name: 'Puntos por Kills', 
                    value: + pts (  1), 
                    inline: true 
                },
                { 
                    name: 'ðŸ PuntuaciÃn Final', 
                    value: ** puntos**, 
                    inline: true 
                }
            )
            .setTimestamp()
            .setFooter({ text: Enviado por  });

        // Agregar kills individuales si estÃ¡n disponibles
        if (players && players.length > 0) {
            const killsBreakdown = players
                .sort((a, b) => b.kills - a.kills) // Ordenar por kills descendente
                .map((p, i) => ${i + 1}. ****:  kills)
                .join('\n');
            
            resultEmbed.addFields({
                name: 'ðŸ" Kills Individuales',
                value: killsBreakdown || 'No disponible'
            });
        }

        // Agregar nota sobre la confianza
        if (confidence === 'medium' || confidence === 'low') {
            resultEmbed.addFields({
                name: 'âš Nota',
                value: 'La IA tiene cierta incertidumbre sobre estos datos. Por favor, verifica manualmente las imÃ¡genes.'
            });
        }

        // Adjuntar las imÃ¡genes
        if (imageUrls.length > 0) {
            resultEmbed.setImage(imageUrls[0]);
            if (imageUrls.length > 1) {
                resultEmbed.setThumbnail(imageUrls[1]);
            }
        }

        // Botones de confirmaciÃn
        const confirmButton = new ButtonBuilder()
            .setCustomId(confirm_result_)
            .setLabel('âœ Confirmar y Guardar')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId(cancel_result_)
            .setLabel('âŒ Cancelar')
            .setStyle(ButtonStyle.Danger);

        const editButton = new ButtonBuilder()
            .setCustomId(edit_result_)
            .setLabel('âœï Editar Manualmente')
            .setStyle(ButtonStyle.Secondary);

        const actionRow = new ActionRowBuilder().addComponents(confirmButton, editButton, cancelButton);

        // Enviar mensaje con botones de confirmaciÃn
        const confirmMessage = await interaction.editReply({
            content: null,
            embeds: [resultEmbed],
            components: [actionRow]
        });

        // Collector para los botones
        const collector = confirmMessage.createMessageComponentCollector({
            time: 300000 // 5 minutos
        });

        collector.on('collect', async (btnInteraction) => {
            if (btnInteraction.user.id !== interaction.user.id) {
                await btnInteraction.reply({
                    content: 'â Solo quien enviÃ el resultado puede confirmar o cancelar.',
                    ephemeral: true
                });
                return;
            }

            if (btnInteraction.customId.startsWith('confirm_result')) {
                await btnInteraction.deferUpdate();

                // Guardar en Google Sheets
                const resultData = {
                    teamName: teamName,
                    position: position,
                    totalKills: totalKills,
                    multiplier: 1.0,
                    finalScore: finalScore,
                    submittedBy: interaction.user.tag,
                    userId: interaction.user.id,
                    players: players // Incluir kills individuales
                };

                const success = await googleSheetsService.submitResult(resultData, 'current');

                if (success) {
                    // Actualizar embed para mostrar confirmaciÃn
                    resultEmbed.setColor('#00FF00');
                    resultEmbed.setDescription('**âœ Resultado confirmado y guardado en Google Sheets**');

                    await confirmMessage.edit({
                        embeds: [resultEmbed],
                        components: [] // Remover botones
                    });

                    await btnInteraction.followUp({
                        content: âœ **Resultado guardado exitosamente!**\n\nEl resultado ha sido registrado en Google Sheets y el leaderboard se ha actualizado automÃ¡ticamente.,
                        ephemeral: true
                    });
                } else {
                    await btnInteraction.followUp({
                        content: 'âŒ Error al guardar en Google Sheets. Por favor, contacta a un administrador.',
                        ephemeral: true
                    });
                }

                collector.stop();
            } else if (btnInteraction.customId.startsWith('edit_result')) {
                await btnInteraction.reply({
                    content: 'âœï **EdiciÃn manual no implementada aÃºn.**\n\nPuedes:\n1. Cancelar y volver a enviar las imÃ¡genes\n2. Confirmar y luego un admin puede editar en Google Sheets',
                    ephemeral: true
                });
            } else if (btnInteraction.customId.startsWith('cancel_result')) {
                await btnInteraction.deferUpdate();

                await confirmMessage.edit({
                    content: 'âŒ Resultado cancelado. Puedes enviar nuevas imÃ¡genes cuando estÃs listo.',
                    embeds: [],
                    components: []
                });

                collector.stop();
            }
        });

        collector.on('end', () => {
            // Desactivar botones despuÃs de 5 minutos
            confirmMessage.edit({ components: [] }).catch(() => {});
        });

    } catch (error) {
        console.error('Error en handleSubmitResultWithImage:', error);
        await interaction.editReply({
            content: 'âŒ Ocurrir un error al procesar el resultado. Por favor, intenta nuevamente.',
            ephemeral: true
        }).catch(() => {});
    }
}
