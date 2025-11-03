// Comando /registration-panel

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { handlePublicRegistrationPanel } from '../../interactions/commands/registration-panel.js';

export const data = new SlashCommandBuilder()
  .setName('registration-panel')
  .setDescription('🏆 Crear panel público de registro de participantes')
  .addChannelOption(o => o
    .setName('channel')
    .setDescription('Canal donde crear el panel (opcional, por defecto el canal actual)')
    .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const execute = handlePublicRegistrationPanel;