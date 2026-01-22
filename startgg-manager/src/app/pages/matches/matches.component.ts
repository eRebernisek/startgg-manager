import { Component, OnInit, ChangeDetectorRef, PLATFORM_ID, Inject, numberAttribute } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { StartggService, Tournament, Player, Set as SetType, Game, Videogame, Event as StartGGEvent } from '../../shared/services/startgg.service';

interface Character {
  id: string;
  name: string;
  imageUrl: string | null;
}

interface SetWithGames extends SetType {
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
  sets: SetWithGames[] = [];
  tournaments: Tournament[] = [];
  isLoading: boolean = false;
  isLoadingSets: boolean = false;
  error: string | null = null;
  events: Array<{ id: string; name: string; tournamentId: string; tournamentName: string }> = [];
  selectedTournamentId: string | null = null;
  selectedEventId: string | null = null;
  expandedSetId: string | null = null;
  savingSetId: string | null = null;
  loadingSetDetails: Set<string> = new Set();
  playerInfoMap: Map<string, Player> = new Map();
  playerImageUrlMap: Map<string, string> = new Map(); // Cache for player image URLs
  
  // Character selection modal state
  showCharacterModal: boolean = false;
  characterModalContext: {
    set: SetWithGames;
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
      }
    } catch (error: any) {
      this.error = error.message || 'Failed to load tournaments';
      console.error('Error loading tournaments:', error);
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  onTournamentChange() {
    var tournamentSelect = document.getElementById('tournament-select') as HTMLSelectElement;
    var tournamentId = tournamentSelect ? tournamentSelect.value : null;
    this.selectedTournamentId = tournamentId;
    this.selectedEventId = null; // Clear event selection when tournament changes
    this.sets = []; // Clear sets when tournament changes    
    this.loadEvents(tournamentId ? parseInt(tournamentId) : null);
  }

  async loadEvents(tournamentId: any) {
    if (!tournamentId) return;
    this.events = await this.startggService.getAllEventsFromTournament(tournamentId);  
    this.cdr.markForCheck();
  }

  async loadSets() {
    if (!this.selectedEventId) return;

    this.isLoadingSets = true;
    this.error = null;
    this.cdr.markForCheck();

    try {
      const sets = await this.startggService.getEventSets(this.selectedEventId);
      // Convert to SetWithGames and populate with all Set interface properties
      this.sets = sets.map(set => ({
        id: set.id,
        state: set.state,
        round: set.round,
        winnerId: set.winnerId,
        totalGames: set.totalGames,
        startedAt: set.startedAt,
        slots: set.slots,
        games: this.initializeGames(set),
        videogame: set.videogame,
        isExpanded: false,
        isDirty: false
      }));
      
      // Load player info for all players in sets and cache image URLs
      await this.loadPlayerInfo();
      this.playerInfoMap.forEach((playerInfo, playerId) => {
        if (playerInfo.user?.images && playerInfo.user.images.length > 0) {
          // Cache the first image URL for each player
          this.playerImageUrlMap.set(playerId, playerInfo.user.images[0].url);
        }
      });
    } catch (error: any) {
      this.error = error.message || 'Failed to load sets';
      console.error('Error loading sets:', error);
    } finally {
      this.isLoadingSets = false;
      this.cdr.markForCheck();
    }
  }

  private initializeGames(set: SetType): Game[] {
    // Initialize empty games - will be loaded from API when set is expanded
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
  }>, set: SetType): Game[] {
    const games: Game[] = [];
    const entrant1Id = set.slots?.[0]?.entrant?.id;
    const entrant2Id = set.slots?.[1]?.entrant?.id;

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
    this.loadSets();
  }

  refreshSets() {
    if (this.selectedEventId) {
      this.loadSets();
    }
  }

  getSetState(state: number): string {
    // Set states: 1 = Pending, 2 = In Progress, 3 = Complete
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

  getSetScore(set: SetType): string {
    if (!set.slots || set.slots.length < 2) {
      return 'TBD';
    }

    const score1 = this.getScore(set.slots[0]);
    const score2 = this.getScore(set.slots[1]);

    if (score1 !== null && score2 !== null) {
      return `${score1} - ${score2}`;
    }

    if (set.state === 1) {
      return 'Upcoming';
    }

    if (set.state === 2) {
      return 'In Progress';
    }

    return 'TBD';
  }

  getWinnerName(set: SetType): string | null {
    if (!set.winnerId || !set.slots) return null;
    
    const winnerSlot = set.slots.find(slot => slot.entrant?.id === set.winnerId);
    return winnerSlot ? this.getEntrantName(winnerSlot) : null;
  }

  async toggleSet(setId: string) {
    const set = this.sets.find(s => s.id === setId);
    if (!set) return;

    if (this.expandedSetId === setId) {
      // Collapse
      this.expandedSetId = null;
      set.isExpanded = false;
      this.cdr.markForCheck();
    } else {
      // Expand - load set details
      this.expandedSetId = setId;
      set.isExpanded = true;
      this.cdr.markForCheck();

      // Only load if games haven't been loaded yet or if games array is empty
      if (set.games.length === 0 && !this.loadingSetDetails.has(setId)) {
        await this.loadSetDetails(set);
      }
    }
  }

  async loadSetDetails(set: SetWithGames) {
    this.loadingSetDetails.add(set.id);
    this.cdr.markForCheck();

    try {
      const setDetails = await this.startggService.getSetDetails(set.id);
      
      // Convert API games to our Game format
      set.games = this.convertApiGamesToGames(setDetails.games, set);
      
      // Update set state if it changed
      set.state = setDetails.state;
      
      // Load characters from the videogame - prefer videogame from Set interface if available
      const videogame = set.videogame || setDetails.event?.videogame;
      if (videogame?.characters) {
        set.availableCharacters = this.convertApiCharactersToCharacters(videogame.characters);
      }
    } catch (error: any) {
      console.error('Error loading set details:', error);
      // If loading fails, initialize with empty games
      if (set.games.length === 0) {
        set.games = this.initializeGames(set);
      }
    } finally {
      this.loadingSetDetails.delete(set.id);
      this.cdr.markForCheck();
    }
  }

  async startSet(set: SetWithGames, event: Event) {
    event.stopPropagation();
    try {
      const updatedSet = await this.startggService.startSet(set.id);
      // Update set state and startedAt from the returned Set
      set.state = updatedSet.state;
      set.startedAt = updatedSet.startedAt;
      this.cdr.markForCheck();
    } catch (error: any) {
      alert(`Failed to start set: ${error.message}`);
    }
  }

  async resetSet(set: SetWithGames, event: Event) {
    event.stopPropagation();
    if (!confirm('Are you sure you want to reset this set?')) {
      return;
    }
    try {
      const updatedSet = await this.startggService.resetSet(set.id, false);
      // Update set state and startedAt from the returned Set
      set.state = updatedSet.state;
      set.startedAt = updatedSet.startedAt;
      set.games = this.initializeGames(set);
      set.isDirty = false;
      this.cdr.markForCheck();
    } catch (error: any) {
      alert(`Failed to reset set: ${error.message}`);
    }
  }

  openInStartGG(setId: string, event: Event) {
    event.stopPropagation();
    const url = this.startggService.getSetUrl(setId);
    window.open(url, '_blank');
  }

  addGame(set: SetWithGames, event: Event) {
    event.stopPropagation();
    const newOrderNum = set.games.length > 0 
      ? Math.max(...set.games.map(g => g.orderNum)) + 1 
      : 1;
    set.games.push({
      id: `game-${set.id}-${Date.now()}`,
      orderNum: newOrderNum,
      winnerId: null,
      entrant1CharacterId: null,
      entrant2CharacterId: null,
      entrant1Score: null,
      entrant2Score: null
    });
    set.isDirty = true;
    this.cdr.markForCheck();
  }

  deleteGame(set: SetWithGames, gameIndex: number, event: Event) {
    event.stopPropagation();
    if (set.games.length > 1) {
      set.games.splice(gameIndex, 1);
      set.isDirty = true;
      this.cdr.markForCheck();
    }
  }

  setGameWinner(set: SetWithGames, gameIndex: number, winnerId: string, event: Event) {
    event.stopPropagation();
    const game = set.games[gameIndex];
    game.winnerId = game.winnerId === winnerId ? null : winnerId; // Toggle if clicking same winner
    
    // Update scores based on winner (optional - you can remove this if scores are set separately)
    if (game.winnerId) {
      const entrant1Id = this.getEntrantId(set.slots?.[0]);
      const entrant2Id = this.getEntrantId(set.slots?.[1]);
      
      if (game.winnerId === entrant1Id) {
        game.entrant1Score =  1;
        game.entrant2Score =  0;
      } else if (game.winnerId === entrant2Id) {
        game.entrant2Score = 1;
        game.entrant1Score = 0;
      }

      //Check if no one is the winner, set both scores to 0
      if (!game.winnerId) {
        game.entrant1Score = 0;
        game.entrant2Score = 0;
      }
    }
    
    set.isDirty = true;
    this.cdr.markForCheck();
  }

  setGameScore(set: SetWithGames, gameIndex: number, entrantIndex: number, score: number, event: Event) {
    event.stopPropagation();
    const game = set.games[gameIndex];
    if (entrantIndex === 0) {
      game.entrant1Score = score;
    } else {
      game.entrant2Score = score;
    }
    set.isDirty = true;
    this.cdr.markForCheck();
  }

  // Temporary fallback method for cached builds - remove after verification
  setGameCharacter(set: SetWithGames, gameIndex: number, entrantIndex: number, characterId: string, event: Event) {
    // Redirect to openCharacterModal
    this.openCharacterModal(set, gameIndex, entrantIndex, event);
  }

  async openCharacterModal(set: SetWithGames, gameIndex: number, entrantIndex: number, event: Event) {
    event.stopPropagation();

    // Populate characters from set.videogame if available
    if (set.videogame?.characters && (!set.availableCharacters || set.availableCharacters.length === 0)) {
      set.availableCharacters = this.convertApiCharactersToCharacters(set.videogame.characters);
    }
    
    // Set modal context (no position needed since modal is centered on screen)
    this.characterModalContext = {
      set,
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

    const { set, gameIndex, entrantIndex } = this.characterModalContext;
    const game = set.games[gameIndex];

    if (entrantIndex === 0) {
      game.entrant1CharacterId = game.entrant1CharacterId === characterId ? null : characterId;
    } else {
      game.entrant2CharacterId = game.entrant2CharacterId === characterId ? null : characterId;
    }

    set.isDirty = true;
    this.closeCharacterModal();
  }

  getSelectedCharacter(set: SetWithGames, gameIndex: number, entrantIndex: number): Character | null {
    if (!set.availableCharacters) return null;

    const game = set.games[gameIndex];
    const characterId = entrantIndex === 0 ? game.entrant1CharacterId : game.entrant2CharacterId;
    
    if (!characterId) return null;
    
    return set.availableCharacters.find(char => char.id === characterId) || null;
  }

  async saveSet(set: SetWithGames, event: Event) {
    event.stopPropagation();

    console.clear();

    if (!set.isDirty) {
      return; // Nothing to save
    }

    this.savingSetId = set.id;
    this.cdr.markForCheck();

    try {
      // Get entrant IDs
      const entrant1Id = set.slots?.[0]?.entrant?.id;
      const entrant2Id = set.slots?.[1]?.entrant?.id;

      if (!entrant1Id || !entrant2Id) {
        throw new Error('Both entrants must be present to save set');
      }

      // Prepare game data for updateBracketSet
      const gameData = set.games.map(game => ({
        gameNum: game.orderNum,
        winnerId: game.winnerId ?? null,
        entrant1Score: game.entrant1Score ?? null,
        entrant2Score: game.entrant2Score ?? null,
        entrant1Id: entrant1Id,
        entrant2Id: entrant2Id,
        entrant1CharacterId: game.entrant1CharacterId ?? null,
        entrant2CharacterId: game.entrant2CharacterId ?? null
      }));
      // For save, winnerId is always null (updateBracketSet doesn't change set winner)
      const updatedSet = await this.startggService.updateBracketSet(set.id, null, gameData);
      
      // Update set with the returned Set data
      set.state = updatedSet.state;
      set.winnerId = updatedSet.winnerId;
      set.startedAt = updatedSet.startedAt;
      
      set.isDirty = false;
      
      // Reload set details to get updated data from API
      await this.loadSetDetails(set);
      
      alert('Set saved successfully!');
    } catch (error: any) {
      console.error('Error saving set:', error);
      alert(`Failed to save set: ${error.message || 'Unknown error'}`);
    } finally {
      this.savingSetId = null;
      this.cdr.markForCheck();
    }
  }

  async submitSet(set: SetWithGames, event: Event) {
    event.stopPropagation();
    
    if (!set.isDirty) {
      return; // Nothing to submit
    }

    this.savingSetId = set.id;
    this.cdr.markForCheck();

    try {
      // Get entrant IDs
      const entrant1Id = set.slots?.[0]?.entrant?.id;
      const entrant2Id = set.slots?.[1]?.entrant?.id;

      if (!entrant1Id || !entrant2Id) {
        throw new Error('Both entrants must be present to submit set');
      }

      // Prepare game data for reportBracketSet
      const gameData = set.games.map(game => ({
        gameNum: game.orderNum,
        winnerId: game.winnerId ?? null,
        entrant1Score: game.entrant1Score ?? null,
        entrant2Score: game.entrant2Score ?? null,
        entrant1Id: entrant1Id,
        entrant2Id: entrant2Id,
        entrant1CharacterId: game.entrant1CharacterId ?? null,
        entrant2CharacterId: game.entrant2CharacterId ?? null
      }));

      // Determine the overall set winner from the games
      let setWinnerId: string | null = set.winnerId || null;
      
      // If no explicit winner set, try to determine from game winners
      if (!setWinnerId) {
        const entrant1Wins = set.games.filter(g => g.winnerId === entrant1Id).length;
        const entrant2Wins = set.games.filter(g => g.winnerId === entrant2Id).length;
        
        if (entrant1Wins > entrant2Wins) {
          setWinnerId = entrant1Id;
        } else if (entrant2Wins > entrant1Wins) {
          setWinnerId = entrant2Id;
        }
      }

      if (!setWinnerId) {
        throw new Error('Set winner must be determined before submitting');
      }

      const updatedSets = await this.startggService.reportBracketSet(set.id, setWinnerId, gameData);
      
      // Update set with the returned Set data (reportBracketSet returns an array, use first one)
      if (updatedSets && updatedSets.length > 0) {
        const updatedSet = updatedSets[0];
        set.state = updatedSet.state;
        set.winnerId = updatedSet.winnerId;
        set.startedAt = updatedSet.startedAt;
      }
      
      set.isDirty = false;
      
      // Reload set details to get updated data from API
      await this.loadSetDetails(set);
      
      alert('Set submitted successfully!');
    } catch (error: any) {
      console.error('Error submitting set:', error);
      alert(`Failed to submit set: ${error.message || 'Unknown error'}`);
    } finally {
      this.savingSetId = null;
      this.cdr.markForCheck();
    }
  }

  getEntrantId(slot: any): string | null {
    return slot.entrant?.id || null;
  }

  isGameWinner(set: SetWithGames, gameIndex: number, entrantId: string | null): boolean {
    const winnerId = set.games[gameIndex]?.winnerId;
    return winnerId !== null && winnerId !== undefined && winnerId === entrantId;
  }

  private extractPlayerIds(): Set<string> {
    const playerIds = new Set<string>();
    
    this.sets.forEach(set => {

      console.clear();
      console.log(set.slots);
      debugger;

      set.slots?.forEach(slot => {
        slot.entrant?.participants?.forEach((participant: any) => {
          if (participant.player?.id) {
            playerIds.add(participant.player.id);
          }
        });
      });
    });
    
    return playerIds;
  }

  private async loadPlayerInfo(): Promise<void> {
    const playerIds = this.extractPlayerIds();
    const playerIdsArray = Array.from(playerIds);
    
    // Load player info for all unique player IDs
    const loadPromises = playerIdsArray
      .filter(id => !this.playerInfoMap.has(id)) // Only load if not already cached
      .map(async (playerId) => {
        try {
          const playerInfo = await this.startggService.getPlayerInfo(playerId);
          this.playerInfoMap.set(playerId, playerInfo);
        } catch (error) {
          console.error(`Error loading player info for ${playerId}:`, error);
          // Continue loading other players even if one fails
        }
      });
    
    await Promise.all(loadPromises);
    this.cdr.markForCheck();
  }

  async getPlayerImageUrl(slot: any): Promise<string | null> {
    if (!slot.entrant?.participants) return null;
    
    // Get the first participant's player ID
    const firstParticipant = slot.entrant.participants[0];
    if (!firstParticipant?.player?.id) return null;
    
    const playerId = firstParticipant.player.id;
    
    // Check if image URL is already cached
    if (this.playerImageUrlMap.has(playerId)) {
      return this.playerImageUrlMap.get(playerId)!;
    }
    
    // Check if player info is already loaded
    if (!this.playerInfoMap.has(playerId)) {
      // Load player info for this specific player
      try {
        const playerInfo = await this.startggService.getPlayerInfo(playerId);
        this.playerInfoMap.set(playerId, playerInfo);
      } catch (error) {
        console.error(`Error loading player info for ${playerId}:`, error);
        return null;
      }
    }
    
    const playerInfo = this.playerInfoMap.get(playerId);
    
    if (!playerInfo?.user?.images || playerInfo.user.images.length === 0) {
      return null;
    }
    
    // Cache and return the first image URL
    const imageUrl = playerInfo.user.images[0].url;
    this.playerImageUrlMap.set(playerId, imageUrl);
    this.cdr.markForCheck();
    
    console.clear();
    console.log(imageUrl);
    debugger;

    return imageUrl;
  }

  // Synchronous getter for template usage
  getPlayerImageUrlSync(slot: any): string | null {
    if (!slot.entrant?.participants) return null;
    
    const firstParticipant = slot.entrant.participants[0];
    if (!firstParticipant?.player?.id) return null;
    
    const playerId = firstParticipant.player.id;

    console.clear();
    console.log(this.playerImageUrlMap);
    debugger;
    
    // Return cached image URL if available
    if (this.playerImageUrlMap.has(playerId)) {
      return this.playerImageUrlMap.get(playerId)!;
    }
    
    // Trigger async loading (fire and forget)
    this.getPlayerImageUrl(slot).catch(error => {
      console.error('Error loading player image:', error);
    });
    
    return null; // Return null until loaded
  }
}
