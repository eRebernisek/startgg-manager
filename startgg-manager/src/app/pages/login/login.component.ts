import { Component, OnInit, ChangeDetectorRef, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.sass'
})
export class LoginComponent implements OnInit {
  isAuthenticated: boolean = false;
  isLoading: boolean = false;

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.isAuthenticated = this.authService.isAuthenticated();
      this.cdr.markForCheck();
    }
  }

  login() {
    this.isLoading = true;
    this.cdr.markForCheck();
    this.authService.initiateLogin();
  }

  logout() {
    this.authService.logout();
    this.isAuthenticated = false;
    this.cdr.markForCheck();
  }
}
