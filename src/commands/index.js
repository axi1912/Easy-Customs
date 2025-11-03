// Exportador principal de todos los comandos

import * as setup from './tournament/setup.js';
import * as dashboard from './tournament/dashboard.js';
import * as start from './tournament/start.js';
import * as reset from './tournament/reset.js';
import * as panel from './tournament/panel.js';
import * as panelSimple from './tournament/panel-simple.js';
import * as panelRefresh from './tournament/panel-refresh.js';
import * as adminRegisterTeam from './tournament/admin-register-team.js';
import * as registrationPanel from './tournament/registration-panel.js';

// Array de todos los comandos para registrar en Discord
export const commands = [
  panelSimple.data,    // /panel (Atajo corto)
  panelRefresh.data,   // /panel-refresh (Refrescar panel - NUEVO)
  panel.data,          // /tournament-panel (Original)
  setup.data,
  dashboard.data,
  start.data,
  reset.data,
  adminRegisterTeam.data,  // /admin-register-team (Registro de equipos por admins)
  registrationPanel.data   // /registration-panel (Panel público de registro)
];

// Mapa de comandos para fácil acceso a los handlers
export const commandHandlers = {
  'panel': panelSimple.execute,               // Atajo corto
  'panel-refresh': panelRefresh.execute,      // Refrescar panel (NUEVO)
  'tournament-panel': panel.execute,          // Panel principal (Original)
  'tournament-setup': setup.execute,
  'tournament-dashboard': dashboard.execute,
  'tournament-start': start.execute,
  'tournament-reset': reset.execute,
  'admin-register-team': adminRegisterTeam.execute,  // Registro de equipos por admins
  'registration-panel': registrationPanel.execute    // Panel público de registro
};