import { 
  EmbedBuilder, 
  ButtonBuilder, 
  ActionRowBuilder, 
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits
} from 'discord.js';

// Base de datos temporal para torneos (en producción usar base de datos real)
let activeTournament = null;
let registeredTeams = [];
let tournamentBracket = null;

// Colores del tema para torneos
const TOURNAMENT_COLORS = {
  primary: '#ff6b35',
  success: '#4caf50', 
  warning: '#ff9800',
  danger: '#f44336',
  info: '#2196f3'
};

// Verificar permisos de administrador
function hasAdminPermissions(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator) || 
         member.permissions.has(PermissionFlagsBits.ManageGuild);
}

// Crear estructura base del torneo
export async function handleTournamentSetup(interaction) {
  try {
    if (!hasAdminPermissions(interaction.member)) {
      return await interaction.reply({
        content: '❌ **Sin permisos:** Solo los administradores pueden configurar torneos.',
        ephemeral: true
      });
    }

    if (activeTournament) {
      return await interaction.reply({
        content: '⚠️ Ya hay un torneo activo. Usa `/tournament-dashboard` para verlo.',
        ephemeral: true
      });
    }

    const tournamentName = interaction.options.getString('name');
    const maxTeams = interaction.options.getInteger('max-teams');
    const teamSize = interaction.options.getInteger('team-size');
    const format = interaction.options.getString('format');
    const game = interaction.options.getString('game') || 'other';

    await interaction.deferReply();

    // Crear categoría principal del torneo
    const tournamentCategory = await interaction.guild.channels.create({
      name: `🏆 ${tournamentName}`,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone,
          allow: [PermissionFlagsBits.ViewChannel],
          deny: [PermissionFlagsBits.SendMessages]
        }
      ]
    });

    // Crear canales principales
    const announcementChannel = await interaction.guild.channels.create({
      name: '📢-anuncios',
      type: ChannelType.GuildText,
      parent: tournamentCategory.id,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone,
          allow: [PermissionFlagsBits.ViewChannel],
          deny: [PermissionFlagsBits.SendMessages]
        }
      ]
    });

    const registrationChannel = await interaction.guild.channels.create({
      name: '📝-registro-equipos',
      type: ChannelType.GuildText,
      parent: tournamentCategory.id
    });

    const bracketsChannel = await interaction.guild.channels.create({
      name: '🏆-brackets',
      type: ChannelType.GuildText,
      parent: tournamentCategory.id,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone,
          allow: [PermissionFlagsBits.ViewChannel],
          deny: [PermissionFlagsBits.SendMessages]
        }
      ]
    });

    // Crear rol de participante
    const participantRole = await interaction.guild.roles.create({
      name: `${tournamentName} Participant`,
      color: TOURNAMENT_COLORS.primary,
      hoist: true
    });

    // Guardar configuración del torneo
    activeTournament = {
      id: Date.now(),
      name: tournamentName,
      maxTeams,
      teamSize,
      format,
      game,
      status: 'registration',
      categoryId: tournamentCategory.id,
      channels: {
        announcements: announcementChannel.id,
        registration: registrationChannel.id,
        brackets: bracketsChannel.id
      },
      roles: {
        participant: participantRole.id
      },
      createdBy: interaction.user.id,
      createdAt: new Date()
    };

    // Reset teams
    registeredTeams = [];

    // Enviar mensaje de configuración exitosa
    const setupEmbed = new EmbedBuilder()
      .setTitle('🏆 ¡Torneo Configurado Exitosamente!')
      .setDescription(`**${tournamentName}** está listo para recibir registros.`)
      .addFields(
        { name: '👥 Equipos Máximos', value: `${maxTeams}`, inline: true },
        { name: '🎮 Jugadores por Equipo', value: `${teamSize}`, inline: true },
        { name: '🏁 Formato', value: format, inline: true },
        { name: '🎯 Juego', value: game.toUpperCase(), inline: true },
        { name: '📍 Estado', value: '🟢 Abierto para Registros', inline: true },
        { name: '📝 Registro', value: `${registrationChannel}`, inline: true }
      )
      .setColor(TOURNAMENT_COLORS.success)
      .setTimestamp()
      .setFooter({ text: 'Usa /tournament-register para unirte' });

    await interaction.editReply({ embeds: [setupEmbed] });

    // Enviar panel de registro al canal de registro
    await sendRegistrationPanel(registrationChannel);

    // Anuncio en canal de anuncios
    const announcementEmbed = new EmbedBuilder()
      .setTitle(`🚨 ¡Nuevo Torneo: ${tournamentName}!`)
      .setDescription('¡El registro está abierto! Únete con tu equipo.')
      .addFields(
        { name: '📊 Información', value: `**Equipos:** ${maxTeams}\n**Formato:** ${format}\n**Jugadores:** ${teamSize}`, inline: true },
        { name: '📝 Cómo Registrarse', value: `Ve a ${registrationChannel} y usa el menú desplegable para seleccionar tu equipo`, inline: true }
      )
      .setColor(TOURNAMENT_COLORS.primary)
      .setTimestamp();

    await announcementChannel.send({ embeds: [announcementEmbed] });

  } catch (error) {
    console.error('Error en tournament setup:', error);
    await interaction.editReply('❌ Error al configurar el torneo');
  }
}

// Enviar panel de registro
async function sendRegistrationPanel(channel) {
  const embed = new EmbedBuilder()
    .setTitle('📝 Registro de Equipos')
    .setDescription('¡Registra tu equipo para participar en el torneo!')
    .addFields(
      { name: '📊 Equipos Registrados', value: `${registeredTeams.length}/${activeTournament.maxTeams}`, inline: true },
      { name: '👥 Jugadores por Equipo', value: `${activeTournament.teamSize}`, inline: true },
      { name: '🏁 Formato', value: activeTournament.format, inline: true }
    )
    .setColor(TOURNAMENT_COLORS.info)
    .setTimestamp();

  const registerButton = new ButtonBuilder()
    .setCustomId('tournament_register_btn')
    .setLabel('🎮 Registrar Equipo')
    .setStyle(ButtonStyle.Primary);

  const dashboardButton = new ButtonBuilder()
    .setCustomId('tournament_dashboard_btn')
    .setLabel('📊 Ver Dashboard')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(registerButton, dashboardButton);

  await channel.send({ embeds: [embed], components: [row] });
}

// Handler para botón de registro
export async function handleTournamentRegisterButton(interaction) {
  try {
    if (!activeTournament) {
      return await interaction.reply({
        content: '❌ No hay torneos activos en este momento.',
        ephemeral: true
      });
    }

    if (activeTournament.status !== 'registration') {
      return await interaction.reply({
        content: '❌ El registro para este torneo está cerrado.',
        ephemeral: true
      });
    }

    if (registeredTeams.length >= activeTournament.maxTeams) {
      return await interaction.reply({
        content: '❌ El torneo está lleno. No se pueden registrar más equipos.',
        ephemeral: true
      });
    }

    // Verificar si el usuario ya está registrado
    const userTeam = registeredTeams.find(team => 
      team.members.some(member => member.id === interaction.user.id)
    );

    if (userTeam) {
      return await interaction.reply({
        content: `❌ Ya estás registrado en el equipo **${userTeam.name}**.`,
        ephemeral: true
      });
    }

    // Crear modal de registro
    const modal = new ModalBuilder()
      .setCustomId('tournament_register_modal')
      .setTitle('📝 Registrar Equipo');

    const teamNameInput = new TextInputBuilder()
      .setCustomId('team_name')
      .setLabel('Nombre del Equipo')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(2)
      .setMaxLength(32)
      .setPlaceholder('Ej: Los Invencibles');

    const teamTagInput = new TextInputBuilder()
      .setCustomId('team_tag')
      .setLabel('Tag del Equipo (Opcional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMinLength(2)
      .setMaxLength(5)
      .setPlaceholder('Ej: INV');

    const membersInput = new TextInputBuilder()
      .setCustomId('team_members')
      .setLabel(`Miembros del Equipo (${activeTournament.teamSize} jugadores)`)
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder('Ej: Juan Pérez, María López, Carlos\nNombres separados por comas');

    const rows = [
      new ActionRowBuilder().addComponents(teamNameInput),
      new ActionRowBuilder().addComponents(teamTagInput),
      new ActionRowBuilder().addComponents(membersInput)
    ];

    modal.addComponents(...rows);
    await interaction.showModal(modal);

  } catch (error) {
    console.error('Error en tournament register button:', error);
    await interaction.reply({ content: '❌ Error al abrir el formulario de registro', ephemeral: true });
  }
}

// Handler para modal de registro
export async function handleTournamentRegisterModal(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const teamName = interaction.fields.getTextInputValue('team_name');
    const teamTag = interaction.fields.getTextInputValue('team_tag') || '';
    const membersText = interaction.fields.getTextInputValue('team_members');

    // Verificar si el nombre del equipo ya existe
    const existingTeam = registeredTeams.find(team => 
      team.name.toLowerCase() === teamName.toLowerCase()
    );

    if (existingTeam) {
      return await interaction.editReply('❌ Ya existe un equipo con ese nombre.');
    }

    // Extraer menciones de usuarios
    const memberMentions = membersText.match(/<@!?(\d+)>/g) || [];
    const memberIds = memberMentions.map(mention => mention.match(/\d+/)[0]);

    if (memberIds.length !== activeTournament.teamSize) {
      return await interaction.editReply(
        `❌ Debes mencionar exactamente ${activeTournament.teamSize} jugadores.`
      );
    }

    // Verificar que todos los usuarios mencionados existen
    const members = [];
    for (const id of memberIds) {
      try {
        const member = await interaction.guild.members.fetch(id);
        members.push(member);
      } catch (error) {
        return await interaction.editReply('❌ Uno o más usuarios mencionados no son válidos.');
      }
    }

    // Verificar que ningún miembro ya esté en otro equipo
    for (const member of members) {
      const existingTeamForMember = registeredTeams.find(team => 
        team.members.some(teamMember => teamMember.id === member.id)
      );

      if (existingTeamForMember) {
        return await interaction.editReply(
          `❌ ${member.displayName} ya está registrado en el equipo **${existingTeamForMember.name}**.`
        );
      }
    }

    // Crear equipo
    const team = {
      id: Date.now(),
      name: teamName,
      tag: teamTag,
      captain: interaction.user,
      members: members.map(member => ({
        id: member.id,
        username: member.user.username,
        displayName: member.displayName
      })),
      registeredAt: new Date(),
      wins: 0,
      losses: 0
    };

    registeredTeams.push(team);

    // Asignar rol de participante a todos los miembros
    const participantRole = interaction.guild.roles.cache.get(activeTournament.roles.participant);
    if (participantRole) {
      for (const member of members) {
        try {
          await member.roles.add(participantRole);
        } catch (error) {
          console.error(`Error asignando rol a ${member.displayName}:`, error);
        }
      }
    }

    // Crear canal privado del equipo
    await createTeamChannel(interaction.guild, team);

    // Mensaje de confirmación
    const confirmEmbed = new EmbedBuilder()
      .setTitle('✅ ¡Equipo Registrado Exitosamente!')
      .setDescription(`**${teamName}** ${teamTag ? `[${teamTag}]` : ''} se ha registrado en el torneo.`)
      .addFields(
        { name: '👤 Capitán', value: interaction.user.displayName, inline: true },
        { name: '👥 Miembros', value: members.map(m => m.displayName).join('\n'), inline: true },
        { name: '📊 Estado', value: `${registeredTeams.length}/${activeTournament.maxTeams} equipos`, inline: true }
      )
      .setColor(TOURNAMENT_COLORS.success)
      .setTimestamp();

    await interaction.editReply({ embeds: [confirmEmbed] });

    // Actualizar panel de registro
    await updateRegistrationPanel(interaction.guild);

    // Anuncio público
    const announcementChannel = interaction.guild.channels.cache.get(activeTournament.channels.announcements);
    if (announcementChannel) {
      const announcementEmbed = new EmbedBuilder()
        .setTitle('🎉 ¡Nuevo Equipo Registrado!')
        .setDescription(`**${teamName}** ${teamTag ? `[${teamTag}]` : ''} se ha unido al torneo.`)
        .addFields(
          { name: '👤 Capitán', value: interaction.user.displayName, inline: true },
          { name: '📊 Progreso', value: `${registeredTeams.length}/${activeTournament.maxTeams} equipos`, inline: true }
        )
        .setColor(TOURNAMENT_COLORS.primary)
        .setTimestamp();

      await announcementChannel.send({ embeds: [announcementEmbed] });
    }

  } catch (error) {
    console.error('Error en tournament register modal:', error);
    await interaction.editReply('❌ Error al procesar el registro del equipo');
  }
}

// Crear canal privado para el equipo
async function createTeamChannel(guild, team) {
  try {
    const category = guild.channels.cache.get(activeTournament.categoryId);
    
    const teamChannel = await guild.channels.create({
      name: `🔒-${team.name.toLowerCase().replace(/\s+/g, '-')}`,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        ...team.members.map(member => ({
          id: member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        }))
      ]
    });

    // Mensaje de bienvenida en el canal del equipo
    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`🎮 Bienvenidos al canal de ${team.name}!`)
      .setDescription('Este es vuestro canal privado de equipo para coordinar estrategias.')
      .addFields(
        { name: '👤 Capitán', value: team.captain.displayName, inline: true },
        { name: '👥 Miembros', value: team.members.map(m => `<@${m.id}>`).join(' '), inline: true }
      )
      .setColor(TOURNAMENT_COLORS.info)
      .setTimestamp();

    await teamChannel.send({ embeds: [welcomeEmbed] });

    // Guardar ID del canal en el equipo
    team.channelId = teamChannel.id;

  } catch (error) {
    console.error('Error creando canal del equipo:', error);
  }
}

// Actualizar panel de registro
async function updateRegistrationPanel(guild) {
  try {
    const registrationChannel = guild.channels.cache.get(activeTournament.channels.registration);
    if (!registrationChannel) return;

    const messages = await registrationChannel.messages.fetch({ limit: 50 });
    const botMessages = messages.filter(msg => 
      msg.author.id === guild.client.user.id && 
      msg.embeds.length > 0 && 
      msg.embeds[0].title === '📝 Registro de Equipos'
    );

    // Actualizar el último panel de registro
    if (botMessages.size > 0) {
      const latestMessage = botMessages.first();
      
      const updatedEmbed = new EmbedBuilder()
        .setTitle('📝 Registro de Equipos')
        .setDescription('¡Registra tu equipo para participar en el torneo!')
        .addFields(
          { name: '📊 Equipos Registrados', value: `${registeredTeams.length}/${activeTournament.maxTeams}`, inline: true },
          { name: '👥 Jugadores por Equipo', value: `${activeTournament.teamSize}`, inline: true },
          { name: '🏁 Formato', value: activeTournament.format, inline: true },
          { name: '🎮 Equipos', value: registeredTeams.length > 0 ? 
            registeredTeams.map(team => `**${team.name}** ${team.tag ? `[${team.tag}]` : ''}`).join('\n') : 
            'Ningún equipo registrado aún', inline: false }
        )
        .setColor(TOURNAMENT_COLORS.info)
        .setTimestamp();

      const registerButton = new ButtonBuilder()
        .setCustomId('tournament_register_btn')
        .setLabel('🎮 Registrar Equipo')
        .setStyle(registeredTeams.length >= activeTournament.maxTeams ? ButtonStyle.Danger : ButtonStyle.Primary)
        .setDisabled(registeredTeams.length >= activeTournament.maxTeams);

      const dashboardButton = new ButtonBuilder()
        .setCustomId('tournament_dashboard_btn')
        .setLabel('📊 Ver Dashboard')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(registerButton, dashboardButton);

      await latestMessage.edit({ embeds: [updatedEmbed], components: [row] });
    }

  } catch (error) {
    console.error('Error actualizando panel de registro:', error);
  }
}

// Handler para el dashboard del torneo
export async function handleTournamentDashboard(interaction) {
  try {
    if (!activeTournament) {
      return await interaction.reply({
        content: '❌ No hay torneos activos en este momento.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const statusEmoji = {
      'registration': '🟢',
      'in-progress': '🟡',
      'finished': '🔴'
    };

    const formatEmoji = {
      'single': '🏁',
      'double': '🔄',
      'round-robin': '🏆',
      'swiss': '🎯'
    };

    const gameEmoji = {
      'valorant': '🎮',
      'lol': '⚔️',
      'cs2': '🔫',
      'rl': '🏈',
      'other': '🎯'
    };

    const dashboardEmbed = new EmbedBuilder()
      .setTitle(`🏆 Dashboard: ${activeTournament.name}`)
      .setDescription('Estado actual del torneo competitivo')
      .addFields(
        { 
          name: '📊 Información General', 
          value: `**Estado:** ${statusEmoji[activeTournament.status]} ${activeTournament.status}\n**Formato:** ${formatEmoji[activeTournament.format]} ${activeTournament.format}\n**Juego:** ${gameEmoji[activeTournament.game]} ${activeTournament.game.toUpperCase()}`,
          inline: true 
        },
        { 
          name: '👥 Equipos', 
          value: `**Registrados:** ${registeredTeams.length}/${activeTournament.maxTeams}\n**Jugadores por equipo:** ${activeTournament.teamSize}\n**Total jugadores:** ${registeredTeams.length * activeTournament.teamSize}`,
          inline: true 
        },
        { 
          name: '⏰ Tiempo', 
          value: `**Creado:** <t:${Math.floor(activeTournament.createdAt.getTime() / 1000)}:R>\n**Por:** <@${activeTournament.createdBy}>`,
          inline: true 
        }
      )
      .setColor(TOURNAMENT_COLORS.info)
      .setTimestamp();

    // Agregar lista de equipos si hay equipos registrados
    if (registeredTeams.length > 0) {
      const teamsList = registeredTeams.map((team, index) => 
        `${index + 1}. **${team.name}** ${team.tag ? `[${team.tag}]` : ''}\n   👤 ${team.captain.displayName} (${team.members.length} jugadores)`
      ).join('\n');

      dashboardEmbed.addFields({
        name: `🎮 Equipos Registrados (${registeredTeams.length})`,
        value: teamsList.length > 1024 ? teamsList.substring(0, 1021) + '...' : teamsList,
        inline: false
      });
    }

    // Botones de acción
    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('tournament_register_btn')
          .setLabel('📝 Registrar Equipo')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(
            registeredTeams.length >= activeTournament.maxTeams || 
            activeTournament.status !== 'registration'
          ),
        new ButtonBuilder()
          .setCustomId('tournament_bracket_btn')
          .setLabel('🏆 Ver Brackets')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(activeTournament.status === 'registration')
      );

    await interaction.editReply({ 
      embeds: [dashboardEmbed], 
      components: activeTournament.status === 'registration' ? [actionRow] : []
    });

  } catch (error) {
    console.error('Error en tournament dashboard:', error);
    await interaction.editReply('❌ Error al mostrar el dashboard del torneo');
  }
}

// Placeholder para funciones futuras
export async function handleTournamentStart(interaction) {
  await interaction.reply({
    content: '🚧 **Función en desarrollo:** Sistema de brackets automático próximamente.',
    ephemeral: true
  });
}

export async function handleTournamentBracket(interaction) {
  await interaction.reply({
    content: '🚧 **Función en desarrollo:** Visualización de brackets próximamente.',
    ephemeral: true
  });
}

// Handler para resetear/eliminar torneo
export async function handleTournamentReset(interaction) {
  try {
    if (!hasAdminPermissions(interaction.member)) {
      return await interaction.reply({
        content: '❌ **Sin permisos:** Solo los administradores pueden resetear torneos.',
        ephemeral: true
      });
    }

    const confirm = interaction.options.getBoolean('confirm');
    
    if (!confirm) {
      return await interaction.reply({
        content: '❌ Debes confirmar que quieres eliminar el torneo.',
        ephemeral: true
      });
    }

    if (!activeTournament) {
      return await interaction.reply({
        content: '❌ No hay torneos activos para eliminar.',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const tournamentName = activeTournament.name;

    try {
      // Eliminar categoría y todos sus canales
      const category = interaction.guild.channels.cache.get(activeTournament.categoryId);
      if (category) {
        // Eliminar todos los canales de la categoría
        const channelsToDelete = interaction.guild.channels.cache.filter(
          channel => channel.parentId === category.id
        );
        
        for (const [, channel] of channelsToDelete) {
          await channel.delete().catch(console.error);
        }
        
        // Eliminar la categoría
        await category.delete().catch(console.error);
      }

      // Eliminar rol de participante
      const participantRole = interaction.guild.roles.cache.get(activeTournament.roles.participant);
      if (participantRole) {
        await participantRole.delete().catch(console.error);
      }

      // Limpiar datos
      activeTournament = null;
      registeredTeams = [];
      tournamentBracket = null;

      const resetEmbed = new EmbedBuilder()
        .setTitle('🗑️ Torneo Eliminado')
        .setDescription(`**${tournamentName}** ha sido completamente eliminado.`)
        .addFields(
          { name: '✅ Eliminado', value: 'Categoría, canales, roles y datos', inline: true },
          { name: '🔄 Estado', value: 'Sistema listo para nuevo torneo', inline: true }
        )
        .setColor(TOURNAMENT_COLORS.danger)
        .setTimestamp();

      await interaction.editReply({ embeds: [resetEmbed] });

    } catch (error) {
      console.error('Error eliminando estructuras del torneo:', error);
      await interaction.editReply('⚠️ Torneo eliminado pero hubo errores borrando algunos elementos.');
    }

  } catch (error) {
    console.error('Error en tournament reset:', error);
    await interaction.editReply('❌ Error al eliminar el torneo');
  }
}

export { activeTournament, registeredTeams };