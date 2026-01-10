import { Component, OnInit, PLATFORM_ID, Inject, ChangeDetectorRef } from '@angular/core';
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
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
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

  // Save token in browser local storage (also works in android)
  saveToken() {
    if (this.token.trim()) {
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('startgg_token', this.token.trim());
        alert('Token saved successfully!');
      }
    } else {
      this.token = '';
      if (isPlatformBrowser(this.platformId)) {
        localStorage.removeItem('startgg_token');
      }
      alert('Token information cleared.');
      // alert('Please enter a token');
    }
  }

  async testToken() {
    if (!this.token.trim()) {
      this.testResult = {
        success: false,
        message: 'Please enter a token first'
      };
      this.cdr.markForCheck();
      return;
    }

    this.isTesting = true;
    this.testResult = null;

    try {
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${this.token.trim()}`,
        'Content-Type': 'application/json'
      });

      // Test the token by making a simple GraphQL query to get the current user
      const query = {
        query: `
          query {
            currentUser {
              id
              name
              slug
              player{
                gamerTag
              }
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

      //Debug
      console.clear();

      if (response && response.data && response.data.currentUser) {
        //Debug
        console.log(response.data);
        this.testResult = {
          success: true,
          message: `Token is valid! Connected as: ${response.data.currentUser.player.gamerTag || response.data.currentUser.slug || 'User'}`
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
      this.cdr.markForCheck();
    }
  }
}
