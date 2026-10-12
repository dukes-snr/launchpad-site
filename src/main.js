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
tiles.innerHTML = ORDER.map(
  (n) => `<li><img src="${art(`avatar-${n}.svg`)}" alt="" loading="lazy" /></li>`,
).join('');

// Newsletter (static site: confirm locally)
const form = document.querySelector('#newsletter');
const msg = document.querySelector('.newsletter__msg');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = form.email.value.trim();
  msg.textContent = `Thanks! We'll send fresh ink to ${email}.`;
  form.reset();
});
