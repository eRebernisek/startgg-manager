import { Component, OnInit, ChangeDetectorRef, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { StartggService, Tournament } from '../../shared/services/startgg.service';

@Component({
  selector: 'app-tournaments',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tournaments.component.html',
  styleUrl: './tournaments.component.sass'
})
export class TournamentsComponent implements OnInit {
  tournaments: Tournament[] = [];
  isLoading: boolean = false;
  error: string | null = null;

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
    } catch (error: any) {
      this.error = error.message || 'Failed to load tournaments';
      console.error('Error loading tournaments:', error);
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  getTournamentImage(tournament: Tournament): string | null {
    if (tournament.images && tournament.images.length > 0) {
      // Only get profile images
      const profileImage = tournament.images.find(img => img.type === 'profile');
      return profileImage?.url || null;
    }
    return null;
  }

  formatDate(timestamp?: number): string {
    if (!timestamp) return 'Date TBD';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }
}
