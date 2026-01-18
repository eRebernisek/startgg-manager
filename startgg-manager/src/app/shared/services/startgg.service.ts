import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

export interface Tournament {
  id: string;
  name: string;
  slug: string;
  images?: Array<{
    url: string;
    type: string;
  }>;
  startAt?: number;
  endAt?: number;
  events?: Event[];
}

export interface Player {
  id: string;
  gamerTag: string;
  prefix?: string;
  user?: {
    id: string;
    name?: string;
    slug?: string;
    player?: {
      gamerTag: string;
    };
  };
}

export interface Set {
  id: string;
  state: number;
  round?: number;
  winnerId?: string;
  totalGames?: number;
  startedAt?: number | null;
  slots?: Array<{
    id: string;
    entrant?: {
      id: string;
      name: string;
      participants?: Array<{
        id: string;
        player?: {
          id: string;
          gamerTag: string;
          prefix?: string;
        };
      }>;
    };
    standing?: {
      stats?: {
        score?: {
          value?: number;
        };
      };
    };
  }>;
  games?: Game[];
  videogame?: Videogame;
}

export interface Game {
  id: string;
  orderNum: number;
  winnerId?: string | null;
  entrant1Score?: number | null;
  entrant2Score?: number | null;
  entrant1CharacterId?: string | null;
  entrant2CharacterId?: string | null;
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
}

export interface Videogame {
  id: string;
  name: string;
  slug: string;
  displayName: string;
  images?: Array<{
    url: string;
    type?: string;
  }>;
  characters?: Array<{
    id: string;
    name: string;
    images?: Array<{
      url: string;
      type?: string;
    }>;
  }>;
}

export interface Event {
  id: string;
  name: string;
  slug: string;
  startAt?: number;
  endAt?: number;
  published?: boolean;
  videogameId?: string;
  tournament?: {
    id: string;
    name: string;
    slug?: string;
  };
  videogame?: Videogame;
  images?: Array<{
    url: string;
    type?: string;
  }>;
  sets?: Set[];
}

@Injectable({
  providedIn: 'root'
})
export class StartggService {
  private readonly apiUrl = 'https://api.start.gg/gql/alpha';

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  private getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('startgg_token');
    }
    return null;
  }

  private getHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }

  private async query<T>(query: string, variables?: any): Promise<T> {
    const headers = this.getHeaders();
    const response = await firstValueFrom(
      this.http.post<{ data: T; errors?: any[] }>(
        this.apiUrl,
        { query, variables },
        { headers }
      )
    );

    if (response.errors) {
      throw new Error(response.errors[0]?.message || 'GraphQL error');
    }

    return response.data;
  }

  async getCurrentUserId(): Promise<string | null> {
    try {
      const query = `
        query {
          currentUser {
            id
          }
        }
      `;
      const data = await this.query<{ currentUser: { id: string } | null }>(query);
      return data.currentUser?.id || null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  async getTournaments(ownerId?: string): Promise<Tournament[]> {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error('No API token found. Please set your token in the Account page.');
      }

      // Query tournaments where current user is admin
      const query = `
        query GetTournaments {
          currentUser {
            id
            tournaments(query: {
              perPage: 50
              filter: {
                tournamentView: "admin"
              }
            }) {
              nodes {
                id
                name
                slug
                images {
                  url
                  type
                }
                startAt
                endAt
              }
            }
          }
        }
      `;

      const data = await this.query<{
        currentUser: {
          id: string;
          tournaments: {
            nodes: Tournament[];
          };
        } | null;
      }>(query);

      return data.currentUser?.tournaments?.nodes || [];
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      throw error;
    }
  }

  async getEventAttendees(eventId: string): Promise<Player[]> {
    try {
      const query = `
        query GetEventAttendees($eventId: ID!) {
          event(id: $eventId) {
            entrants(query: {
              perPage: 100
            }) {
              nodes {
                id
                name
                participants {
                  id
                  player {
                    id
                    gamerTag
                    prefix
                  }
                  user {
                    id
                    name
                    slug
                    player {
                      gamerTag
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const data = await this.query<{
        event: {
          entrants: {
            nodes: Array<{
              id: string;
              name: string;
              participants: Array<{
                id: string;
                player?: {
                  id: string;
                  gamerTag: string;
                  prefix?: string;
                };
                user?: {
                  id: string;
                  name?: string;
                  slug?: string;
                  player?: {
                    gamerTag: string;
                  };
                };
              }>;
            }>;
          };
        };
      }>(query, { eventId });

      const players: Player[] = [];
      data.event?.entrants?.nodes?.forEach(entrant => {
        entrant.participants?.forEach(participant => {
          if (participant.player) {
            players.push({
              id: participant.player.id,
              gamerTag: participant.player.gamerTag,
              prefix: participant.player.prefix,
              user: participant.user ? {
                id: participant.user.id,
                name: participant.user.name,
                slug: participant.user.slug,
                player: participant.user.player ? {
                  gamerTag: participant.user.player.gamerTag
                } : undefined
              } : undefined
            });
          }
        });
      });

      return players;
    } catch (error) {
      console.error('Error fetching event attendees:', error);
      throw error;
    }
  }

  async getEventMatches(eventId: string): Promise<Set[]> {
    try {
      const query = `
        query GetEventMatches($eventId: ID!) {
          event(id: $eventId) {
            id
            name
            tournament {
              id
              name
            }
            videogame {
              id
              name
              slug
              displayName
              images {
                url
                type
              }
              characters {
                id
                name
                images {
                  url
                  type
                }
              }
            }
            sets(filters: {
              showByes: false
            }, perPage: 100) {
              nodes {
                id
                state
                round
                winnerId
                totalGames
                startedAt
                slots {
                  id
                  entrant {
                    id
                    name
                    participants {
                      id
                      player {
                        id
                        gamerTag
                        prefix
                      }
                    }
                  }
                  standing {
                    stats {
                      score {
                        value
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const data = await this.query<{
        event: {
          id: string;
          name: string;
          tournament: {
            id: string;
            name: string;
          };
          videogame?: {
            id: string;
            name: string;
            slug: string;
            displayName: string;
            images?: Array<{
              url: string;
              type?: string;
            }>;
            characters?: Array<{
              id: string;
              name: string;
              images?: Array<{
                url: string;
                type?: string;
              }>;
            }>;
          };
          sets: {
            nodes: Array<{
              id: string;
              state: number;
              round?: number;
              winnerId?: string;
              totalGames?: number;
              startedAt?: number | null;
              slots: Array<{
                id: string;
                entrant?: {
                  id: string;
                  name: string;
                  participants: Array<{
                    id: string;
                    player?: {
                      id: string;
                      gamerTag: string;
                      prefix?: string;
                    };
                  }>;
                };
                standing?: {
                  stats?: {
                    score?: {
                      value?: number;
                    };
                  };
                };
              }>;
            }>;
          };
        };
      }>(query, { eventId });

      const matches: Set[] = (data.event?.sets?.nodes || []).map(set => ({
        id: set.id,
        state: set.state,
        round: set.round,
        winnerId: set.winnerId,
        totalGames: set.totalGames,
        startedAt: set.startedAt,
        slots: set.slots,
        videogame: data.event?.videogame
      }));

      return matches;
    } catch (error) {
      console.error('Error fetching event matches:', error);
      throw error;
    }
  }

  async getAllEventsFromTournaments(tournamentIds: string[]): Promise<Array<{ id: string; name: string; tournamentId: string; tournamentName: string }>> {
    try {
      const events: Array<{ id: string; name: string; tournamentId: string; tournamentName: string }> = [];
      
      for (const tournamentId of tournamentIds) {
        const query = `
          query GetTournamentEvents($tournamentId: ID!) {
            tournament(id: $tournamentId) {
              id
              name
              events {
                id
                name
              }
            }
          }
        `;

        const data = await this.query<{
          tournament: {
            id: string;
            name: string;
            events: Array<{
              id: string;
              name: string;
            }>;
          };
        }>(query, { tournamentId: tournamentId });

        if (data.tournament?.events) {
          data.tournament.events.forEach(event => {
            events.push({
              id: event.id,
              name: event.name,
              tournamentId: data.tournament.id,
              tournamentName: data.tournament.name
            });
          });
        }
      }

      return events;
    } catch (error) {
      console.error('Error fetching events from tournaments:', error);
      throw error;
    }
  }

  async startMatch(setId: string): Promise<Set> {
    try {
      const mutation = `
        mutation MarkSetInProgress($setId: ID!) {
          markSetInProgress(setId: $setId) {
            id
            state
            round
            winnerId
            totalGames
            startedAt
            slots {
              id
              entrant {
                id
                name
                participants {
                  id
                  player {
                    id
                    gamerTag
                    prefix
                  }
                }
              }
              standing {
                stats {
                  score {
                    value
                  }
                }
              }
            }
          }
        }
      `;

      const data = await this.query<{
        markSetInProgress: Set;
      }>(mutation, { setId });

      return data.markSetInProgress;
    } catch (error) {
      console.error('Error starting match:', error);
      throw error;
    }
  }

  async resetMatch(setId: string, resetDependentSets: boolean = false): Promise<Set> {
    try {
      const mutation = `
        mutation ResetSet($setId: ID!, $resetDependentSets: Boolean) {
          resetSet(setId: $setId, resetDependentSets: $resetDependentSets) {
            id
            state
            round
            winnerId
            totalGames
            startedAt
            slots {
              id
              entrant {
                id
                name
                participants {
                  id
                  player {
                    id
                    gamerTag
                    prefix
                  }
                }
              }
              standing {
                stats {
                  score {
                    value
                  }
                }
              }
            }
          }
        }
      `;

      const data = await this.query<{
        resetSet: Set;
      }>(mutation, { setId, resetDependentSets });

      return data.resetSet;
    } catch (error) {
      console.error('Error resetting match:', error);
      throw error;
    }
  }

  async updateBracketSet(setId: string, winnerId: string | null, gameData: Array<{
    gameNum: number;
    winnerId: string | null;
    entrant1Score?: number | null;
    entrant2Score?: number | null;
    entrant1Id?: string;
    entrant2Id?: string;
    entrant1CharacterId?: string | null;
    entrant2CharacterId?: string | null;
    stageId?: number | null;
  }>, isDQ: boolean = false): Promise<Set> {
    try {
      const mutation = `
        mutation updateBracketSet($setId: ID!, $winnerId: ID, $isDQ: Boolean, $gameData: [BracketSetGameDataInput]) {
          updateBracketSet(setId: $setId, winnerId: $winnerId, isDQ: $isDQ, gameData: $gameData) {
            id
            state
            round
            winnerId
            totalGames
            startedAt
            slots {
              id
              entrant {
                id
                name
                participants {
                  id
                  player {
                    id
                    gamerTag
                    prefix
                  }
                }
              }
              standing {
                stats {
                  score {
                    value
                  }
                }
              }
            }
          }
        }
      `;

      // Format game data for the mutation - convert to selections format
      const formattedGameData = gameData.map(game => {
        const gameDataItem: any = {
          gameNum: game.gameNum,
          winnerId: game.winnerId || undefined,
          entrant1Score: game.entrant1Score !== null && game.entrant1Score !== undefined ? game.entrant1Score : undefined,
          entrant2Score: game.entrant2Score !== null && game.entrant2Score !== undefined ? game.entrant2Score : undefined
        };

        // Add stageId if provided
        if (game.stageId !== null && game.stageId !== undefined) {
          gameDataItem.stageId = game.stageId;
        }

        // Build selections array from character IDs - always include if character IDs are present
        const selections: Array<{ entrantId: string; characterId: string }> = [];
        if (game.entrant1Id && game.entrant1CharacterId) {
          selections.push({
            entrantId: String(game.entrant1Id),
            characterId: String(game.entrant1CharacterId)
          });
        }
        if (game.entrant2Id && game.entrant2CharacterId) {
          selections.push({
            entrantId: String(game.entrant2Id),
            characterId: String(game.entrant2CharacterId)
          });
        }

        // Always include selections array if there are any character selections
        if (selections.length > 0) {
          gameDataItem.selections = selections;
        }

        return gameDataItem;
      });

      const data = await this.query<{
        updateBracketSet: Set;
      }>(mutation, { 
        setId, 
        winnerId: winnerId || undefined,
        isDQ,
        gameData: formattedGameData.length > 0 ? formattedGameData : undefined
      });

      return data.updateBracketSet;
    } catch (error) {
      console.error('Error updating bracket set:', error);
      throw error;
    }
  }

  async reportBracketSet(setId: string, winnerId: string, gameData: Array<{
    gameNum: number;
    winnerId: string | null;
    entrant1Score?: number | null;
    entrant2Score?: number | null;
    entrant1Id?: string;
    entrant2Id?: string;
    entrant1CharacterId?: string | null;
    entrant2CharacterId?: string | null;
    stageId?: number | null;
  }>): Promise<Set[]> {
    try {
      const mutation = `
        mutation reportSet($setId: ID!, $winnerId: ID!, $gameData: [BracketSetGameDataInput]) {
          reportBracketSet(setId: $setId, winnerId: $winnerId, gameData: $gameData) {
            id
            state
            round
            winnerId
            totalGames
            startedAt
            slots {
              id
              entrant {
                id
                name
                participants {
                  id
                  player {
                    id
                    gamerTag
                    prefix
                  }
                }
              }
              standing {
                stats {
                  score {
                    value
                  }
                }
              }
            }
          }
        }
      `;

      // Format game data for the mutation - convert to selections format
      const formattedGameData = gameData.map(game => {
        const gameDataItem: any = {
          gameNum: game.gameNum,
          winnerId: game.winnerId || undefined,
          entrant1Score: game.entrant1Score !== null && game.entrant1Score !== undefined ? game.entrant1Score : undefined,
          entrant2Score: game.entrant2Score !== null && game.entrant2Score !== undefined ? game.entrant2Score : undefined
        };

        // Add stageId if provided
        if (game.stageId !== null && game.stageId !== undefined) {
          gameDataItem.stageId = game.stageId;
        }

        // Build selections array from character IDs - always include if character IDs are present
        const selections: Array<{ entrantId: string; characterId: string }> = [];
        if (game.entrant1Id && game.entrant1CharacterId) {
          selections.push({
            entrantId: String(game.entrant1Id),
            characterId: String(game.entrant1CharacterId)
          });
        }
        if (game.entrant2Id && game.entrant2CharacterId) {
          selections.push({
            entrantId: String(game.entrant2Id),
            characterId: String(game.entrant2CharacterId)
          });
        }

        // Always include selections array if there are any character selections
        if (selections.length > 0) {
          gameDataItem.selections = selections;
        }

        return gameDataItem;
      });

      const data = await this.query<{
        reportBracketSet: Set[];
      }>(mutation, { 
        setId, 
        winnerId,
        gameData: formattedGameData.length > 0 ? formattedGameData : undefined
      });

      return data.reportBracketSet;
    } catch (error) {
      console.error('Error reporting bracket set:', error);
      throw error;
    }
  }

  async updateSetGames(setId: string, games: Array<{
    id?: string;
    orderNum: number;
    winnerId: string | null;
    entrant1CharacterId?: string | null;
    entrant2CharacterId?: string | null;
    entrant1Score?: number | null;
    entrant2Score?: number | null;
  }>): Promise<boolean> {
    try {
      // Try multiple mutation approaches as StartGG API structure may vary
      // First attempt: updateSetGames mutation
      const mutation = `
        mutation UpdateSetGames($setId: ID!, $games: [SetGameInput!]!) {
          updateSetGames(setId: $setId, games: $games) {
            id
            games {
              id
              orderNum
              winnerId
              entrant1Score
              entrant2Score
            }
          }
        }
      `;

      // Format games for the mutation
      const formattedGames = games.map(game => ({
        id: game.id || undefined,
        orderNum: game.orderNum,
        winnerId: game.winnerId || undefined,
        entrant1CharacterId: game.entrant1CharacterId || undefined,
        entrant2CharacterId: game.entrant2CharacterId || undefined,
        entrant1Score: game.entrant1Score !== null && game.entrant1Score !== undefined ? game.entrant1Score : undefined,
        entrant2Score: game.entrant2Score !== null && game.entrant2Score !== undefined ? game.entrant2Score : undefined
      }));

      const data = await this.query<{
        updateSetGames: {
          id: string;
          games: Array<{
            id: string;
            orderNum: number;
            winnerId: string | null;
            entrant1Score: number | null;
            entrant2Score: number | null;
          }>;
        };
      }>(mutation, { setId, games: formattedGames });

      return !!data.updateSetGames;
    } catch (error: any) {
      // If updateSetGames doesn't work, try alternative mutations
      console.warn('updateSetGames mutation failed, trying alternative approach:', error);
      
      // Alternative: Try updating games individually
      try {
        await this.updateGamesIndividually(setId, games);
        return true;
      } catch (individualError) {
        console.error('Error updating set games:', individualError);
        throw new Error(`Failed to save games: ${error.message || individualError}`);
      }
    }
  }

  private async updateGamesIndividually(setId: string, games: Array<{
    id?: string;
    orderNum: number;
    winnerId: string | null;
    entrant1CharacterId?: string | null;
    entrant2CharacterId?: string | null;
    entrant1Score?: number | null;
    entrant2Score?: number | null;
  }>): Promise<void> {
    // Try to update each game individually if batch update doesn't work
    for (const game of games) {
      if (game.id && game.id.startsWith('game-')) {
        // Skip temporary games that don't have real IDs yet
        continue;
      }

      try {
        // Try updateGame mutation
        const mutation = `
          mutation UpdateGame($gameId: ID!, $winnerId: ID, $entrant1Score: Int, $entrant2Score: Int) {
            updateGame(
              id: $gameId
              winnerId: $winnerId
              entrant1Score: $entrant1Score
              entrant2Score: $entrant2Score
            ) {
              id
              winnerId
            }
          }
        `;

        await this.query<{
          updateGame: {
            id: string;
            winnerId: string | null;
          };
        }>(mutation, {
          gameId: game.id,
          winnerId: game.winnerId || undefined,
          entrant1Score: game.entrant1Score !== null && game.entrant1Score !== undefined ? game.entrant1Score : undefined,
          entrant2Score: game.entrant2Score !== null && game.entrant2Score !== undefined ? game.entrant2Score : undefined
        });
      } catch (gameError) {
        console.warn(`Failed to update game ${game.id}:`, gameError);
        // Continue with other games even if one fails
      }
    }
  }

  getMatchUrl(matchId: string): string {
    return `https://start.gg/set/${matchId}`;
  }

  async getMatchDetails(setId: string): Promise<{
    id: string;
    state: number;
    games: Array<{
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
    }>;
    event?: {
      videogame?: {
        id: string;
        name: string;
        characters?: Array<{
          id: string;
          name: string;
          images?: Array<{
            url: string;
            type: string;
          }>;
        }>;
      };
    };
  }> {
    try {
      const query = `
        query GetSetWithGames($setId: ID!) {
          set(id: $setId) {
            id
            state
            games {
              id
              orderNum
              winnerId
              entrant1Score
              entrant2Score
              selections {
                entrant {
                  id
                }
                character {
                  id
                  name
                  images {
                    url
                    type
                  }
                }
              }
            }
            event {
              videogame {
                id
                name
                characters {
                  id
                  name
                  images {
                    url
                    type
                  }
                }
              }
            }
          }
        }
      `;

      const data = await this.query<{
        set: {
          id: string;
          state: number;
          games: Array<{
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
          }>;
          event?: {
            videogame?: {
              id: string;
              name: string;
              characters?: Array<{
                id: string;
                name: string;
                images?: Array<{
                  url: string;
                  type: string;
                }>;
              }>;
            };
          };
        };
      }>(query, { setId });

      return data.set;
    } catch (error) {
      console.error('Error fetching match details:', error);
      throw error;
    }
  }
}
