// Comando /admin-register-team

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { LIMITS } from '../../utils/constants.js';
import { handleAdminRegisterTeam } from '../../interactions/commands/admin-register-team.js';

export const data = new SlashCommandBuilder()
  .setName('admin-register-team')
  .setDescription('🏆 [ADMIN] Registrar un equipo en el torneo activo')
  .addStringOption(o => o
    .setName('team-name')
    .setDescription('Nombre del equipo')
    .setRequired(true)
    .setMinLength(LIMITS.MIN_TEAM_NAME)
    .setMaxLength(LIMITS.MAX_TEAM_NAME)
  )
  .addStringOption(o => o
    .setName('team-tag')
    .setDescription('Tag del equipo (opcional)')
    .setRequired(false)
    .setMinLength(LIMITS.MIN_TEAM_TAG)
    .setMaxLength(LIMITS.MAX_TEAM_TAG)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const execute = handleAdminRegisterTeam;