import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');
// trailing "(NEW)" marker on a link label becomes a badge
const BADGE_RE = /\s*\((new|hot|sale)\)\s*$/i;

/**
 * Collapses every open mega panel.
 * @param {Element} navSections The nav sections container
 * @param {Element} [exception] A section to leave untouched
 */
function closeAllSections(navSections, exception) {
  if (!navSections) return;
  navSections.querySelectorAll(':scope .nav-drop[aria-expanded="true"]').forEach((section) => {
    if (section !== exception) section.setAttribute('aria-expanded', 'false');
  });
}

function closeOnEscape(e) {
  if (e.code !== 'Escape') return;
  const nav = document.getElementById('nav');
  const navSections = nav.querySelector('.nav-sections');
  const expanded = navSections?.querySelector('.nav-drop[aria-expanded="true"]');
  if (expanded && isDesktop.matches) {
    closeAllSections(navSections);
    expanded.focus();
  } else if (!isDesktop.matches) {
    // eslint-disable-next-line no-use-before-define
    toggleMenu(nav, navSections);
    nav.querySelector('.nav-hamburger button').focus();
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (nav.contains(e.relatedTarget)) return;
  const navSections = nav.querySelector('.nav-sections');
  if (isDesktop.matches) closeAllSections(navSections);
}

/**
 * Toggles a single mega panel open/closed.
 * @param {Element} section The nav-drop <li>
 * @param {Element} navSections The nav sections container
 */
function openSection(section, navSections) {
  closeAllSections(navSections, section);
  section.setAttribute('aria-expanded', 'true');
}

function toggleSection(section, navSections) {
  const willOpen = section.getAttribute('aria-expanded') !== 'true';
  closeAllSections(navSections, section);
  section.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
}

/**
 * Toggles the whole nav (mobile hamburger).
 * @param {Element} nav
 * @param {Element} navSections
 * @param {Boolean|null} forceExpanded
 */
function toggleMenu(nav, navSections, forceExpanded = null) {
  const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = (expanded || isDesktop.matches) ? '' : 'hidden';
  nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  if (isDesktop.matches || expanded) closeAllSections(navSections);
  button?.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');

  if (!expanded || isDesktop.matches) {
    window.addEventListener('keydown', closeOnEscape);
    nav.addEventListener('focusout', closeOnFocusLost);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    nav.removeEventListener('focusout', closeOnFocusLost);
  }
}

/**
 * Turns a trailing "(NEW)"-style marker on links into a badge chip.
 * @param {Element} scope
 */
function decorateBadges(scope) {
  scope.querySelectorAll('a').forEach((a) => {
    const match = a.textContent.match(BADGE_RE);
    if (!match) return;
    a.textContent = a.textContent.replace(BADGE_RE, '');
    const badge = document.createElement('span');
    badge.className = 'nav-badge';
    badge.textContent = match[1].toUpperCase();
    a.insertAdjacentElement('afterend', badge);
  });
}

/**
 * Decorates the nav element (already populated with fragment sections) into a
 * mega menu. Exported so it can be exercised in isolation (tests / harness).
 * @param {Element} nav
 */
export function buildMegaNav(nav) {
  const parts = [...nav.children];
  // 4 sections => a leading promo bar is present; otherwise brand/sections/tools
  const hasPromo = parts.length >= 4;
  const promo = hasPromo ? parts[0] : null;
  const [brand, sections, tools] = hasPromo ? parts.slice(1) : parts;

  if (promo) promo.classList.add('nav-promo');
  if (brand) brand.classList.add('nav-brand');
  if (sections) sections.classList.add('nav-sections');
  if (tools) tools.classList.add('nav-tools');

  // promo bar: append a dismiss control
  if (promo) {
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'nav-promo-close';
    close.setAttribute('aria-label', 'Dismiss announcement');
    close.innerHTML = '&times;';
    close.addEventListener('click', () => promo.remove());
    promo.append(close);
  }

  // brand: strip button styling from the logo link
  const brandLink = brand?.querySelector('.button');
  if (brandLink) {
    brandLink.className = '';
    brandLink.closest('.button-container')?.classList.remove('button-container');
  }

  // sections: wire up mega panels
  if (sections) {
    decorateBadges(sections);
    sections.querySelectorAll(':scope .default-content-wrapper > ul > li').forEach((li) => {
      const panel = li.querySelector(':scope > ul');
      if (!panel) return;
      li.classList.add('nav-drop');
      li.setAttribute('aria-expanded', 'false');
      panel.classList.add('nav-mega');
      // each direct child of the panel is a column: label + link list
      panel.querySelectorAll(':scope > li').forEach((col) => {
        col.classList.add('nav-col');
        const titleNode = [...col.childNodes].find(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim(),
        ) || col.querySelector(':scope > strong, :scope > p');
        if (titleNode) {
          const heading = document.createElement('span');
          heading.className = 'nav-col-title';
          heading.textContent = (titleNode.textContent || '').trim();
          if (titleNode.nodeType === Node.TEXT_NODE) {
            titleNode.remove();
            col.prepend(heading);
          } else {
            titleNode.replaceWith(heading);
          }
        }
      });
      // toggle: click on desktop + mobile; hover handled in CSS via JS below
      li.addEventListener('click', (e) => {
        // only toggle when clicking the top-level label, not links inside the panel
        if (e.target.closest('.nav-mega')) return;
        e.preventDefault();
        toggleSection(li, sections);
      });
      // desktop hover
      li.addEventListener('mouseenter', () => { if (isDesktop.matches) openSection(li, sections); });
      li.addEventListener('mouseleave', () => { if (isDesktop.matches) li.setAttribute('aria-expanded', 'false'); });
      // keyboard
      li.setAttribute('tabindex', '0');
      li.addEventListener('keydown', (e) => {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          toggleSection(li, sections);
        }
      });
    });
  }

  // tools: promote a "search" link into a live-looking search box
  if (tools) {
    const searchLink = [...tools.querySelectorAll('a')].find(
      (a) => /search/i.test(a.textContent) || a.querySelector('.icon-search'),
    );
    if (searchLink) {
      const box = document.createElement('div');
      box.className = 'nav-search';
      box.innerHTML = `<span class="icon icon-search" aria-hidden="true"></span>
        <input type="search" placeholder="Search" aria-label="Search">`;
      searchLink.closest('li, p, .button-container')?.replaceWith(box);
    }
  }
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // load nav as fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;

  buildMegaNav(nav);

  hamburger.addEventListener('click', () => toggleMenu(nav, nav.querySelector('.nav-sections')));
  nav.prepend(hamburger);
  nav.setAttribute('aria-expanded', 'false');
  toggleMenu(nav, nav.querySelector('.nav-sections'), isDesktop.matches);
  isDesktop.addEventListener('change', () => toggleMenu(nav, nav.querySelector('.nav-sections'), isDesktop.matches));

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  // lift the promo bar above the nav bar so it spans full width
  const promo = nav.querySelector('.nav-promo');
  if (promo) navWrapper.append(promo);
  navWrapper.append(nav);
  block.append(navWrapper);
}
