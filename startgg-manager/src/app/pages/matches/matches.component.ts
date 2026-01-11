import { Component, OnInit, ChangeDetectorRef, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { StartggService, Match, Tournament } from '../../shared/services/startgg.service';

@Component({
  selector: 'app-matches',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './matches.component.html',
  styleUrl: './matches.component.sass'
})
export class MatchesComponent implements OnInit {
  matches: Match[] = [];
  tournaments: Tournament[] = [];
  selectedEventId: string | null = null;
  isLoading: boolean = false;
  isLoadingMatches: boolean = false;
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
          await this.loadMatches();
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

  async loadMatches() {
    if (!this.selectedEventId) return;

    this.isLoadingMatches = true;
    this.error = null;
    this.cdr.markForCheck();

    try {
      this.matches = await this.startggService.getEventMatches(this.selectedEventId);
    } catch (error: any) {
      this.error = error.message || 'Failed to load matches';
      console.error('Error loading matches:', error);
    } finally {
      this.isLoadingMatches = false;
      this.cdr.markForCheck();
    }
  }

  onEventChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.selectedEventId = target.value;
    this.loadMatches();
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

  getMatchScore(match: Match): string {
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

  getWinnerName(match: Match): string | null {
    if (!match.winnerId || !match.slots) return null;
    
    const winnerSlot = match.slots.find(slot => slot.entrant?.id === match.winnerId);
    return winnerSlot ? this.getEntrantName(winnerSlot) : null;
  }
}
