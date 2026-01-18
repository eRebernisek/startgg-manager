import { Component, OnInit, ChangeDetectorRef, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { StartggService, Tournament, Player, Set as SetType, Game, Videogame, Event as StartGGEvent } from '../../shared/services/startgg.service';

interface Character {
  id: string;
  name: string;
  imageUrl: string | null;
}

interface MatchWithGames extends SetType {
  games: Game[];
  isExpanded: boolean;
  isDirty: boolean;
  availableCharacters?: Character[];
}

@Component({
  selector: 'app-matches',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './matches.component.html',
  styleUrl: './matches.component.sass'
})
export class MatchesComponent implements OnInit {
  matches: MatchWithGames[] = [];
  tournaments: Tournament[] = [];
  selectedEventId: string | null = null;
  isLoading: boolean = false;
  isLoadingMatches: boolean = false;
  error: string | null = null;
  events: Array<{ id: string; name: string; tournamentId: string; tournamentName: string }> = [];
  expandedMatchId: string | null = null;
  savingMatchId: string | null = null;
  loadingMatchDetails: Set<string> = new Set();
  
  // Character selection modal state
  showCharacterModal: boolean = false;
  characterModalContext: {
    match: MatchWithGames;
    gameIndex: number;
    entrantIndex: number;
  } | null = null;

  constructor(
    private startggService: StartggService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
  }

  async ngOnInit() {
    await this.loadTournaments();
  }

  async loadTournaments() {
    this.isLoading = true;
    this.error = null;
    this.cdr.markForCheck();

    try {
      this.tournaments = await this.startggService.getTournaments();
      if (this.tournaments.length > 0) {
        const tournamentIds = this.tournaments.map(t => t.id);
        this.events = await this.startggService.getAllEventsFromTournaments(tournamentIds);
        // Events dropdown is populated, but no event is auto-selected
      }
    } catch (error: any) {
      this.error = error.message || 'Failed to load tournaments';
      console.error('Error loading tournaments:', error);
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  async loadMatches() {
    if (!this.selectedEventId) return;

    this.isLoadingMatches = true;
    this.error = null;
    this.cdr.markForCheck();

    try {
      const matches = await this.startggService.getEventMatches(this.selectedEventId);
      // Convert to MatchWithGames and populate with all Set interface properties
      this.matches = matches.map(match => ({
        id: match.id,
        state: match.state,
        round: match.round,
        winnerId: match.winnerId,
        totalGames: match.totalGames,
        startedAt: match.startedAt,
        slots: match.slots,
        games: this.initializeGames(match),
        videogame: match.videogame,
        isExpanded: false,
        isDirty: false
      }));
    } catch (error: any) {
      this.error = error.message || 'Failed to load matches';
      console.error('Error loading matches:', error);
    } finally {
      this.isLoadingMatches = false;
      this.cdr.markForCheck();
    }
  }

  private initializeGames(match: SetType): Game[] {
    // Initialize empty games - will be loaded from API when match is expanded
    return [];
  }

  private convertApiGamesToGames(apiGames: Array<{
    id: string;
    orderNum: number;
    winnerId: string | null;
    entrant1Score: number | null;
    entrant2Score: number | null;
    selections?: Array<{
      entrant?: {
        id: string;
      };
      character?: {
        id: string;
        name: string;
        images?: Array<{
          url: string;
          type: string;
        }>;
      };
    }>;
  }>, match: SetType): Game[] {
    const games: Game[] = [];
    const entrant1Id = match.slots?.[0]?.entrant?.id;
    const entrant2Id = match.slots?.[1]?.entrant?.id;

    apiGames.forEach(apiGame => {
      let entrant1CharacterId: string | null = null;
      let entrant2CharacterId: string | null = null;

      // Extract character selections for each entrant
      if (apiGame.selections) {
        apiGame.selections.forEach(selection => {
          if (selection.entrant?.id === entrant1Id && selection.character?.id) {
            entrant1CharacterId = selection.character.id;
          } else if (selection.entrant?.id === entrant2Id && selection.character?.id) {
            entrant2CharacterId = selection.character.id;
          }
        });
      }

      games.push({
        id: apiGame.id,
        orderNum: apiGame.orderNum,
        winnerId: apiGame.winnerId ?? null,
        entrant1CharacterId: entrant1CharacterId ?? null,
        entrant2CharacterId: entrant2CharacterId ?? null,
        entrant1Score: apiGame.entrant1Score ?? null,
        entrant2Score: apiGame.entrant2Score ?? null,
        selections: apiGame.selections
      });
    });

    // Sort by orderNum
    games.sort((a, b) => a.orderNum - b.orderNum);
    return games;
  }

  private convertApiCharactersToCharacters(apiCharacters?: Array<{
    id: string;
    name: string;
    images?: Array<{
      url: string;
      type?: string;
    }>;
  }>): Character[] {
    if (!apiCharacters) return [];

    return apiCharacters.map(char => {
      // Use the first image from each character
      const imageUrl = char.images && char.images.length > 0 ? char.images[0].url : null;

      return {
        id: char.id,
        name: char.name,
        imageUrl
      };
    });
  }

  onEventChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.selectedEventId = target.value;
    this.loadMatches();
  }

  refreshMatches() {
    if (this.selectedEventId) {
      this.loadMatches();
    }
  }

  getMatchState(state: number): string {
    // Match states: 1 = Pending, 2 = In Progress, 3 = Complete
    switch (state) {
      case 1:
        return 'Pending';
      case 2:
        return 'In Progress';
      case 3:
        return 'Complete';
      default:
        return 'Unknown';
    }
  }

  getEntrantName(slot: any): string {
    if (slot.entrant) {
      return slot.entrant.name;
    }
    return 'TBD';
  }

  getEntrantPlayers(slot: any): string {
    if (slot.entrant && slot.entrant.participants) {
      return slot.entrant.participants
        .map((p: any) => p.player?.gamerTag || 'Unknown')
        .join(', ');
    }
    return 'TBD';
  }

  getScore(slot: any): number | null {
    return slot.standing?.stats?.score?.value ?? null;
  }

  getMatchScore(match: SetType): string {
    if (!match.slots || match.slots.length < 2) {
      return 'TBD';
    }

    const score1 = this.getScore(match.slots[0]);
    const score2 = this.getScore(match.slots[1]);

    if (score1 !== null && score2 !== null) {
      return `${score1} - ${score2}`;
    }

    if (match.state === 1) {
      return 'Upcoming';
    }

    if (match.state === 2) {
      return 'In Progress';
    }

    return 'TBD';
  }

  getWinnerName(match: SetType): string | null {
    if (!match.winnerId || !match.slots) return null;
    
    const winnerSlot = match.slots.find(slot => slot.entrant?.id === match.winnerId);
    return winnerSlot ? this.getEntrantName(winnerSlot) : null;
  }

  async toggleMatch(matchId: string) {
    const match = this.matches.find(m => m.id === matchId);
    if (!match) return;

    if (this.expandedMatchId === matchId) {
      // Collapse
      this.expandedMatchId = null;
      match.isExpanded = false;
      this.cdr.markForCheck();
    } else {
      // Expand - load match details
      this.expandedMatchId = matchId;
      match.isExpanded = true;
      this.cdr.markForCheck();

      // Only load if games haven't been loaded yet or if games array is empty
      if (match.games.length === 0 && !this.loadingMatchDetails.has(matchId)) {
        await this.loadMatchDetails(match);
      }
    }
  }

  async loadMatchDetails(match: MatchWithGames) {
    this.loadingMatchDetails.add(match.id);
    this.cdr.markForCheck();

    try {
      const matchDetails = await this.startggService.getMatchDetails(match.id);
      
      // Convert API games to our Game format
      match.games = this.convertApiGamesToGames(matchDetails.games, match);
      
      // Update match state if it changed
      match.state = matchDetails.state;
      
      // Load characters from the videogame - prefer videogame from Set interface if available
      const videogame = match.videogame || matchDetails.event?.videogame;
      if (videogame?.characters) {
        match.availableCharacters = this.convertApiCharactersToCharacters(videogame.characters);
      }
    } catch (error: any) {
      console.error('Error loading match details:', error);
      // If loading fails, initialize with empty games
      if (match.games.length === 0) {
        match.games = this.initializeGames(match);
      }
    } finally {
      this.loadingMatchDetails.delete(match.id);
      this.cdr.markForCheck();
    }
  }

  async startMatch(match: MatchWithGames, event: Event) {
    event.stopPropagation();
    try {
      const updatedSet = await this.startggService.startMatch(match.id);
      // Update match state and startedAt from the returned Set
      match.state = updatedSet.state;
      match.startedAt = updatedSet.startedAt;
      this.cdr.markForCheck();
    } catch (error: any) {
      alert(`Failed to start match: ${error.message}`);
    }
  }

  async resetMatch(match: MatchWithGames, event: Event) {
    event.stopPropagation();
    if (!confirm('Are you sure you want to reset this match?')) {
      return;
    }
    try {
      const updatedSet = await this.startggService.resetMatch(match.id, false);
      // Update match state and startedAt from the returned Set
      match.state = updatedSet.state;
      match.startedAt = updatedSet.startedAt;
      match.games = this.initializeGames(match);
      match.isDirty = false;
      this.cdr.markForCheck();
    } catch (error: any) {
      alert(`Failed to reset match: ${error.message}`);
    }
  }

  openInStartGG(matchId: string, event: Event) {
    event.stopPropagation();
    const url = this.startggService.getMatchUrl(matchId);
    window.open(url, '_blank');
  }

  addGame(match: MatchWithGames, event: Event) {
    event.stopPropagation();
    const newOrderNum = match.games.length > 0 
      ? Math.max(...match.games.map(g => g.orderNum)) + 1 
      : 1;
    match.games.push({
      id: `game-${match.id}-${Date.now()}`,
      orderNum: newOrderNum,
      winnerId: null,
      entrant1CharacterId: null,
      entrant2CharacterId: null,
      entrant1Score: null,
      entrant2Score: null
    });
    match.isDirty = true;
    this.cdr.markForCheck();
  }

  deleteGame(match: MatchWithGames, gameIndex: number, event: Event) {
    event.stopPropagation();
    if (match.games.length > 1) {
      match.games.splice(gameIndex, 1);
      match.isDirty = true;
      this.cdr.markForCheck();
    }
  }

  setGameWinner(match: MatchWithGames, gameIndex: number, winnerId: string, event: Event) {
    event.stopPropagation();
    const game = match.games[gameIndex];
    game.winnerId = game.winnerId === winnerId ? null : winnerId; // Toggle if clicking same winner
    
    // Update scores based on winner (optional - you can remove this if scores are set separately)
    if (game.winnerId) {
      const entrant1Id = this.getEntrantId(match.slots?.[0]);
      const entrant2Id = this.getEntrantId(match.slots?.[1]);
      
      if (game.winnerId === entrant1Id) {
        game.entrant1Score = (game.entrant1Score || 0) + 1;
      } else if (game.winnerId === entrant2Id) {
        game.entrant2Score = (game.entrant2Score || 0) + 1;
      }
    }
    
    match.isDirty = true;
    this.cdr.markForCheck();
  }

  setGameScore(match: MatchWithGames, gameIndex: number, entrantIndex: number, score: number, event: Event) {
    event.stopPropagation();
    const game = match.games[gameIndex];
    if (entrantIndex === 0) {
      game.entrant1Score = score;
    } else {
      game.entrant2Score = score;
    }
    match.isDirty = true;
    this.cdr.markForCheck();
  }

  // Temporary fallback method for cached builds - remove after verification
  setGameCharacter(match: MatchWithGames, gameIndex: number, entrantIndex: number, characterId: string, event: Event) {
    // Redirect to openCharacterModal
    this.openCharacterModal(match, gameIndex, entrantIndex, event);
  }

  async openCharacterModal(match: MatchWithGames, gameIndex: number, entrantIndex: number, event: Event) {
    event.stopPropagation();

    // Populate characters from match.videogame if available
    if (match.videogame?.characters && (!match.availableCharacters || match.availableCharacters.length === 0)) {
      match.availableCharacters = this.convertApiCharactersToCharacters(match.videogame.characters);
    }
    
    // Set modal context (no position needed since modal is centered on screen)
    this.characterModalContext = {
      match,
      gameIndex,
      entrantIndex
    };
    
    this.showCharacterModal = true;
    this.cdr.detectChanges();
  }

  closeCharacterModal() {
    this.showCharacterModal = false;
    this.characterModalContext = null;
    this.cdr.markForCheck();
  }

  selectCharacter(characterId: string) {
    if (!this.characterModalContext) return;

    const { match, gameIndex, entrantIndex } = this.characterModalContext;
    const game = match.games[gameIndex];

    if (entrantIndex === 0) {
      game.entrant1CharacterId = game.entrant1CharacterId === characterId ? null : characterId;
    } else {
      game.entrant2CharacterId = game.entrant2CharacterId === characterId ? null : characterId;
    }

    match.isDirty = true;
    this.closeCharacterModal();
  }

  getSelectedCharacter(match: MatchWithGames, gameIndex: number, entrantIndex: number): Character | null {
    if (!match.availableCharacters) return null;

    const game = match.games[gameIndex];
    const characterId = entrantIndex === 0 ? game.entrant1CharacterId : game.entrant2CharacterId;
    
    if (!characterId) return null;
    
    return match.availableCharacters.find(char => char.id === characterId) || null;
  }

  async saveMatch(match: MatchWithGames, event: Event) {
    event.stopPropagation();

    console.clear();

    if (!match.isDirty) {
      return; // Nothing to save
    }

    this.savingMatchId = match.id;
    this.cdr.markForCheck();

    try {
      // Get entrant IDs
      const entrant1Id = match.slots?.[0]?.entrant?.id;
      const entrant2Id = match.slots?.[1]?.entrant?.id;

      if (!entrant1Id || !entrant2Id) {
        throw new Error('Both entrants must be present to save match');
      }

      // Prepare game data for updateBracketSet
      const gameData = match.games.map(game => ({
        gameNum: game.orderNum,
        winnerId: game.winnerId ?? null,
        entrant1Score: game.entrant1Score ?? null,
        entrant2Score: game.entrant2Score ?? null,
        entrant1Id: entrant1Id,
        entrant2Id: entrant2Id,
        entrant1CharacterId: game.entrant1CharacterId ?? null,
        entrant2CharacterId: game.entrant2CharacterId ?? null
      }));

      debugger;
      // For save, winnerId is always null (updateBracketSet doesn't change set winner)
      const updatedSet = await this.startggService.updateBracketSet(match.id, null, gameData);
      
      // Update match with the returned Set data
      match.state = updatedSet.state;
      match.winnerId = updatedSet.winnerId;
      match.startedAt = updatedSet.startedAt;
      
      match.isDirty = false;
      
      // Reload match details to get updated data from API
      await this.loadMatchDetails(match);
      
      alert('Match saved successfully!');
    } catch (error: any) {
      console.error('Error saving match:', error);
      alert(`Failed to save match: ${error.message || 'Unknown error'}`);
    } finally {
      this.savingMatchId = null;
      this.cdr.markForCheck();
    }
  }

  async submitMatch(match: MatchWithGames, event: Event) {
    event.stopPropagation();
    
    if (!match.isDirty) {
      return; // Nothing to submit
    }

    this.savingMatchId = match.id;
    this.cdr.markForCheck();

    try {
      // Get entrant IDs
      const entrant1Id = match.slots?.[0]?.entrant?.id;
      const entrant2Id = match.slots?.[1]?.entrant?.id;

      if (!entrant1Id || !entrant2Id) {
        throw new Error('Both entrants must be present to submit match');
      }

      // Prepare game data for reportBracketSet
      const gameData = match.games.map(game => ({
        gameNum: game.orderNum,
        winnerId: game.winnerId ?? null,
        entrant1Score: game.entrant1Score ?? null,
        entrant2Score: game.entrant2Score ?? null,
        entrant1Id: entrant1Id,
        entrant2Id: entrant2Id,
        entrant1CharacterId: game.entrant1CharacterId ?? null,
        entrant2CharacterId: game.entrant2CharacterId ?? null
      }));

      // Determine the overall match winner from the games
      let matchWinnerId: string | null = match.winnerId || null;
      
      // If no explicit winner set, try to determine from game winners
      if (!matchWinnerId) {
        const entrant1Wins = match.games.filter(g => g.winnerId === entrant1Id).length;
        const entrant2Wins = match.games.filter(g => g.winnerId === entrant2Id).length;
        
        if (entrant1Wins > entrant2Wins) {
          matchWinnerId = entrant1Id;
        } else if (entrant2Wins > entrant1Wins) {
          matchWinnerId = entrant2Id;
        }
      }

      if (!matchWinnerId) {
        throw new Error('Match winner must be determined before submitting');
      }

      const updatedSets = await this.startggService.reportBracketSet(match.id, matchWinnerId, gameData);
      
      // Update match with the returned Set data (reportBracketSet returns an array, use first one)
      if (updatedSets && updatedSets.length > 0) {
        const updatedSet = updatedSets[0];
        match.state = updatedSet.state;
        match.winnerId = updatedSet.winnerId;
        match.startedAt = updatedSet.startedAt;
      }
      
      match.isDirty = false;
      
      // Reload match details to get updated data from API
      await this.loadMatchDetails(match);
      
      alert('Match submitted successfully!');
    } catch (error: any) {
      console.error('Error submitting match:', error);
      alert(`Failed to submit match: ${error.message || 'Unknown error'}`);
    } finally {
      this.savingMatchId = null;
      this.cdr.markForCheck();
    }
  }

  getEntrantId(slot: any): string | null {
    return slot.entrant?.id || null;
  }

  isGameWinner(match: MatchWithGames, gameIndex: number, entrantId: string | null): boolean {
    const winnerId = match.games[gameIndex]?.winnerId;
    return winnerId !== null && winnerId !== undefined && winnerId === entrantId;
  }
}
