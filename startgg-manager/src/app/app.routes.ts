import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { AboutComponent } from './pages/about/about.component';
import { TournamentsComponent } from './pages/tournaments/tournaments.component';
import { PlayersComponent } from './pages/players/players.component';
import { MatchesComponent } from './pages/matches/matches.component';
import { Account } from './pages/account/account';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'about', component: AboutComponent },
  { path: 'account', component: Account },
  { path: 'tournaments', component: TournamentsComponent },
  { path: 'players', component: PlayersComponent },
  { path: 'matches', component: MatchesComponent },
  { path: '**', redirectTo: '' } // Wildcard route for 404 page
];
