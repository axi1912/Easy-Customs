// Exportador de handlers de modales

import { handleTournamentRegisterModal } from './teamRegister.js';
import { handleModalCreateTournament } from './createTournament.js';
import { handleModalSubmitResult } from './submitResult.js';
import { handleSubmitResultManual } from './submitResultManual.js';
import { handleSendLobbyCode } from './sendLobbyCode.js';
import { handleModalPanelRegisterTeam } from './panelRegisterTeam.js';

export const modalHandlers = {
  'tournament_register_modal': handleTournamentRegisterModal,
  'modal_create_tournament': handleModalCreateTournament,
  'modal_submit_result': handleModalSubmitResult,
  'modal_send_lobby_code': handleSendLobbyCode,
  'modal_panel_register_team': handleModalPanelRegisterTeam,
  // Dynamic handlers
  _dynamic: {
    submit_result_manual: handleSubmitResultManual
  }
};