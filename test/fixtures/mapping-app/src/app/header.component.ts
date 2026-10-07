import { Component } from '@angular/core';

@Component({
  selector: 'app-header',
  template: `
    <nav class="top">
      <a class="home" routerLink="/">Home</a>
      <a class="user" [routerLink]="['/u', name]">{{ name }}</a>
      <img class="logo" src="logo.png" />
    </nav>
  `,
})
export class HeaderComponent {}
