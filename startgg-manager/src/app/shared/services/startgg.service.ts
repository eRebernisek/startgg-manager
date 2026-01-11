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

export interface Match {
  id: string;
  state: number;
  round?: number;
  winnerId?: string;
  totalGames?: number;
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
  event?: {
    id: string;
    name: string;
    tournament?: {
      id: string;
      name: string;
    };
  };
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

      // Get ownerId from current user if not provided
      const targetOwnerId = ownerId || await this.getCurrentUserId();
      
      if (!targetOwnerId) {
        throw new Error('No user ID available. Please verify your token is valid in the Account page.');
      }

      // Query tournaments by ownerId
      const query = `
        query GetTournaments($ownerId: ID!) {
          tournaments(query: {
            perPage: 50
            filter: {
              ownerId: $ownerId
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
      `;

      const data = await this.query<{
        tournaments: {
          nodes: Tournament[];
        };
      }>(query, { ownerId: targetOwnerId });

      return data.tournaments?.nodes || [];
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

  async getEventMatches(eventId: string): Promise<Match[]> {
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
            sets(filters: {
              showByes: false
            }, perPage: 100) {
              nodes {
                id
                state
                round
                winnerId
                totalGames
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
          sets: {
            nodes: Array<{
              id: string;
              state: number;
              round?: number;
              winnerId?: string;
              totalGames?: number;
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

      const matches: Match[] = (data.event?.sets?.nodes || []).map(set => ({
        id: set.id,
        state: set.state,
        round: set.round,
        winnerId: set.winnerId,
        totalGames: set.totalGames,
        slots: set.slots,
        event: {
          id: data.event.id,
          name: data.event.name,
          tournament: data.event.tournament
        }
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
}
