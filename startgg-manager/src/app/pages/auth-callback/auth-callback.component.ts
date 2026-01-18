import { Component, OnInit, ChangeDetectorRef, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './auth-callback.component.html',
  styleUrl: './auth-callback.component.sass'
})
export class AuthCallbackComponent implements OnInit {
  status: 'processing' | 'success' | 'error' = 'processing';
  errorMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  async ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Get the authorization code and state from URL
    this.route.queryParams.subscribe(async (params) => {
      const code = params['code'];
      const state = params['state'];
      const error = params['error'];

      if (error) {
        this.status = 'error';
        this.errorMessage = params['error_description'] || error;
        this.cdr.markForCheck();
        return;
      }

      if (!code || !state) {
        this.status = 'error';
        this.errorMessage = 'Missing authorization code or state parameter';
        this.cdr.markForCheck();
        return;
      }

      try {
        const result = await this.authService.handleCallback(code, state);
        
        if (result.success) {
          this.status = 'success';
          // Redirect to home after a short delay
          setTimeout(() => {
            this.router.navigate(['/']);
          }, 2000);
        } else {
          this.status = 'error';
          this.errorMessage = result.error || 'Authentication failed';
        }
      } catch (error: any) {
        this.status = 'error';
        this.errorMessage = error.message || 'An unexpected error occurred';
      } finally {
        this.cdr.markForCheck();
      }
    });
  }
}
