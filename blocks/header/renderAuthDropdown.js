import { getCookie } from '@dropins/tools/lib.js';
import { events } from '@dropins/tools/event-bus.js';
import * as authApi from '@dropins/storefront-auth/api.js';
import { render as authRenderer } from '@dropins/storefront-auth/render.js';
import { SignIn } from '@dropins/storefront-auth/containers/SignIn.js';
import {
  CUSTOMER_FORGOTPASSWORD_PATH,
  CUSTOMER_CREATE_ACCOUNT_PATH,
  rootLink,
} from '../../scripts/commerce.js';

const AUTH_COOKIE_NAMES = [
  'auth_dropin_user_token',
  'auth_dropin_firstname',
  'auth_dropin_lastname',
  'auth_dropin_admin_session',
];

/**
 * Clears auth cookies with the same attributes used when they were set
 * (path, SameSite, Secure) so logout always drops the client session.
 */
function clearAuthCookies() {
  const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const secure = isLocalhost ? '' : '; Secure';
  AUTH_COOKIE_NAMES.forEach((name) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax${secure}`;
  });
}

function handleLogout(redirections) {
  const shouldRedirect = Object.entries(redirections).some(([currentPath, redirectPath]) => {
    if (window.location.pathname.includes(currentPath)) {
      window.location.href = redirectPath;
      return true;
    }
    return false;
  });

  if (!shouldRedirect) {
    // reload the page if no redirect occurred
    window.location.reload();
  }
}

function renderSignIn(element) {
  authRenderer.render(SignIn, {
    onSuccessCallback: () => {
      // reload the page
      window.location.reload();
    },
    formSize: 'small',
    routeForgotPassword: () => rootLink(CUSTOMER_FORGOTPASSWORD_PATH),
    renderSignUpLink: true,
    routeSignUp: () => rootLink(CUSTOMER_CREATE_ACCOUNT_PATH),
  })(element);
}

export function renderAuthDropdown(navTools) {
  const dropdownElement = document.createRange().createContextualFragment(`
 <div class="dropdown-wrapper nav-tools-wrapper">
    <button type="button" class="nav-dropdown-button" aria-haspopup="true" aria-expanded="false" aria-label="Account"></button>
    <div class="nav-auth-menu-panel nav-tools-panel" id="login-modal">
      <div id="auth-dropin-container"></div>
      <ul class="authenticated-user-menu">
         <li><a href="${rootLink('/customer/account')}">My Account</a></li>
          <li><button type="button" class="logoutButton">Logout</button></li>
      </ul>
    </div>
 </div>`);

  navTools.prepend(dropdownElement);

  const dropdownWrapper = navTools.querySelector('.dropdown-wrapper.nav-tools-wrapper');
  const authDropDownPanel = navTools.querySelector('.nav-auth-menu-panel');
  const authDropDownMenuList = navTools.querySelector(
    '.authenticated-user-menu',
  );
  const authDropinContainer = navTools.querySelector('#auth-dropin-container');
  const loginButton = navTools.querySelector('.nav-dropdown-button');
  const logoutButtonElement = navTools.querySelector(
    '.authenticated-user-menu > li > .logoutButton',
  );

  authDropDownPanel.addEventListener('click', (e) => e.stopPropagation());

  async function toggleDropDownAuthMenu(state) {
    const show = state ?? !authDropDownPanel.classList.contains('nav-tools-panel--show');

    authDropDownPanel.classList.toggle('nav-tools-panel--show', show);
    authDropDownPanel.setAttribute('role', 'dialog');
    authDropDownPanel.setAttribute('aria-hidden', show ? 'false' : 'true');
    loginButton.setAttribute('aria-expanded', show ? 'true' : 'false');
    if (show) {
      authDropDownPanel.focus();
    }
  }

  loginButton.addEventListener('click', () => toggleDropDownAuthMenu());
  document.addEventListener('click', async (e) => {
    const clickOnDropDownPanel = authDropDownPanel.contains(e.target);
    const clickOnLoginButton = loginButton.contains(e.target);

    if (!clickOnDropDownPanel && !clickOnLoginButton) {
      await toggleDropDownAuthMenu(false);
    }
  });

  /**
   * @param {boolean} [isAuthenticated] Explicit auth state from the event bus.
   *   When omitted, falls back to the auth token cookie.
   */
  const updateDropDownUI = (isAuthenticated) => {
    const tokenCookie = getCookie('auth_dropin_user_token');
    const firstNameCookie = getCookie('auth_dropin_firstname');
    // Prefer explicit event payload — `false || cookie` would ignore logout.
    const authenticated = typeof isAuthenticated === 'boolean'
      ? isAuthenticated
      : Boolean(tokenCookie);

    dropdownWrapper.classList.toggle('is-authenticated', authenticated);
    authDropDownPanel.classList.toggle('nav-auth-menu-panel--user', authenticated);

    if (authenticated) {
      const firstName = firstNameCookie || 'there';
      authDropDownMenuList.style.display = 'block';
      authDropinContainer.style.display = 'none';
      authDropinContainer.setAttribute('hidden', '');
      loginButton.innerHTML = `
        <span class="nav-dropdown-button__icon" aria-hidden="true"></span>
        <span class="nav-dropdown-button__label">Hi, ${firstName}</span>
      `;
      loginButton.setAttribute('aria-label', `Account menu, Hi, ${firstName}`);
    } else {
      authDropDownMenuList.style.display = 'none';
      authDropinContainer.style.display = 'block';
      authDropinContainer.removeAttribute('hidden');
      // Icon comes from CSS background-image on .nav-dropdown-button
      loginButton.replaceChildren();
      loginButton.setAttribute('aria-label', 'Account');
    }
  };

  logoutButtonElement.addEventListener('click', async () => {
    try {
      await authApi.revokeCustomerToken();
    } catch (error) {
      console.error('Logout failed:', error);
    }
    // Drop-in clear can miss SameSite/Secure attrs; force-clear client session.
    clearAuthCookies();
    updateDropDownUI(false);
    await toggleDropDownAuthMenu(false);
    handleLogout({
      '/checkout': rootLink('/cart'),
      '/customer': rootLink('/customer/login'),
      '/order-details': rootLink('/'),
    });
  });

  renderSignIn(authDropinContainer);

  events.on('authenticated', updateDropDownUI, { eager: true });
  // Ensure guest/auth UI is correct even if no prior authenticated event exists.
  updateDropDownUI();
}
