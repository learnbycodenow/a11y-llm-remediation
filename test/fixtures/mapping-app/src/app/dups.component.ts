import { Component } from '@angular/core';

@Component({ selector: 'app-a', templateUrl: './a.component.html' })
export class AComponent {}

@Component({ selector: 'app-b', templateUrl: './b.component.html' })
export class BComponent {}

// Attribute selector: no host tag, so it is reachable only through a search of every template.
// The last component points at a template file that does not exist.
@Component({ selector: '[appThing]', templateUrl: './thing.component.html' })
export class ThingComponent {}

@Component({ selector: 'app-missing', templateUrl: './missing.component.html' })
export class MissingComponent {}
