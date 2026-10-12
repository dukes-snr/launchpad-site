import './style.css';

const art = (name) => `${import.meta.env.BASE_URL}art/${name}`;

// Mobile nav toggle
const toggle = document.querySelector('.nav__toggle');
const menu = document.querySelector('.nav__menu');

function setMenu(open) {
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  menu.classList.toggle('is-open', open);
}

toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
menu.addEventListener('click', (e) => {
  if (e.target.closest('a')) setMenu(false);
});
window.matchMedia('(min-width: 801px)').addEventListener('change', (e) => {
  if (e.matches) setMenu(false);
});

// "stayinky" banner: a wall of Scribble portraits, shuffled so neighbours rarely repeat
const tiles = document.querySelector('.tiles');
const ORDER = [1, 4, 7, 2, 5, 8, 3, 6, 5, 2, 8, 1, 6, 3, 7, 4, 3, 8, 6, 1, 4, 7, 2, 5, 7, 5, 1, 4, 2, 6, 8, 3, 2, 6, 3, 7, 8, 4, 5, 1];
tiles.innerHTML = Array.from({ length: 5 }, (_, row) => {
  const portraits = ORDER.slice(row * 8, row * 8 + 8).map(
    (n) => `<span class="tile"><img src="${art(`avatar-${n}.svg`)}" alt="" loading="lazy" /></span>`,
  ).join('');
  return `<li class="tiles__row"><div class="tiles__track"><div class="tiles__group">${portraits}</div><div class="tiles__group">${portraits}</div></div></li>`;
}).join('');

// Newsletter (static site: confirm locally)
const form = document.querySelector('#newsletter');
const msg = document.querySelector('.newsletter__msg');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = form.email.value.trim();
  msg.textContent = `Thanks! We'll send fresh ink to ${email}.`;
  form.reset();
});

// Enable reveals only after their observers are ready; failed JS leaves content visible.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const activeAnimations = new Set();
const illustrations = new Set();
const canObserve = 'IntersectionObserver' in window;
function animate(element, frames, options) {
  const animation = element.animate(frames, options);
  activeAnimations.add(animation);
  animation.finished.catch(() => {}).finally(() => activeAnimations.delete(animation));
  return animation;
}

const revealObserver = canObserve ? new IntersectionObserver((entries) => {
  entries.forEach(({ target, isIntersecting }) => {
    if (!isIntersecting) return;
    target.classList.add('is-visible');
    revealObserver.unobserve(target);
  });
}, { threshold: 0.2 }) : null;

document.querySelectorAll('main h2, main h3, main p:not(.banner__word), .actions, .card, .mini-card, main .pill:not(.actions .pill), .footer__tag, .newsletter').forEach((element) => {
  element.classList.add('reveal');
  const siblings = [...element.parentElement.children].filter((child) => child.matches('.reveal'));
  element.style.setProperty('--reveal-delay', `${Math.min(siblings.length - 1, 3) * 80}ms`);
  if (reducedMotion.matches || !revealObserver) element.classList.add('is-visible');
  else revealObserver.observe(element);
});
document.documentElement.classList.add('js');

function drawIllustration(svg) {
  if (reducedMotion.matches || !svg.animate) return;
  const shapes = [...svg.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect')]
    .filter((shape) => !shape.closest('defs, clipPath, mask'));
  // Read geometry and styles together before starting any animation.
  const geometry = shapes.map((shape) => {
    const style = getComputedStyle(shape);
    let length = 0;
    if (style.stroke !== 'none' && parseFloat(style.strokeWidth) > 0) {
      try { length = shape.getTotalLength(); } catch { /* Unsupported geometry stays visible. */ }
    }
    return { shape, length, fill: style.fill, fillOpacity: style.fillOpacity };
  });
  geometry.forEach(({ shape, length, fill, fillOpacity }, index) => {
    const delay = Math.min(index * 20, 400);
    if (length > 0) {
      const originalDash = shape.style.strokeDasharray;
      shape.style.strokeDasharray = String(length);
      const drawing = animate(shape, [
        { strokeDashoffset: length }, { strokeDashoffset: 0 },
      ], { duration: 1400, delay, easing: 'ease-in-out', fill: 'backwards' });
      drawing.finished.catch(() => {}).finally(() => {
        shape.style.strokeDasharray = originalDash;
        drawing.cancel();
      });
    }
    if (fill !== 'none') {
      animate(shape, [{ fillOpacity: 0 }, { fillOpacity }], {
        duration: 200, delay: 1400 + delay, fill: 'backwards', easing: 'ease-out',
      });
    }
  });
}
const artObserver = canObserve ? new IntersectionObserver((entries) => {
  entries.forEach(({ target, isIntersecting }) => {
    if (!isIntersecting) return;
    artObserver.unobserve(target);
    drawIllustration(target);
  });
}, { threshold: 0.2 }) : null;

// Resolve the original relative src against this page, including Vite's base path.
const svgRequests = new Map();
async function inlineIllustration(img, index) {
  const source = img.getAttribute('src');
  if (!source || !/(?:^|\/)art\/[^?#]+\.svg(?:[?#]|$)/i.test(source) || img.closest('.tiles')) return;
  try {
    const url = new URL(source, document.baseURI).href;
    if (!svgRequests.has(url)) svgRequests.set(url, fetch(url).then((response) => {
      if (!response.ok) throw new Error(`SVG request failed: ${response.status}`);
      return response.text();
    }));
    const documentSVG = new DOMParser().parseFromString(await svgRequests.get(url), 'image/svg+xml');
    const svg = documentSVG.documentElement;
    if (svg.localName !== 'svg' || documentSVG.querySelector('parsererror')) throw new Error('Invalid SVG');
    // Local IDs must remain unique when several SVG documents share one page.
    const ids = new Map([...svg.querySelectorAll('[id]')].map((node) => [node.id, `illustration-${index}-${node.id}`]));
    svg.querySelectorAll('*').forEach((node) => {
      for (const attribute of [...node.attributes]) {
        let value = attribute.value;
        ids.forEach((replacement, id) => {
          value = value.split(`url(#${id})`).join(`url(#${replacement})`);
          if ((attribute.localName === 'href') && value === `#${id}`) value = `#${replacement}`;
        });
        node.setAttributeNS(attribute.namespaceURI, attribute.name, value);
      }
      if (ids.has(node.id)) node.id = ids.get(node.id);
    });
    svg.classList.add('inline-art', ...img.classList);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', img.alt);
    if (!img.alt) svg.setAttribute('aria-hidden', 'true');
    if (img.hasAttribute('width')) svg.setAttribute('width', img.getAttribute('width'));
    if (img.hasAttribute('height')) svg.setAttribute('height', img.getAttribute('height'));
    img.replaceWith(svg);
    illustrations.add(svg);
    if (!reducedMotion.matches && artObserver) artObserver.observe(svg);
  } catch (error) {
    // Preserve the original image if fetching or parsing fails.
    console.warn('Could not inline illustration:', source, error);
  }
}
document.querySelectorAll('img').forEach(inlineIllustration);

const banner = document.querySelector('.banner');
const bannerWord = document.querySelector('.banner__word');
let parallaxFrame = 0;
function updateParallax() {
  parallaxFrame = 0;
  if (reducedMotion.matches) return;
  const bounds = banner.getBoundingClientRect();
  if (bounds.bottom < 0 || bounds.top > window.innerHeight) return;
  const offset = Math.max(-28, Math.min(28, (window.innerHeight / 2 - bounds.top - bounds.height / 2) * 0.045));
  bannerWord.style.transform = `translateY(${offset}px)`;
}
function scheduleParallax() {
  if (!reducedMotion.matches && !parallaxFrame) parallaxFrame = requestAnimationFrame(updateParallax);
}
window.addEventListener('scroll', scheduleParallax, { passive: true });
window.addEventListener('resize', scheduleParallax, { passive: true });
scheduleParallax();
reducedMotion.addEventListener('change', ({ matches }) => {
  if (matches) {
    activeAnimations.forEach((animation) => animation.cancel());
    revealObserver?.disconnect();
    artObserver?.disconnect();
    document.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible'));
    cancelAnimationFrame(parallaxFrame);
    parallaxFrame = 0;
    bannerWord.style.removeProperty('transform');
  } else scheduleParallax();
});
