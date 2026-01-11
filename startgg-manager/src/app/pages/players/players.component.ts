import { Component, OnInit, ChangeDetectorRef, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { StartggService, Player, Tournament } from '../../shared/services/startgg.service';

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './players.component.html',
  styleUrl: './players.component.sass'
})
export class PlayersComponent implements OnInit {
  players: Player[] = [];
  tournaments: Tournament[] = [];
  selectedEventId: string | null = null;
  isLoading: boolean = false;
  isLoadingPlayers: boolean = false;
  error: string | null = null;
  events: Array<{ id: string; name: string; tournamentId: string; tournamentName: string }> = [];

  constructor(
    private startggService: StartggService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

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
        // Auto-select first event if available
        if (this.events.length > 0) {
          this.selectedEventId = this.events[0].id;
          await this.loadPlayers();
        }
      }
    } catch (error: any) {
      this.error = error.message || 'Failed to load tournaments';
      console.error('Error loading tournaments:', error);
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  async loadPlayers() {
    if (!this.selectedEventId) return;

    this.isLoadingPlayers = true;
    this.error = null;
    this.cdr.markForCheck();

    try {
      this.players = await this.startggService.getEventAttendees(this.selectedEventId);
      // Remove duplicates based on player ID
      const uniquePlayers = new Map<string, Player>();
      this.players.forEach(player => {
        if (!uniquePlayers.has(player.id)) {
          uniquePlayers.set(player.id, player);
        }
      });
      this.players = Array.from(uniquePlayers.values());
    } catch (error: any) {
      this.error = error.message || 'Failed to load players';
      console.error('Error loading players:', error);
    } finally {
      this.isLoadingPlayers = false;
      this.cdr.markForCheck();
    }
  }

  onEventChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.selectedEventId = target.value;
    this.loadPlayers();
  }

  getPlayerDisplayName(player: Player): string {
    const tag = player.gamerTag || 'Unknown';
    const prefix = player.prefix ? `${player.prefix} | ` : '';
    return `${prefix}${tag}`;
  }

  getPlayerInitials(player: Player): string {
    const tag = player.gamerTag || 'U';
    const parts = tag.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return tag.substring(0, 2).toUpperCase();
  }
}
