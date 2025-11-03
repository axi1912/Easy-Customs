// Modelo de datos para Tournament
// Este bot está optimizado para torneos de Call of Duty: Warzone
// con sistema de puntuación por kills y multiplicadores por posición

export class Tournament {
  constructor({
    name,
    maxTeams,
    teamSize,
    format, // Texto libre: Tríos, Solos, Duos, Cuartetos, etc.
    game = 'warzone',
    createdBy,
    categoryId,
    channels = {},
    roles = {}
  }) {
    this.id = Date.now();
    this.name = name;
    this.maxTeams = maxTeams;
    this.teamSize = teamSize;
    this.format = format; // Formato libre definido por el usuario
    this.game = game;
    this.status = 'registration';
    this.categoryId = categoryId;
    this.channels = {
      announcements: channels.announcements || null,
      registration: channels.registration || null,
      brackets: channels.brackets || null
    };
    this.roles = {
      participant: roles.participant || null
    };
    this.createdBy = createdBy;
    this.createdAt = new Date();
    this.bracket = null;
    this.matches = [];
    this.availableTeams = []; // Lista de equipos pre-registrados por admins
  }

  // Métodos para gestionar el estado del torneo
  startTournament() {
    this.status = 'in-progress';
  }

  finishTournament() {
    this.status = 'finished';
  }

  isRegistrationOpen() {
    return this.status === 'registration';
  }

  isInProgress() {
    return this.status === 'in-progress';
  }

  isFinished() {
    return this.status === 'finished';
  }

  // Métodos para validación
  canRegisterMoreTeams(currentTeamCount) {
    return this.isRegistrationOpen() && currentTeamCount < this.maxTeams;
  }

  // Métodos para export/import
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      maxTeams: this.maxTeams,
      teamSize: this.teamSize,
      format: this.format,
      game: this.game,
      status: this.status,
      categoryId: this.categoryId,
      channels: this.channels,
      roles: this.roles,
      createdBy: this.createdBy,
      createdAt: this.createdAt.toISOString(),
      bracket: this.bracket,
      matches: this.matches,
      availableTeams: this.availableTeams
    };
  }

  static fromJSON(data) {
    const tournament = new Tournament({
      name: data.name,
      maxTeams: data.maxTeams,
      teamSize: data.teamSize,
      format: data.format,
      game: data.game,
      createdBy: data.createdBy,
      categoryId: data.categoryId,
      channels: data.channels,
      roles: data.roles
    });
    
    tournament.id = data.id;
    tournament.status = data.status;
    tournament.createdAt = new Date(data.createdAt);
    tournament.bracket = data.bracket;
    tournament.matches = data.matches;
    tournament.availableTeams = data.availableTeams || [];
    
    return tournament;
  }
}