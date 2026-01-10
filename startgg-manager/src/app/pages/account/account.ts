import { Component, OnInit, PLATFORM_ID, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-account',
  imports: [FormsModule, CommonModule],
  templateUrl: './account.html',
  styleUrl: './account.sass',
})
export class Account implements OnInit {
  token: string = '';
  isTesting: boolean = false;
  testResult: { success: boolean; message: string } | null = null;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    // Load token from localStorage if it exists (only in browser)
    if (isPlatformBrowser(this.platformId)) {
      const savedToken = localStorage.getItem('startgg_token');
      if (savedToken) {
        this.token = savedToken;
      }
    }
  }

  saveToken() {
    if (this.token.trim()) {
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('startgg_token', this.token.trim());
        alert('Token saved successfully!');
      }
    } else {
      alert('Please enter a token');
    }
  }

  async testToken() {
    if (!this.token.trim()) {
      this.testResult = {
        success: false,
        message: 'Please enter a token first'
      };
      return;
    }

    this.isTesting = true;
    this.testResult = null;

    try {
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${this.token.trim()}`,
        'Content-Type': 'application/json'
      });

      // Test the token by making a simple GraphQL query to get the viewer
      const query = {
        query: `
          query {
            viewer {
              id
              name
            }
          }
        `
      };

      const response = await firstValueFrom(
        this.http.post<any>(
          'https://api.start.gg/gql/alpha',
          query,
          { headers }
        )
      );

      if (response && response.data && response.data.viewer) {
        this.testResult = {
          success: true,
          message: `Token is valid! Connected as: ${response.data.viewer.name || 'User'}`
        };
      } else if (response && response.errors) {
        this.testResult = {
          success: false,
          message: `Token validation failed: ${response.errors[0]?.message || 'Unknown error'}`
        };
      } else {
        this.testResult = {
          success: false,
          message: 'Unexpected response from API'
        };
      }
    } catch (error: any) {
      this.testResult = {
        success: false,
        message: `Error testing token: ${error.message || 'Network error'}`
      };
    } finally {
      this.isTesting = false;
    }
  }
}
