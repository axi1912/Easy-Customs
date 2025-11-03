// Script de pruebas completo para todas las funciones del bot
// Ejecutar con: node test-all-functions.js

import { tournamentManager } from './src/services/tournament/manager.js';
import { googleSheetsService } from './src/services/google/sheets.js';
import { ScoringService } from './src/services/tournament/scoring.js';

console.log('🧪 INICIANDO PRUEBAS DEL BOT DE TORNEOS\n');
console.log('═'.repeat(60));

// ==================== TEST 1: Google Sheets ====================
async function testGoogleSheets() {
  console.log('\n📊 TEST 1: Conexión a Google Sheets');
  console.log('─'.repeat(60));
  
  try {
    const connected = await googleSheetsService.initialize();
    if (connected) {
      console.log('✅ Google Sheets conectado exitosamente');
    } else {
      console.log('❌ Error conectando a Google Sheets');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// ==================== TEST 2: Crear Torneo ====================
async function testCreateTournament() {
  console.log('\n🏆 TEST 2: Crear Torneo');
  console.log('─'.repeat(60));
  
  try {
    const tournament = tournamentManager.createTournament({
      name: 'Torneo de Prueba',
      maxTeams: 8,
      teamSize: 4,
      format: 'Battle Royale',
      game: 'warzone',
      createdBy: 'test-user-id',
      categoryId: 'test-category-id',
      channels: {
        announcements: 'test-announcements',
        registration: 'test-registration'
      },
      roles: {
        participant: 'test-role-id'
      }
    });
    
    console.log('✅ Torneo creado:', tournament.name);
    console.log(`   - Equipos máximos: ${tournament.maxTeams}`);
    console.log(`   - Tamaño de equipo: ${tournament.teamSize}`);
    console.log(`   - Formato: ${tournament.format}`);
    console.log(`   - ID: ${tournament.id}`);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// ==================== TEST 3: Registrar Equipos ====================
async function testRegisterTeams() {
  console.log('\n👥 TEST 3: Registrar Equipos');
  console.log('─'.repeat(60));
  
  try {
    const tournament = tournamentManager.getActiveTournament();
    
    if (!tournament) {
      console.log('❌ No hay torneo activo');
      return;
    }
    
    // Inicializar availableTeams si no existe
    if (!tournament.availableTeams) {
      tournament.availableTeams = [];
    }
    
    const teams = [
      { name: 'TEAM AXIOMS', tag: 'AX' },
      { name: 'TEAM ELITE', tag: 'ELT' },
      { name: 'TEAM PARKA', tag: 'PRK' }
    ];
    
    for (const teamData of teams) {
      const newTeam = {
        id: `team_${Date.now()}_${Math.random()}`,
        name: teamData.name,
        tag: teamData.tag,
        members: [],
        createdBy: 'test-user',
        createdAt: new Date().toISOString(),
        channels: null,
        roleId: null
      };
      
      tournament.availableTeams.push(newTeam);
      
      // Registrar en Google Sheets
      await googleSheetsService.registerTeam({
        name: teamData.name,
        captain: 'Pendiente',
        players: [],
        captainDiscord: 'Pendiente',
        userId: 'test-user-id'
      }, tournament.id);
      
      console.log(`✅ Equipo registrado: ${teamData.name} [${teamData.tag}]`);
    }
    
    console.log(`\n   Total equipos: ${tournament.availableTeams.length}/${tournament.maxTeams}`);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// ==================== TEST 4: Añadir Miembros a Equipos ====================
async function testAddTeamMembers() {
  console.log('\n👤 TEST 4: Añadir Miembros a Equipos');
  console.log('─'.repeat(60));
  
  try {
    const tournament = tournamentManager.getActiveTournament();
    
    if (!tournament || !tournament.availableTeams) {
      console.log('❌ No hay equipos disponibles');
      return;
    }
    
    // Añadir miembros al primer equipo
    const team = tournament.availableTeams[0];
    const members = [
      { userId: 'user1', username: 'Player1', displayName: 'Player One' },
      { userId: 'user2', username: 'Player2', displayName: 'Player Two' },
      { userId: 'user3', username: 'Player3', displayName: 'Player Three' },
      { userId: 'user4', username: 'Player4', displayName: 'Player Four' }
    ];
    
    for (const member of members) {
      team.members.push({
        ...member,
        joinedAt: new Date().toISOString()
      });
    }
    
    // Actualizar en Google Sheets
    await googleSheetsService.updateTeamMembers(
      team.name,
      team.members.map(m => m.displayName),
      team.members[0].displayName,
      tournament.id
    );
    
    console.log(`✅ ${team.members.length} miembros añadidos a ${team.name}`);
    team.members.forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.displayName} (${m.username})`);
    });
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// ==================== TEST 5: Sistema de Puntuación ====================
async function testScoringSystem() {
  console.log('\n🎯 TEST 5: Sistema de Puntuación');
  console.log('─'.repeat(60));
  
  try {
    const testCases = [
      { position: 1, kills: 25 },
      { position: 3, kills: 18 },
      { position: 7, kills: 12 },
      { position: 12, kills: 8 }
    ];
    
    console.log('Probando diferentes escenarios:\n');
    
    for (const testCase of testCases) {
      const score = ScoringService.calculateTeamScore(testCase.kills, testCase.position);
      
      console.log(`📍 Posición ${testCase.position}° | 💀 ${testCase.kills} kills`);
      console.log(`   Multiplicador: x${score.multiplier}`);
      console.log(`   Puntuación final: ${score.finalScore} puntos`);
      console.log(`   Cálculo: ${testCase.kills} × ${score.multiplier} = ${score.finalScore}\n`);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// ==================== TEST 6: Registrar Resultados ====================
async function testSubmitResults() {
  console.log('\n📊 TEST 6: Registrar Resultados');
  console.log('─'.repeat(60));
  
  try {
    const tournament = tournamentManager.getActiveTournament();
    
    if (!tournament || !tournament.availableTeams || tournament.availableTeams.length === 0) {
      console.log('❌ No hay equipos para registrar resultados');
      return;
    }
    
    // Registrar resultados para cada equipo
    const results = [
      { team: tournament.availableTeams[0]?.name, position: 1, kills: 25 },
      { team: tournament.availableTeams[1]?.name, position: 3, kills: 18 },
      { team: tournament.availableTeams[2]?.name, position: 7, kills: 12 }
    ];
    
    for (const result of results) {
      if (!result.team) continue;
      
      const scoreData = ScoringService.calculateTeamScore(result.kills, result.position);
      
      // Registrar en Google Sheets
      await googleSheetsService.submitResult({
        teamName: result.team,
        position: result.position,
        totalKills: result.kills,
        finalScore: scoreData.finalScore,
        matchNumber: 1,
        submittedBy: 'test-user',
        timestamp: new Date().toISOString()
      }, tournament.id);
      
      console.log(`✅ ${result.team}: ${result.position}° lugar, ${result.kills} kills = ${scoreData.finalScore} puntos`);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// ==================== TEST 7: Leaderboard ====================
async function testLeaderboard() {
  console.log('\n🏅 TEST 7: Actualizar Leaderboard');
  console.log('─'.repeat(60));
  
  try {
    const tournament = tournamentManager.getActiveTournament();
    
    if (!tournament) {
      console.log('❌ No hay torneo activo');
      return;
    }
    
    await googleSheetsService.updateLeaderboard(tournament.id);
    console.log('✅ Leaderboard actualizado en Google Sheets');
    console.log('   Revisa la hoja "Leaderboard" para ver las posiciones ordenadas');
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// ==================== TEST 8: Búsqueda de Equipos ====================
async function testFindTeam() {
  console.log('\n🔍 TEST 8: Búsqueda de Equipos por Canal');
  console.log('─'.repeat(60));
  
  try {
    const channelNames = [
      'teamaxioms-chat',
      'TEAMELITE-CHAT',
      'teamparka-vc',
      'txt-teamaxioms'
    ];
    
    for (const channelName of channelNames) {
      const team = tournamentManager.findTeamByChannelName(channelName);
      
      if (team) {
        console.log(`✅ "${channelName}" → Equipo encontrado: ${team.name}`);
      } else {
        console.log(`❌ "${channelName}" → No se encontró equipo`);
      }
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// ==================== TEST 9: Validaciones ====================
async function testValidations() {
  console.log('\n✅ TEST 9: Validaciones');
  console.log('─'.repeat(60));
  
  try {
    // Test validación de posición
    console.log('Validación de posiciones:');
    const positions = [0, 1, 8, 15, 16];
    positions.forEach(pos => {
      const valid = ScoringService.isValidPosition(pos);
      console.log(`   Posición ${pos}: ${valid ? '✅ Válida' : '❌ Inválida'}`);
    });
    
    console.log('\nValidación de kills:');
    const kills = [-1, 0, 50, 999, 1000];
    kills.forEach(k => {
      const valid = ScoringService.isValidKills(k);
      console.log(`   Kills ${k}: ${valid ? '✅ Válidos' : '❌ Inválidos'}`);
    });
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// ==================== TEST 10: Información del Torneo ====================
async function testTournamentInfo() {
  console.log('\n📋 TEST 10: Información del Torneo');
  console.log('─'.repeat(60));
  
  try {
    if (!tournamentManager.hasActiveTournament()) {
      console.log('❌ No hay torneo activo');
      return;
    }
    
    const tournament = tournamentManager.getActiveTournament();
    
    console.log(`🏆 Nombre: ${tournament.name}`);
    console.log(`📊 Equipos: ${tournament.availableTeams?.length || 0}/${tournament.maxTeams}`);
    console.log(`👥 Tamaño de equipo: ${tournament.teamSize} jugadores`);
    console.log(`🎮 Formato: ${tournament.format}`);
    console.log(`🎯 Juego: ${tournament.game}`);
    console.log(`🔒 Registro: ${tournament.isRegistrationOpen ? 'Abierto' : 'Cerrado'}`);
    console.log(`📅 Creado: ${new Date(tournament.createdAt).toLocaleString('es-ES')}`);
    
    if (tournament.availableTeams && tournament.availableTeams.length > 0) {
      console.log('\n👥 Equipos registrados:');
      tournament.availableTeams.forEach((team, i) => {
        console.log(`   ${i + 1}. ${team.name} [${team.tag}] - ${team.members?.length || 0}/${tournament.teamSize} jugadores`);
      });
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// ==================== EJECUTAR TODAS LAS PRUEBAS ====================
async function runAllTests() {
  try {
    await testGoogleSheets();
    await testCreateTournament();
    await testRegisterTeams();
    await testAddTeamMembers();
    await testScoringSystem();
    await testSubmitResults();
    await testLeaderboard();
    await testFindTeam();
    await testValidations();
    await testTournamentInfo();
    
    console.log('\n═'.repeat(60));
    console.log('🎉 TODAS LAS PRUEBAS COMPLETADAS');
    console.log('═'.repeat(60));
    console.log('\n✅ Revisa tu Google Sheets para ver:');
    console.log('   - Hoja "Registros": Equipos y miembros');
    console.log('   - Hoja "Resultados": Puntuaciones de partidas');
    console.log('   - Hoja "Leaderboard": Clasificación ordenada');
    
  } catch (error) {
    console.error('\n❌ Error ejecutando pruebas:', error);
  } finally {
    process.exit(0);
  }
}

// Iniciar pruebas
runAllTests();
