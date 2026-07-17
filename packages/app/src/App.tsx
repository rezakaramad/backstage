import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import orgPlugin from '@backstage/plugin-org/alpha';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { SignInPageBlueprint } from '@backstage/plugin-app-react';
import { navModule } from './modules/nav';

// In production, oauth2-proxy handles the full OIDC flow with Microsoft.
// ProxiedSignInPage silently calls /api/auth/oauth2Proxy/refresh to pick up
// the session already established by the proxy — no login UI is shown.
// In local development (auth.environment === 'development'), fall back to guest.
const signInModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    SignInPageBlueprint.make({
      params: {
        loader: async () => {
          const { ProxiedSignInPage, SignInPage } = await import(
            '@backstage/core-components'
          );
          const { useApi, configApiRef } = await import(
            '@backstage/core-plugin-api'
          );
          const Component = (props: any) => {
            const configApi = useApi(configApiRef);
            if (configApi.getString('auth.environment') === 'development') {
              return SignInPage({ ...props, providers: ['guest'] });
            }
            return ProxiedSignInPage({ ...props, provider: 'oauth2Proxy' });
          };
          return Component;
        },
      },
    }),
  ],
});

export default createApp({
  features: [catalogPlugin, orgPlugin, navModule, signInModule],
});
