import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { createFrontendModule, microsoftAuthApiRef } from '@backstage/frontend-plugin-api';
import { SignInPageBlueprint } from '@backstage/plugin-app-react';
import { navModule } from './modules/nav';

const microsoftSignInModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    SignInPageBlueprint.make({
      params: {
        loader: async () => {
          const { SignInPage } = await import('@backstage/core-components');
          const Component = (props: any) =>
            SignInPage({
              ...props,
              providers: [
                {
                  id: 'microsoft-auth-provider',
                  title: 'Microsoft',
                  message: 'Sign in with Microsoft',
                  apiRef: microsoftAuthApiRef,
                },
              ],
            });
          return Component;
        },
      },
    }),
  ],
});

export default createApp({
  features: [catalogPlugin, navModule, microsoftSignInModule],
});
