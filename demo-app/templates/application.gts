import { pageTitle } from 'ember-page-title';
import variation from 'ember-feature-flags/helpers/variation';

<template>
  {{pageTitle "Demo App"}}

  <h1>Welcome to ember!</h1>

  {{#if (variation "demo-flag")}}
    <p>Flag is on — value: {{variation "demo-string-flag"}}</p>
  {{else}}
    <p>Flag is off</p>
  {{/if}}
</template>
