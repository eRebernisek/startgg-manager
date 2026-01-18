import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

// OAuth configuration - these should be set via environment variables or config
// For now, using placeholder values that need to be configured
const OAUTH_CONFIG = {
  clientId: 'YOUR_CLIENT_ID', // Replace with your StartGG OAuth client ID
  clientSecret: 'YOUR_CLIENT_SECRET', // Replace with your StartGG OAuth client secret
  scope: 'user.identity user.email',
  authorizationUrl: 'https://start.gg/oauth/authorize',
  tokenUrl: 'https://api.start.gg/oauth/access_token',
  refreshUrl: 'https://api.start.gg/oauth/refresh'
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  getRedirectUri(): string {
    if (isPlatformBrowser(this.platformId)) {
      return `${window.location.origin}/auth-callback`;
    }
    return 'http://localhost:4200/auth-callback';
  }

  initiateLogin(): void {
    if (!isPlatformBrowser(this.platformId)) {
      console.error('OAuth login can only be initiated in browser');
      return;
    }

    const redirectUri = this.getRedirectUri();
    const state = this.generateState();
    sessionStorage.setItem('oauth_state', state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: OAUTH_CONFIG.clientId,
      scope: OAUTH_CONFIG.scope,
      redirect_uri: redirectUri,
      state: state
    });

    const authUrl = `${OAUTH_CONFIG.authorizationUrl}?${params.toString()}`;
    window.location.href = authUrl;
  }

  async handleCallback(code: string, state: string): Promise<{ success: boolean; error?: string }> {
    if (!isPlatformBrowser(this.platformId)) {
      return { success: false, error: 'OAuth callback can only be handled in browser' };
    }

    // Verify state
    const savedState = sessionStorage.getItem('oauth_state');
    if (!savedState || savedState !== state) {
      return { success: false, error: 'Invalid state parameter' };
    }
    sessionStorage.removeItem('oauth_state');

    try {
      const redirectUri = this.getRedirectUri();
      const tokenResponse = await this.exchangeCodeForToken(code, redirectUri);
      
      if (tokenResponse.access_token) {
        // Store the access token
        localStorage.setItem('startgg_token', tokenResponse.access_token);
        
        // Store refresh token if provided
        if (tokenResponse.refresh_token) {
          localStorage.setItem('startgg_refresh_token', tokenResponse.refresh_token);
        }

        return { success: true };
      } else {
        return { success: false, error: 'No access token received' };
      }
    } catch (error: any) {
      console.error('Error exchanging code for token:', error);
      return { success: false, error: error.message || 'Failed to exchange authorization code' };
    }
  }

  private async exchangeCodeForToken(code: string, redirectUri: string): Promise<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded'
    });

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: OAUTH_CONFIG.clientId,
      client_secret: OAUTH_CONFIG.clientSecret,
      code: code,
      redirect_uri: redirectUri,
      scope: OAUTH_CONFIG.scope
    });

    const response = await firstValueFrom(
      this.http.post<any>(OAUTH_CONFIG.tokenUrl, body.toString(), { headers })
    );

    return response;
  }

  async refreshToken(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    const refreshToken = localStorage.getItem('startgg_refresh_token');
    if (!refreshToken) {
      return false;
    }

    try {
      const headers = new HttpHeaders({
        'Content-Type': 'application/x-www-form-urlencoded'
      });

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: OAUTH_CONFIG.clientId,
        client_secret: OAUTH_CONFIG.clientSecret,
        refresh_token: refreshToken,
        redirect_uri: this.getRedirectUri(),
        scope: OAUTH_CONFIG.scope
      });

      const response = await firstValueFrom(
        this.http.post<any>(OAUTH_CONFIG.refreshUrl, body.toString(), { headers })
      );

      if (response.access_token) {
        localStorage.setItem('startgg_token', response.access_token);
        if (response.refresh_token) {
          localStorage.setItem('startgg_refresh_token', response.refresh_token);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('startgg_token');
      localStorage.removeItem('startgg_refresh_token');
      sessionStorage.removeItem('oauth_state');
    }
    this.router.navigate(['/']);
  }

  isAuthenticated(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    return !!localStorage.getItem('startgg_token');
  }

  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  // Method to update OAuth config (for configuration page)
  updateOAuthConfig(clientId: string, clientSecret: string): void {
    // In a real app, you'd want to store this securely
    // For now, this is a placeholder - you should set these via environment variables
    console.warn('OAuth config should be set via environment variables or secure config');
  }
}
