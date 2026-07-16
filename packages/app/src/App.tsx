import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { SignInPageBlueprint } from '@backstage/plugin-app-react/alpha';
import { microsoftAuthApiRef } from '@backstage/core-plugin-api';
import { navModule } from './modules/nav';

const microsoftSignInPage = SignInPageBlueprint.make({
  params: {
    providers: [{ id: 'microsoft-auth-provider', title: 'Microsoft', message: 'Sign in with Microsoft', apiRef: microsoftAuthApiRef }],
  },
});

export default createApp({
  features: [catalogPlugin, navModule, microsoftSignInPage],
});
