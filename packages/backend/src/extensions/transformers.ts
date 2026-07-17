import * as MicrosoftGraph from '@microsoft/microsoft-graph-types';
import {
  defaultUserTransformer,
  microsoftGraphOrgEntityProviderTransformExtensionPoint,
} from '@backstage/plugin-catalog-backend-module-msgraph';
import { UserEntity } from '@backstage/catalog-model';
import { createBackendModule } from '@backstage/backend-plugin-api';

// The default transformer names users after the full UPN with invalid
// characters subbed out, e.g. 'reza_rkaramadgmail.onmicrosoft.com'. That does
// not match the `emailLocalPartMatchingUserEntityName` sign-in resolver, which
// looks up `user:default/<local-part>` (e.g. 'reza').
//
// This transformer keeps the default behaviour but rewrites the entity name to
// the local part of the UPN so the resolver can find the user.
export async function localPartUserTransformer(
  graphUser: MicrosoftGraph.User,
  userPhoto?: string,
): Promise<UserEntity | undefined> {
  const backstageUser = await defaultUserTransformer(graphUser, userPhoto);

  if (backstageUser) {
    backstageUser.metadata.name = backstageUser.metadata.name
      .split('_')[0]
      .toLowerCase();
  }

  return backstageUser;
}

// Wrapping the transformer in a module lets us inject it into the catalog.
export default createBackendModule({
  pluginId: 'catalog',
  moduleId: 'msgraph-transformers',
  register(reg) {
    reg.registerInit({
      deps: {
        microsoftGraphTransformers:
          microsoftGraphOrgEntityProviderTransformExtensionPoint,
      },
      async init({ microsoftGraphTransformers }) {
        microsoftGraphTransformers.setUserTransformer(localPartUserTransformer);
      },
    });
  },
});
