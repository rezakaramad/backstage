import {
  Sidebar,
  SidebarDivider,
  SidebarGroup,
  SidebarItem,
  SidebarScrollWrapper,
  SidebarSpace,
} from '@backstage/core-components';
import { NavContentBlueprint } from '@backstage/plugin-app-react';
import { SidebarLogo } from './SidebarLogo';
import MenuIcon from '@material-ui/icons/Menu';
import SearchIcon from '@material-ui/icons/Search';
import { SidebarSearchModal } from '@backstage/plugin-search';
import { UserSettingsSignInAvatar } from '@backstage/plugin-user-settings';
import { NotificationsSidebarItem } from '@backstage/plugin-notifications';
import { useApi, identityApiRef, configApiRef } from '@backstage/core-plugin-api';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';

const TENANT_ID = 'c6ba6fd6-0fdd-4458-ad98-0c292dd79188';

const SignOutItem = () => {
  const identityApi = useApi(identityApiRef);
  const configApi = useApi(configApiRef);

  const handleSignOut = () => {
    // Local dev: no oauth2-proxy running, just clear the Backstage session.
    if (configApi.getOptionalString('auth.environment') === 'development') {
      identityApi.signOut();
      return;
    }
    // Production: redirect through oauth2-proxy sign_out, then chain to
    // Microsoft's end_session_endpoint for a full SSO logout.
    const postLogoutUri = encodeURIComponent(window.location.origin);
    const msLogout = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/logout?post_logout_redirect_uri=${postLogoutUri}`;
    window.location.href = `/oauth2/sign_out?rd=${encodeURIComponent(msLogout)}`;
  };

  return (
    <SidebarItem icon={ExitToAppIcon} text="Log out" onClick={handleSignOut} />
  );
};

export const SidebarContent = NavContentBlueprint.make({
  params: {
    component: ({ navItems }) => {
      const nav = navItems.withComponent(item => (
        <SidebarItem icon={() => item.icon} to={item.href} text={item.title} />
      ));

      // Skipped items
      nav.take('page:search'); // Using search modal instead
      nav.take('page:notifications'); // Using NotificationsSidebarItem manually instead

      return (
        <Sidebar>
          <SidebarLogo />
          <SidebarGroup label="Search" icon={<SearchIcon />} to="/search">
            <SidebarSearchModal />
          </SidebarGroup>
          <SidebarDivider />
          <SidebarGroup label="Menu" icon={<MenuIcon />}>
            {nav.take('page:catalog')}
            {nav.take('page:scaffolder')}
            <SidebarDivider />
            <SidebarScrollWrapper>
              {nav.rest({ sortBy: 'title' })}
            </SidebarScrollWrapper>
          </SidebarGroup>
          <SidebarSpace />
          <SidebarDivider />
          <NotificationsSidebarItem />
          <SidebarDivider />
          <SidebarGroup
            label="Settings"
            icon={<UserSettingsSignInAvatar />}
            to="/settings"
          >
            {nav.take('page:app-visualizer')}
            {nav.take('page:user-settings')}
            <SignOutItem />
          </SidebarGroup>
        </Sidebar>
      );
    },
  },
});
