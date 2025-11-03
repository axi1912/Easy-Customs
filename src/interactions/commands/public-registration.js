// Handler para el panel público de registro de usuarios

import { 
  EmbedBuilder as DiscordEmbed, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder
} from 'discord.js';
import { tournamentManager } from '../../services/tournament/manager.js';
import { googleSheetsService } from '../../services/google/sheets.js';
import { ERROR_MESSAGES, TOURNAMENT_COLORS } from '../../utils/constants.js';

// Función para crear el contenido del panel (sin interacción)
export async function createPublicRegistrationPanelContent() {
  try {
    if (!tournamentManager.hasActiveTournament()) {
      return null;
    }

    const tournament = tournamentManager.getActiveTournament();
    const availableTeams = tournament.availableTeams || [];

    if (availableTeams.length === 0) {
      return null;
    }

    // Crear embed principal
    const embed = new DiscordEmbed()
      .setTitle(`🏆 ${tournament.name}`)
      .setDescription(
        `**¡Únete a tu equipo favorito!**\n\n` +
        `🎯 **Formato:** ${tournament.format}\n` +
        `👤 **Jugadores por equipo:** ${tournament.teamSize}\n` +
        `📈 **Equipos disponibles:** ${availableTeams.length}\n` +
        `🔒 **Estado:** ${tournament.isRegistrationOpen() ? '🟢 Abierto' : '🔴 Cerrado'}`
      )
      .setColor(tournament.isRegistrationOpen() ? TOURNAMENT_COLORS.success : TOURNAMENT_COLORS.warning)
      .setFooter({ 
        text: `Sistema de Puntuación: Kills + Multiplicador (1°=x1.6, 2°-5°=x1.4, 6°-10°=x1.2, 11°-15°=x1.0)` 
      })
      .setTimestamp();

    const components = [];

    if (tournament.isRegistrationOpen() && availableTeams.length > 0) {
      // Crear opciones para el select menu
      const teamOptions = availableTeams.map(team => ({
        label: team.name,
        value: team.id,
        description: `${team.tag ? `[${team.tag}] ` : ''}${team.members.length}/${tournament.teamSize} jugadores`,
        emoji: team.members.length >= tournament.teamSize ? '🔒' : '🟢'
      }));

      // Limitar a 25 opciones (límite de Discord)
      const selectOptions = teamOptions.slice(0, 25);

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_team_to_join')
        .setPlaceholder('🔽 Selecciona tu equipo...')
        .addOptions(selectOptions);

      components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    // Botón para ver equipos registrados
    const infoRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('view_registered_teams')
          .setLabel('👥 Ver Equipos')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('my_team_info')
          .setLabel('📋 Mi Equipo')
          .setStyle(ButtonStyle.Primary)
      );

    components.push(infoRow);

    return { embeds: [embed], components };

  } catch (error) {
    console.error('Error creando contenido del panel de registro público:', error);
    return null;
  }
}

export async function createPublicRegistrationPanel(interaction) {
  try {
    const panelContent = await createPublicRegistrationPanelContent();
    
    if (!panelContent) {
      return await interaction.reply({
        content: ERROR_MESSAGES.NO_ACTIVE_TOURNAMENT,
        ephemeral: true
      });
    }

    return await interaction.reply(panelContent);

  } catch (error) {
    console.error('Error creando panel de registro público:', error);
    throw error;
  }
}

export async function handleSelectTeamToJoin(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!tournamentManager.hasActiveTournament()) {
      return await interaction.editReply({
        content: ERROR_MESSAGES.NO_ACTIVE_TOURNAMENT
      });
    }

    const tournament = tournamentManager.getActiveTournament();
    
    if (!tournament.isRegistrationOpen()) {
      return await interaction.editReply({
        content: ERROR_MESSAGES.REGISTRATION_CLOSED
      });
    }

    const teamId = interaction.values[0];
    const selectedTeam = tournament.availableTeams?.find(team => team.id === teamId);

    if (!selectedTeam) {
      return await interaction.editReply({
        content: '❌ Equipo no encontrado.'
      });
    }

    // Verificar si el usuario ya está registrado
    if (tournamentManager.isUserRegistered(interaction.user.id)) {
      const userCurrentTeam = tournament.availableTeams.find(team => 
        team.members.some(member => member.userId === interaction.user.id)
      );
      
      if (userCurrentTeam) {
        return await interaction.editReply({
          content: `❌ Ya estás registrado en el equipo **${userCurrentTeam.name}**.`
        });
      }
    }

    // Verificar si el equipo está lleno
    if (selectedTeam.members.length >= tournament.teamSize) {
      return await interaction.editReply({
        content: `❌ El equipo **${selectedTeam.name}** ya está completo (${selectedTeam.members.length}/${tournament.teamSize}).`
      });
    }

    // Agregar usuario al equipo
    const newMember = {
      userId: interaction.user.id,
      username: interaction.user.username,
      displayName: interaction.member.displayName,
      joinedAt: new Date().toISOString()
    };

    selectedTeam.members.push(newMember);

    // Actualizar en Google Sheets
    try {
      const teamMembers = selectedTeam.members.map(m => m.displayName);
      const captain = selectedTeam.members[0]?.displayName || 'Pendiente';
      
      await googleSheetsService.updateTeamMembers(
        selectedTeam.name,
        teamMembers,
        captain,
        tournament.id
      );
      console.log(`📊 Equipo ${selectedTeam.name} actualizado en Google Sheets`);
    } catch (sheetsError) {
      console.error('Error actualizando Google Sheets:', sheetsError);
      // No fallar si Google Sheets falla
    }

    // Si es el primer miembro, crear rol y canales
    if (selectedTeam.members.length === 1) {
      await createTeamInfrastructure(interaction, selectedTeam);
    }

    // Asignar rol al usuario
    if (selectedTeam.roleId) {
      try {
        const role = interaction.guild.roles.cache.get(selectedTeam.roleId);
        if (role) {
          await interaction.member.roles.add(role);
        }
      } catch (error) {
        console.error('Error asignando rol:', error);
      }
    }

    const embed = new DiscordEmbed()
      .setTitle('✅ ¡Te has unido al equipo!')
      .setDescription(
        `Te has registrado exitosamente en el equipo **${selectedTeam.name}** ${selectedTeam.tag ? `[${selectedTeam.tag}]` : ''}.\n\n` +
        `👥 **Miembros actuales:** ${selectedTeam.members.length}/${tournament.teamSize}\n` +
        `📋 **Jugadores:**\n${selectedTeam.members.map(m => `• ${m.displayName}`).join('\n')}\n\n` +
        `${selectedTeam.channels ? `📢 **Canal del equipo:** <#${selectedTeam.channels.text}>` : '🔄 Creando canales del equipo...'}`
      )
      .setColor(TOURNAMENT_COLORS.success)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error al unirse al equipo:', error);
    
    const errorMessage = error.message.startsWith('❌') ? 
      error.message : 
      '❌ Error al unirse al equipo';
      
    await interaction.editReply({ content: errorMessage });
  }
}

async function createTeamInfrastructure(interaction, team) {
  try {
    const { RoleService } = await import('../../services/discord/roles.js');
    const { ChannelType, PermissionFlagsBits } = await import('discord.js');
    
    // Crear rol del equipo
    const role = await RoleService.createTeamRole(interaction.guild, team.name, team.tag);
    team.roleId = role.id;
    
    // Crear categoría para el equipo
    const categoryName = team.tag ? `${team.name} [${team.tag}]` : team.name;
    const teamCategory = await interaction.guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: interaction.guild.id, // @everyone
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: role.id, // Rol del equipo
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak
          ]
        },
        {
          id: interaction.client.user.id, // Bot
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageChannels
          ]
        }
      ]
    });
    
    console.log(`✅ Categoría creada para equipo ${team.name}: ${teamCategory.id}`);
    
    // Preparar nombre limpio del equipo (sin espacios)
    let cleanTeamName = team.name.replace(/\s+/g, '');
    
    // Si el nombre ya empieza con "TEAM", no agregarlo de nuevo
    const teamPrefix = cleanTeamName.toUpperCase().startsWith('TEAM') ? '' : 'TEAM';
    
    // Crear canal de texto del equipo: TEAMNombreEquipo-CHAT
    const textChannel = await interaction.guild.channels.create({
      name: `${teamPrefix}${cleanTeamName}-CHAT`,
      type: ChannelType.GuildText,
      parent: teamCategory.id,
      permissionOverwrites: [
        {
          id: interaction.guild.id, // @everyone
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: role.id, // Rol del equipo
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        },
        {
          id: interaction.client.user.id, // Bot
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        }
      ]
    });
    
    // Crear canal de voz del equipo: teamnombreequipo-VC (todo en minúsculas excepto VC)
    // Si el nombre ya tiene "team", no agregarlo de nuevo
    const voicePrefix = cleanTeamName.toLowerCase().startsWith('team') ? '' : 'team';
    
    const voiceChannel = await interaction.guild.channels.create({
      name: `${voicePrefix}${cleanTeamName.toLowerCase()}-VC`,
      type: ChannelType.GuildVoice,
      parent: teamCategory.id,
      permissionOverwrites: [
        {
          id: interaction.guild.id, // @everyone
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: role.id, // Rol del equipo
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.UseVAD
          ]
        }
      ]
    });
    
    // Guardar IDs de canales y categoría
    team.channels = {
      category: teamCategory.id,
      text: textChannel.id,
      voice: voiceChannel.id
    };
    
    // Enviar mensaje de bienvenida al canal del equipo
    const welcomeEmbed = new (await import('discord.js')).EmbedBuilder()
      .setTitle(`🏆 ¡Bienvenidos al equipo ${team.name}!`)
      .setDescription(
        `${team.tag ? `**[${team.tag}]** ` : ''}¡Este es vuestro espacio privado del equipo!\n\n` +
        `📋 **Miembros del equipo:**\n${team.members.map(m => `• ${m.displayName}`).join('\n')}\n\n` +
        `💬 **Chat:** ${textChannel}\n` +
        `🎙️ **Voz:** ${voiceChannel}\n\n` +
        `¡Buena suerte en el torneo!`
      )
      .setColor(TOURNAMENT_COLORS.success)
      .setTimestamp();
      
    await textChannel.send({ embeds: [welcomeEmbed] });
    
    console.log(`✅ Infraestructura completa creada para equipo ${team.name}:`);
    console.log(`   - Categoría: ${teamCategory.id} (${categoryName})`);
    console.log(`   - Rol: ${role.id}`);
    console.log(`   - Canal texto: ${textChannel.id}`);
    console.log(`   - Canal voz: ${voiceChannel.id}`);
    
  } catch (error) {
    console.error('Error creando infraestructura del equipo:', error);
    // No lanzar error para no interrumpir el registro
  }
}